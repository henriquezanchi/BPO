import { Prisma } from "@prisma/client";
import { type AsaasSplit, type ContaAsaas } from "@/lib/asaas/client";
import { ContaEscolaPendente, contaDeLeituraId, subcontaAprovada } from "@/lib/asaas/conta-escola";
import { db } from "@/lib/db";
import { configCobranca } from "@/lib/spread";

/**
 * Conta provisória (autorizada pelo responsável pela contabilidade nacional em 23/11/2026): enquanto uma escola do
 * piloto não tem a própria conta Asaas aprovada, ela cobra pela conta de Barra do Garças (a "titular"), e o valor dela
 * é repassado depois (lib/repasses.ts). Vale para tudo: contribuição, débito automático, eventos e recarga do Fortuna.
 *
 * Cada cobrança feita assim fica em CobrancaProvisoria: de qual escola é, por qual conta saiu (para ler, estornar e
 * cancelar com a chave certa) e quanto é líquido da escola (valor − taxa do Asaas − spread do BPO). Quando a escola
 * tiver a conta aprovada, as cobranças NOVAS passam sozinhas para a conta dela; as antigas continuam na titular.
 *
 * Titular: CONTA_PROVISORIA_TITULAR (sigla do Mercúrio; padrão BGA). Escopo: as escolas do piloto (lib/spread.ts).
 */
const TITULAR = () => (process.env.CONTA_PROVISORIA_TITULAR ?? "BGA").toUpperCase();
export type Provisoria = { titularSchoolId: string } | null;

async function titular() {
  return db.school.findFirst({ where: { mercurioUnidade: TITULAR() }, select: { id: true, asaasSubaccountApiKey: true } });
}

/** Conta para EMITIR uma cobrança da escola: a própria (ligada e aprovada) ou, no piloto, a titular. */
export async function contaParaCobrar(schoolId: string): Promise<{ conta: ContaAsaas; provisoria: Provisoria }> {
  const escola = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { asaasSubaccountApiKey: true, mercurioUnidade: true } });
  if (escola.asaasSubaccountApiKey && (await subcontaAprovada(escola.asaasSubaccountApiKey))) return { conta: { apiKey: escola.asaasSubaccountApiKey }, provisoria: null };
  const { escopo } = await configCobranca();
  const t = await titular();
  if (t && t.id !== schoolId && t.asaasSubaccountApiKey && escola.mercurioUnidade && escopo.includes(escola.mercurioUnidade) && (await subcontaAprovada(t.asaasSubaccountApiKey)))
    return { conta: { apiKey: t.asaasSubaccountApiKey }, provisoria: { titularSchoolId: t.id } };
  // A própria titular ainda em aprovação, ou escola fora do piloto: como antes (a chave própria decide ou recusa).
  if (escola.asaasSubaccountApiKey) return { conta: { apiKey: escola.asaasSubaccountApiKey }, provisoria: null };
  throw new ContaEscolaPendente();
}

/** A escola recebe pelo Portal agora (conta própria aprovada ou provisória)? */
export async function recebeOnline(schoolId: string) {
  return contaParaCobrar(schoolId).then(
    () => true,
    () => false,
  );
}

export async function escolasQueRecebem(schoolIds: string[]) {
  const ok = await Promise.all([...new Set(schoolIds)].map(async (id) => ((await recebeOnline(id)) ? id : null)));
  return new Set(ok.filter((x): x is string => !!x));
}

export const somaSplit = (split: AsaasSplit[]) => Math.round(split.reduce((s, x) => s + Number((x as { fixedValue?: number }).fixedValue ?? 0), 0) * 100) / 100;

/** Registra uma cobrança feita pela conta titular em nome da escola. Idempotente pelo id do Asaas. */
export async function registrarProvisoria(d: {
  provisoria: Provisoria;
  schoolId: string;
  origem: "contribuicao" | "evento" | "fortuna" | "autorizacao_pix";
  referenciaId?: string | null;
  memberId?: string | null;
  asaasId: string;
  valorBruto: number;
  splitBpo?: number;
}) {
  if (!d.provisoria) return;
  await db.cobrancaProvisoria.upsert({
    where: { asaasId: d.asaasId },
    update: {},
    create: {
      schoolId: d.schoolId,
      titularSchoolId: d.provisoria.titularSchoolId,
      origem: d.origem,
      referenciaId: d.referenciaId ?? null,
      memberId: d.memberId ?? null,
      asaasId: d.asaasId,
      valorBruto: d.valorBruto,
      splitBpo: d.splitBpo ?? 0,
    },
  });
}

/** Conta para LER, estornar ou cancelar um pagamento (ou autorização) já emitido: a titular, se foi provisório. */
export async function contaDoPagamento(asaasId: string | null | undefined, schoolId: string | null | undefined): Promise<ContaAsaas | undefined> {
  if (asaasId) {
    const p = await db.cobrancaProvisoria.findUnique({ where: { asaasId }, select: { titularSchoolId: true } });
    if (p) {
      const t = await db.school.findUnique({ where: { id: p.titularSchoolId }, select: { asaasSubaccountApiKey: true } });
      if (t?.asaasSubaccountApiKey) return { apiKey: t.asaasSubaccountApiKey };
    }
  }
  return contaDeLeituraId(schoolId);
}

const BASE = () => (process.env.ASAAS_ENV === "sandbox" ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3");

/**
 * Atualiza a cobrança provisória com o que o Asaas diz: pago (com taxa e líquido reais), cancelado ou estornado.
 * Estorno depois do repasse vira um ajuste negativo, descontado no próximo repasse. Sem registro, não faz nada.
 */
export async function conferirProvisoria(asaasId: string) {
  const p = await db.cobrancaProvisoria.findUnique({ where: { asaasId } });
  if (!p || p.origem === "autorizacao_pix") return null;
  const conta = await contaDoPagamento(asaasId, p.schoolId);
  if (!conta) return null;
  const r = await fetch(`${BASE()}/payments/${asaasId}`, { headers: { access_token: conta.apiKey, "User-Agent": "portal-na" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!r.ok) return null;
  const pg = (await r.json()) as { status: string; value: number; netValue?: number; paymentDate?: string | null; clientPaymentDate?: string | null; deleted?: boolean };
  const pago = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(pg.status);
  const estornado = ["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(pg.status);
  if (pago && p.status !== "pago") {
    const liquidoAsaas = typeof pg.netValue === "number" ? pg.netValue : pg.value;
    const taxa = Math.round((pg.value - liquidoAsaas) * 100) / 100;
    const liquido = Math.round((liquidoAsaas - Number(p.splitBpo)) * 100) / 100;
    return db.cobrancaProvisoria.update({
      where: { id: p.id },
      data: { status: "pago", valorBruto: pg.value, taxaAsaas: taxa, valorLiquido: liquido, pagoEm: new Date(pg.paymentDate ?? pg.clientPaymentDate ?? Date.now()) },
    });
  }
  if (estornado && p.status === "pago") {
    if (p.repasseId) {
      // Já repassado: o valor volta como débito no próximo repasse.
      await db.cobrancaProvisoria.upsert({
        where: { asaasId: `${asaasId}:estorno` },
        update: {},
        create: { schoolId: p.schoolId, titularSchoolId: p.titularSchoolId, origem: "ajuste_estorno", referenciaId: p.id, memberId: p.memberId, asaasId: `${asaasId}:estorno`, valorBruto: 0, valorLiquido: new Prisma.Decimal(p.valorLiquido ?? 0).neg(), status: "pago", pagoEm: new Date() },
      });
    }
    return db.cobrancaProvisoria.update({ where: { id: p.id }, data: { status: "estornado" } });
  }
  if ((pg.deleted || pg.status === "CANCELLED") && p.status === "pendente") return db.cobrancaProvisoria.update({ where: { id: p.id }, data: { status: "cancelado" } });
  return p;
}

/** Rotina: confere as provisórias pendentes (pagamento que o webhook não avisou) e as pagas recentes (estornos). */
export async function conferirProvisoriasPendentes(limite = 60) {
  const pendentes = await db.cobrancaProvisoria.findMany({
    where: { origem: { in: ["contribuicao", "evento", "fortuna"] }, OR: [{ status: "pendente" }, { status: "pago", pagoEm: { gte: new Date(Date.now() - 30 * 864e5) } }] },
    orderBy: { updatedAt: "asc" },
    take: limite,
    select: { asaasId: true },
  });
  let mudaram = 0;
  for (const p of pendentes) {
    const antes = await db.cobrancaProvisoria.findUnique({ where: { asaasId: p.asaasId }, select: { status: true } });
    const depois = await conferirProvisoria(p.asaasId).catch(() => null);
    if (depois && depois.status !== antes?.status) mudaram++;
  }
  return { conferidas: pendentes.length, mudaram };
}

/**
 * Pagamento pelo Portal liberado na filial: escrita no Mercúrio ligada (School.mercurioEscrita) OU filial do piloto
 * (23/11/2026). No piloto, o lançamento que o robô não conseguir fazer no Mercúrio vira pendência para a Economia
 * (Economia → Cobrança on-line → "Já lancei no Mercúrio").
 */
export async function pagamentoLiberado(school: { mercurioEscrita: boolean; mercurioUnidade: string | null }) {
  if (school.mercurioEscrita) return true;
  return !!school.mercurioUnidade && (await configCobranca()).escopo.includes(school.mercurioUnidade);
}

export async function exigirPagamentoLiberado(member: { school: { mercurioEscrita: boolean; mercurioUnidade: string | null } }) {
  if (!(await pagamentoLiberado(member.school))) throw new Error("Pagamentos e alterações pelo Portal chegam em breve à sua filial. Por enquanto, fale com a secretaria.");
}
