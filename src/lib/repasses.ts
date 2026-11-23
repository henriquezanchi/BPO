import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { escolasDaDirecao } from "@/lib/antecedentes";
import { db } from "@/lib/db";
import { cifrar, decifrar } from "@/lib/segredo-cifrado";
import { chavePixDaEscola } from "@/lib/spread";
import type { Member } from "@prisma/client";

/**
 * Repasses da conta provisória (23/11/2026; ver lib/conta-provisoria.ts). A direção da escola vê, com o PIN do
 * financeiro, o que entrou pelo Portal em nome dela na conta de Barra do Garças e pede o repasse, que sai por Pix (API do
 * Asaas, conta titular) para a chave Pix cadastrada da escola. Tudo vem do registro CobrancaProvisoria:
 *  - disponível = soma do líquido (valor − taxa do Asaas − spread) das cobranças pagas ainda não repassadas, menos
 *    ajustes (estorno depois do repasse, tarifa de transferência — que desconta do repasse, decisão do usuário);
 *  - a receber = cobranças emitidas e ainda não pagas pelos alunos.
 * O pedido marca as cobranças incluídas ANTES de chamar o Asaas, para nunca repassar duas vezes.
 */
type Pessoa = Pick<Member, "id" | "schoolId" | "isDiretor" | "isSubChefe" | "filiaisChefiadas" | "mercurioId" | "name">;
const ORIGENS = ["contribuicao", "evento", "fortuna", "ajuste_estorno", "ajuste_tarifa"];
const COOKIE = "na_financeiro";
const VALIDADE_MS = 10 * 60 * 1000;
const BASE = () => (process.env.ASAAS_ENV === "sandbox" ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3");
const dec = (v: Prisma.Decimal | number | null | undefined) => Number(v ?? 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

// ───────────── PIN do financeiro ─────────────
export async function podeVerFinanceiro(m: Pessoa, schoolId: string) {
  const escolas = await escolasDaDirecao(m);
  return escolas === null || escolas.includes(schoolId);
}
export async function temPin(memberId: string) {
  return !!(await db.pinFinanceiro.findUnique({ where: { memberId }, select: { memberId: true } }));
}
const hash = (pin: string) => {
  const sal = randomBytes(16);
  return `${sal.toString("base64")}:${scryptSync(pin, sal, 64).toString("base64")}`;
};
const confere = (pin: string, g: string) => {
  const [sal, h] = g.split(":");
  const a = scryptSync(pin, Buffer.from(sal, "base64"), 64);
  const b = Buffer.from(h, "base64");
  return a.length === b.length && timingSafeEqual(a, b);
};
export async function definirPin(memberId: string, pin: string, atual?: string) {
  if (!/^\d{6}$/.test(pin)) throw new Error("O PIN tem 6 números.");
  if (/^(\d)\1{5}$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) throw new Error("Escolha um PIN menos óbvio.");
  const ja = await db.pinFinanceiro.findUnique({ where: { memberId } });
  if (ja && !(atual && confere(atual, ja.hash))) throw new Error("O PIN atual não confere.");
  await db.pinFinanceiro.upsert({ where: { memberId }, update: { hash: hash(pin), falhas: 0, bloqueadoAte: null }, create: { memberId, hash: hash(pin) } });
}
export async function abrirFinanceiro(memberId: string, pin: string) {
  const p = await db.pinFinanceiro.findUnique({ where: { memberId } });
  if (!p) throw new Error("Crie antes o seu PIN.");
  if (p.bloqueadoAte && p.bloqueadoAte > new Date()) throw new Error("Muitas tentativas. Tente de novo em alguns minutos.");
  if (!confere(pin, p.hash)) {
    const f = p.falhas + 1;
    await db.pinFinanceiro.update({ where: { memberId }, data: { falhas: f >= 5 ? 0 : f, bloqueadoAte: f >= 5 ? new Date(Date.now() + 15 * 60_000) : null } });
    throw new Error("PIN incorreto.");
  }
  await db.pinFinanceiro.update({ where: { memberId }, data: { falhas: 0, bloqueadoAte: null } });
  (await cookies()).set(COOKIE, cifrar(JSON.stringify({ memberId, ate: Date.now() + VALIDADE_MS }), "financeiro-sessao"), { httpOnly: true, secure: true, sameSite: "strict", path: "/economia", maxAge: VALIDADE_MS / 1000 });
}
export async function fecharFinanceiro() {
  (await cookies()).set(COOKIE, "", { path: "/economia", maxAge: 0 });
}
export async function financeiroAberto(memberId: string) {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  try {
    const d = JSON.parse(decifrar(v, "financeiro-sessao")) as { memberId: string; ate: number };
    return d.memberId === memberId && d.ate > Date.now();
  } catch {
    return false;
  }
}

// ───────────── Saldo e extrato ─────────────
export type ResumoRepasse = {
  titular: string | null;
  recebidoBruto: number;
  taxas: number;
  spread: number;
  recebidoLiquido: number;
  ajustes: number;
  repassado: number;
  emRepasse: number;
  disponivel: number;
  aReceber: number;
  aReceberQtd: number;
  cobrancas: { data: string; origem: string; quem: string; bruto: number; liquido: number | null; status: string; repassado: boolean }[];
  repasses: { id: string; data: string; valor: number; tarifa: number; status: string; chave: string; erro: string | null; automatico: boolean }[];
};

export async function resumoDaEscola(schoolId: string): Promise<ResumoRepasse> {
  const [linhas, repasses] = await Promise.all([
    db.cobrancaProvisoria.findMany({ where: { schoolId, origem: { in: ORIGENS } }, orderBy: { createdAt: "desc" } }),
    db.repasseFilial.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const titularId = linhas[0]?.titularSchoolId ?? repasses[0]?.titularSchoolId ?? null;
  const titular = titularId ? ((await db.school.findUnique({ where: { id: titularId }, select: { name: true } }))?.name ?? null) : null;
  const pagos = linhas.filter((l) => l.status === "pago" && !l.origem.startsWith("ajuste"));
  const ajustes = linhas.filter((l) => l.origem.startsWith("ajuste"));
  const emAberto = new Set(repasses.filter((r) => r.status === "solicitado" || r.status === "enviado").map((r) => r.id));
  const naoRepassados = linhas.filter((l) => l.status === "pago" && !l.repasseId);
  const nomes = new Map(
    (await db.member.findMany({ where: { id: { in: [...new Set(linhas.map((l) => l.memberId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((m) => [m.id, m.name]),
  );
  return {
    titular,
    recebidoBruto: r2(pagos.reduce((s, l) => s + dec(l.valorBruto), 0)),
    taxas: r2(pagos.reduce((s, l) => s + dec(l.taxaAsaas), 0)),
    spread: r2(pagos.reduce((s, l) => s + dec(l.splitBpo), 0)),
    recebidoLiquido: r2(pagos.reduce((s, l) => s + dec(l.valorLiquido), 0)),
    ajustes: r2(ajustes.reduce((s, l) => s + dec(l.valorLiquido), 0)),
    repassado: r2(repasses.filter((r) => r.status === "concluido").reduce((s, r) => s + dec(r.valor), 0)),
    emRepasse: r2(repasses.filter((r) => emAberto.has(r.id)).reduce((s, r) => s + dec(r.valor), 0)),
    disponivel: r2(Math.max(0, naoRepassados.reduce((s, l) => s + dec(l.valorLiquido), 0))),
    aReceber: r2(linhas.filter((l) => l.status === "pendente").reduce((s, l) => s + dec(l.valorBruto), 0)),
    aReceberQtd: linhas.filter((l) => l.status === "pendente").length,
    cobrancas: linhas.slice(0, 100).map((l) => ({
      data: (l.pagoEm ?? l.createdAt).toISOString(),
      origem: l.origem,
      quem: l.memberId ? (nomes.get(l.memberId) ?? "—") : "—",
      bruto: dec(l.valorBruto),
      liquido: l.valorLiquido === null ? null : dec(l.valorLiquido),
      status: l.status,
      repassado: !!l.repasseId,
    })),
    repasses: repasses.map((r) => ({ id: r.id, data: r.createdAt.toISOString(), valor: dec(r.valor), tarifa: dec(r.tarifa), status: r.status, chave: r.chavePix, erro: r.erro, automatico: r.pedidoPorId === REPASSE_AUTOMATICO })),
  };
}

/** Quanto do saldo da conta titular é das OUTRAS escolas (ainda não repassado): a titular não pode sacar isso. */
export async function devidoAOutras(titularSchoolId: string) {
  const [linhas, abertos] = await Promise.all([
    db.cobrancaProvisoria.findMany({ where: { titularSchoolId, status: "pago", origem: { in: ORIGENS }, repasseId: null }, select: { valorLiquido: true } }),
    db.repasseFilial.findMany({ where: { titularSchoolId, status: { in: ["solicitado", "enviado"] } }, select: { valor: true } }),
  ]);
  return r2(linhas.reduce((s, l) => s + dec(l.valorLiquido), 0) + abertos.reduce((s, r) => s + dec(r.valor), 0));
}

// ───────────── Pedido de repasse ─────────────
const STATUS: Record<string, string> = { PENDING: "enviado", BANK_PROCESSING: "enviado", DONE: "concluido", CANCELLED: "falhou", FAILED: "falhou" };

export async function pedirRepasse(m: Pessoa, schoolId: string) {
  if (!(await podeVerFinanceiro(m, schoolId))) throw new Error("Só a direção da filial pede repasse.");
  if (!(await financeiroAberto(m.id))) throw new Error("Digite o PIN de novo.");
  return transferirRepasse(schoolId, m.id);
}

/** Pedido de repasse feito pela rotina (repasse automático), não por uma pessoa. */
export const REPASSE_AUTOMATICO = "automatico";

/** Núcleo do repasse: confere a chave Pix, reserva as cobranças livres e pede a transferência ao Asaas. */
async function transferirRepasse(schoolId: string, pedidoPorId: string, minimo = 1) {
  const chave = await chavePixDaEscola(schoolId);
  if (!chave) throw new Error("Cadastre antes a chave Pix da escola (Saldo e saque → chave Pix).");
  if (!chave.aprovada) throw new Error("A chave Pix da escola ainda espera a aprovação do administrador do Portal.");
  const linhas = await db.cobrancaProvisoria.findMany({ where: { schoolId, status: "pago", origem: { in: ORIGENS }, repasseId: null } });
  if (!linhas.length) throw new Error("Não há valor disponível para repasse.");
  const valor = r2(linhas.reduce((s, l) => s + dec(l.valorLiquido), 0));
  if (valor < minimo) throw new Error(`O valor disponível ainda é menor que ${minimo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
  const titularId = linhas[0].titularSchoolId;
  const titular = await db.school.findUniqueOrThrow({ where: { id: titularId }, select: { asaasSubaccountApiKey: true, name: true } });
  if (!titular.asaasSubaccountApiKey) throw new Error("A conta titular não está ligada ao Portal.");
  const escola = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true } });

  // Reserva as cobranças no repasse antes de transferir (só as que ainda estão livres).
  const repasse = await db.$transaction(async (tx) => {
    const r = await tx.repasseFilial.create({ data: { schoolId, titularSchoolId: titularId, valor, chavePix: chave.chave, tipoChave: chave.tipo, pedidoPorId } });
    const marcadas = await tx.cobrancaProvisoria.updateMany({ where: { id: { in: linhas.map((l) => l.id) }, repasseId: null }, data: { repasseId: r.id } });
    if (marcadas.count !== linhas.length) throw new Error("Outro pedido de repasse acabou de ser feito. Atualize a tela.");
    return r;
  });

  try {
    const res = await fetch(`${BASE()}/transfers`, {
      method: "POST",
      headers: { access_token: titular.asaasSubaccountApiKey, "Content-Type": "application/json", "User-Agent": "portal-na" },
      body: JSON.stringify({ value: valor, operationType: "PIX", pixAddressKey: chave.chave, pixAddressKeyType: chave.tipo, description: `Repasse Portal — ${escola.name}`, externalReference: repasse.id }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = (await res.json().catch(() => ({}))) as { id?: string; status?: string; transferFee?: number; errors?: { description?: string }[] };
    if (!res.ok || !j.id) throw new Error(j.errors?.map((e) => e.description).join("; ") || `HTTP ${res.status}`);
    const tarifa = r2(Number(j.transferFee ?? 0));
    await db.repasseFilial.update({ where: { id: repasse.id }, data: { transferId: j.id, status: STATUS[j.status ?? ""] ?? "enviado", tarifa } });
    // Tarifa da transferência desconta do repasse (decisão do usuário): entra como ajuste no próximo.
    if (tarifa > 0)
      await db.cobrancaProvisoria.create({
        data: { schoolId, titularSchoolId: titularId, origem: "ajuste_tarifa", referenciaId: repasse.id, asaasId: `${j.id}:tarifa`, valorBruto: 0, valorLiquido: -tarifa, status: "pago", pagoEm: new Date() },
      });
    return { valor, tarifa };
  } catch (e) {
    await db.$transaction([
      db.cobrancaProvisoria.updateMany({ where: { repasseId: repasse.id }, data: { repasseId: null } }),
      db.repasseFilial.update({ where: { id: repasse.id }, data: { status: "falhou", erro: (e as Error).message.slice(0, 300) } }),
    ]);
    throw new Error(`O Asaas recusou o repasse: ${(e as Error).message}`);
  }
}

/**
 * Repasse automático (pedido do usuário em 23/11/2026): nos dias 11, 21 e no último dia do mês, a partir das 9h de
 * Brasília, cada escola com valor disponível recebe o repasse na chave Pix dela. Exige a chave Pix cadastrada e liberada;
 * sem ela, a escola fica de fora (o painel avisa) e o valor espera o próximo dia de repasse ou o pedido da direção.
 * Uma tentativa por escola por dia (a rotina roda a cada 10 minutos). Mínimo de R$ 10, para a tarifa não comer o valor.
 */
export async function repassesAutomaticos(agora = new Date()) {
  const sp = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const ultimo = new Date(sp.getFullYear(), sp.getMonth() + 1, 0).getDate();
  if (![11, 21, ultimo].includes(sp.getDate()) || sp.getHours() < 9) return { hoje: false };
  const inicioDoDia = new Date(agora.getTime() - ((sp.getHours() * 60 + sp.getMinutes()) * 60 + sp.getSeconds()) * 1000);
  const escolas = await db.cobrancaProvisoria.groupBy({ by: ["schoolId"], where: { status: "pago", origem: { in: ORIGENS }, repasseId: null } });
  let feitos = 0;
  let semChave = 0;
  const falhas: string[] = [];
  for (const { schoolId } of escolas) {
    const jaHoje = await db.repasseFilial.findFirst({ where: { schoolId, pedidoPorId: REPASSE_AUTOMATICO, createdAt: { gte: inicioDoDia } }, select: { id: true } });
    if (jaHoje) continue;
    const chave = await chavePixDaEscola(schoolId);
    if (!chave?.aprovada) {
      semChave++;
      continue;
    }
    try {
      await transferirRepasse(schoolId, REPASSE_AUTOMATICO, 10);
      feitos++;
    } catch (e) {
      // Valor abaixo do mínimo não é falha: espera o próximo dia de repasse.
      if (!/menor que|Não há valor/.test((e as Error).message)) falhas.push(`${schoolId}: ${(e as Error).message}`);
    }
  }
  return { hoje: true, feitos, semChave, falhas };
}

/** Rotina: atualiza os repasses em andamento; repasse que falhou libera as cobranças para um novo pedido. */
export async function conferirRepasses() {
  const abertos = await db.repasseFilial.findMany({ where: { status: { in: ["enviado", "solicitado"] }, transferId: { not: null } }, take: 50 });
  for (const r of abertos) {
    const t = await db.school.findUnique({ where: { id: r.titularSchoolId }, select: { asaasSubaccountApiKey: true } });
    if (!t?.asaasSubaccountApiKey) continue;
    const res = await fetch(`${BASE()}/transfers/${r.transferId}`, { headers: { access_token: t.asaasSubaccountApiKey, "User-Agent": "portal-na" }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res?.ok) continue;
    const j = (await res.json()) as { status?: string; failReason?: string };
    const novo = STATUS[j.status ?? ""];
    if (!novo || novo === r.status) continue;
    if (novo === "falhou") {
      await db.$transaction([
        db.cobrancaProvisoria.updateMany({ where: { repasseId: r.id }, data: { repasseId: null } }),
        db.repasseFilial.update({ where: { id: r.id }, data: { status: "falhou", erro: (j.failReason ?? "Transferência não concluída.").slice(0, 300) } }),
      ]);
    } else await db.repasseFilial.update({ where: { id: r.id }, data: { status: novo, concluidoEm: novo === "concluido" ? new Date() : null } });
  }
  return { conferidos: abertos.length };
}

/** Webhook de validação de saque: aprova TRANSFER que é um repasse pedido pelo Portal (mesmo valor, última hora). */
export async function repasseDoPortal(valor: number, transferId: string | undefined) {
  const desde = new Date(Date.now() - 60 * 60 * 1000);
  const r = await db.repasseFilial.findFirst({
    where: { createdAt: { gte: desde }, status: { in: ["solicitado", "enviado"] }, valor: new Prisma.Decimal(r2(valor)), ...(transferId ? { OR: [{ transferId }, { transferId: null }] } : {}) },
  });
  return !!r;
}
