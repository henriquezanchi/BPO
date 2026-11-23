import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { consultarMercurio, sqlTexto } from "@/lib/mercurio-db/client";
import { cifrar, decifrar } from "@/lib/segredo-cifrado";

/**
 * Quiosque da lanchonete (pedido do usuário em 23/11/2026): um computador ou tablet da escola, sempre aberto em
 * /quiosque, onde cada aluno marca o que pegou e paga com o saldo do Fortuna.
 *
 *  - O APARELHO é autorizado por alguém da área do Café (Área do Voluntário → Café → "Usar este aparelho como
 *    quiosque"): recebe um cookie cifrado com a escola e o caixa do Fortuna, por 180 dias. A lista de aparelhos fica em
 *    ResumoNacional "quiosques:<schoolId>" e cada um pode ser desligado a qualquer momento.
 *  - O ALUNO procura o próprio nome (só alunos ativos da escola com conta no Fortuna) e confirma com os 4 primeiros
 *    dígitos do CPF, conferidos no cadastro do Mercúrio, só no servidor. 5 erros seguidos bloqueiam o nome por 15 min.
 *  - Confirmado, o aluno ganha uma sessão de 3 minutos, só para comprar neste aparelho. O quiosque volta sozinho
 *    para o começo depois da compra ou de 1 minuto parado.
 */
const COOKIE = "na_quiosque";
const FIN_APARELHO = "quiosque-aparelho";
const FIN_ESCOLHA = "quiosque-escolha";
const FIN_SESSAO = "quiosque-sessao";
const SESSAO_MS = 3 * 60 * 1000;
const ESCOLHA_MS = 5 * 60 * 1000;
const MAX_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

export type Aparelho = { id: string; schoolId: string; cashierId: number };
type Registro = { id: string; cashierId: number; nome: string; ativadoPor: string; em: string; desligado?: boolean };

const chaveLista = (schoolId: string) => `quiosques:${schoolId}`;
async function lista(schoolId: string): Promise<Registro[]> {
  const l = await db.resumoNacional.findUnique({ where: { chave: chaveLista(schoolId) } });
  return ((l?.dados as { aparelhos?: Registro[] } | null)?.aparelhos ?? []) as Registro[];
}
async function gravarLista(schoolId: string, aparelhos: Registro[]) {
  await db.resumoNacional.upsert({ where: { chave: chaveLista(schoolId) }, update: { dados: { aparelhos }, geradoEm: new Date() }, create: { chave: chaveLista(schoolId), dados: { aparelhos } } });
}

export async function ativarAparelho(d: { schoolId: string; cashierId: number; nome: string; ativadoPor: string }) {
  const id = randomUUID();
  await gravarLista(d.schoolId, [...(await lista(d.schoolId)), { id, cashierId: d.cashierId, nome: d.nome.slice(0, 60), ativadoPor: d.ativadoPor, em: new Date().toISOString() }]);
  (await cookies()).set(COOKIE, cifrar(JSON.stringify({ id, schoolId: d.schoolId, cashierId: d.cashierId }), FIN_APARELHO), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 180 * 24 * 60 * 60,
  });
  return id;
}

export async function desligarAparelho(schoolId: string, id: string) {
  await gravarLista(schoolId, (await lista(schoolId)).map((a) => (a.id === id ? { ...a, desligado: true } : a)));
}

export async function aparelhosDaEscola(schoolId: string) {
  return (await lista(schoolId)).filter((a) => !a.desligado);
}

/** Aparelho deste navegador, se for um quiosque autorizado e ainda ligado. */
export async function aparelhoAtual(): Promise<Aparelho | null> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return null;
  try {
    const a = JSON.parse(decifrar(v, FIN_APARELHO)) as Aparelho;
    const reg = (await lista(a.schoolId)).find((r) => r.id === a.id);
    return reg && !reg.desligado ? a : null;
  } catch {
    return null;
  }
}

/** Busca por nome (3 letras ou mais), só na escola do quiosque, só quem pode comprar. Devolve uma referência cifrada. */
export async function buscarAlunos(a: Aparelho, texto: string) {
  const termo = texto.trim().replace(/\s+/g, " ");
  if (termo.length < 3) return [];
  const partes = termo.split(" ").filter(Boolean).slice(0, 4);
  const achados = await db.member.findMany({
    where: { schoolId: a.schoolId, mercurioAtivo: true, fortunaClientId: { not: null }, AND: partes.map((p) => ({ name: { contains: p, mode: "insensitive" as const } })) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 8,
  });
  const ate = Date.now() + ESCOLHA_MS;
  return achados.map((m) => ({ nome: m.name, ref: cifrar(JSON.stringify({ memberId: m.id, aparelho: a.id, ate }), FIN_ESCOLHA) }));
}

const chaveFalhas = (memberId: string) => `quiosque-falhas:${memberId}`;

/** Confere os 4 primeiros dígitos do CPF (cadastro do Mercúrio) e abre a sessão de compra de 3 minutos. */
export async function confirmarAluno(a: Aparelho, ref: string, digitos: string) {
  let escolha: { memberId: string; aparelho: string; ate: number };
  try {
    escolha = JSON.parse(decifrar(ref, FIN_ESCOLHA));
  } catch {
    throw new Error("Escolha o seu nome de novo.");
  }
  if (escolha.aparelho !== a.id || escolha.ate < Date.now()) throw new Error("Escolha o seu nome de novo.");
  if (!/^\d{4}$/.test(digitos)) throw new Error("Digite os 4 primeiros números do seu CPF.");

  const m = await db.member.findFirst({ where: { id: escolha.memberId, schoolId: a.schoolId, mercurioAtivo: true }, select: { id: true, name: true, mercurioId: true, fortunaClientId: true } });
  if (!m?.fortunaClientId || !m.mercurioId) throw new Error("Este cadastro não pode comprar aqui. Fale com o responsável pela lanchonete.");

  const linha = await db.resumoNacional.findUnique({ where: { chave: chaveFalhas(m.id) } });
  const f = (linha?.dados as { n?: number; ate?: number } | null) ?? {};
  if (f.ate && f.ate > Date.now()) throw new Error("Muitas tentativas erradas. Tente de novo em alguns minutos ou fale com o responsável pela lanchonete.");

  const [cad] = await consultarMercurio(`SELECT cad_cpf FROM cadastro WHERE cad_matr=${sqlTexto(m.mercurioId)}`);
  const cpf = String(cad?.cad_cpf ?? "").replace(/\D/g, "").padStart(11, "0");
  if (!/^\d{11}$/.test(cpf) || /^0+$/.test(cpf)) throw new Error("Seu CPF não está no cadastro da escola. Fale com a secretaria.");

  if (cpf.slice(0, 4) !== digitos) {
    const n = (f.n ?? 0) + 1;
    const dados = n >= MAX_FALHAS ? { n: 0, ate: Date.now() + BLOQUEIO_MS } : { n };
    await db.resumoNacional.upsert({ where: { chave: chaveFalhas(m.id) }, update: { dados, geradoEm: new Date() }, create: { chave: chaveFalhas(m.id), dados } });
    throw new Error(n >= MAX_FALHAS ? "Muitas tentativas erradas. Este nome fica bloqueado por 15 minutos." : "Os números não conferem. Confira e tente de novo.");
  }
  if (linha) await db.resumoNacional.delete({ where: { chave: chaveFalhas(m.id) } }).catch(() => null);

  const sessao = cifrar(JSON.stringify({ memberId: m.id, aparelho: a.id, ate: Date.now() + SESSAO_MS }), FIN_SESSAO);
  return { sessao, nome: m.name, fortunaClientId: m.fortunaClientId };
}

/** Pessoa da sessão de compra do quiosque (ou erro, se expirou ou é de outro aparelho). */
export async function alunoDaSessao(a: Aparelho, sessao: string) {
  let s: { memberId: string; aparelho: string; ate: number };
  try {
    s = JSON.parse(decifrar(sessao, FIN_SESSAO));
  } catch {
    throw new Error("Tempo esgotado. Escolha o seu nome de novo.");
  }
  if (s.aparelho !== a.id || s.ate < Date.now()) throw new Error("Tempo esgotado. Escolha o seu nome de novo.");
  const m = await db.member.findFirst({ where: { id: s.memberId, schoolId: a.schoolId, mercurioAtivo: true }, select: { id: true, name: true, fortunaClientId: true } });
  if (!m?.fortunaClientId) throw new Error("Este cadastro não pode comprar aqui.");
  return m as { id: string; name: string; fortunaClientId: number };
}
