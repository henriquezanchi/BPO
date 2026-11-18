import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ehAdministradorNacional, escolasQueLibera } from "@/lib/acesso-voluntario";
import { db } from "@/lib/db";
import { cifrar, decifrar } from "@/lib/segredo-cifrado";
import type { Member } from "@prisma/client";

/**
 * Pesquisa de antecedentes do Instituto Maat sobre os voluntários do Merlin e do Janos (pedido do usuário 18/11/2026).
 * Registro sigiloso: só a DIREÇÃO vê (Chefe e Sub-Chefe da filial, quem chefia outras filiais e a direção nacional),
 * e só depois de digitar a SENHA EXCLUSIVA dela para isso (não é a senha do Portal). A liberação vale 10 minutos,
 * num cookie cifrado. Cada consulta e cada alteração ficam em AcessoAntecedente. Resultado e observação, cifrados.
 * Secretários do programa não veem este registro (veem só a lista de voluntários e a certidão, em infantojuvenil.ts).
 */
const COOKIE = "na_antecedentes";
const VALIDADE_MS = 10 * 60 * 1000;
const MAX_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
export const RESULTADOS = { nada_consta: "Nada consta", em_analise: "Em análise", restricao: "Com restrição" } as const;
export type Resultado = keyof typeof RESULTADOS;

type Pessoa = Pick<Member, "id" | "schoolId" | "isDiretor" | "isSubChefe" | "filiaisChefiadas" | "mercurioId">;

/** Filiais em que a pessoa é direção; null = todas (direção nacional); [] = nenhuma. */
export async function escolasDaDirecao(m: Pessoa): Promise<string[] | null> {
  if (await ehAdministradorNacional(m)) return null;
  return escolasQueLibera(m);
}

export async function temSenha(memberId: string) {
  return !!(await db.senhaAntecedentes.findUnique({ where: { memberId }, select: { memberId: true } }));
}

const gerarHash = (senha: string) => {
  const sal = randomBytes(16);
  return `${sal.toString("base64")}:${scryptSync(senha, sal, 64).toString("base64")}`;
};
const confere = (senha: string, guardado: string) => {
  const [sal, hash] = guardado.split(":");
  const calc = scryptSync(senha, Buffer.from(sal, "base64"), 64);
  const esp = Buffer.from(hash, "base64");
  return calc.length === esp.length && timingSafeEqual(calc, esp);
};

export function validarNovaSenha(senha: string) {
  if (senha.length < 8) return "A senha precisa de pelo menos 8 caracteres.";
  if (!/\d/.test(senha) || !/[a-zA-Z]/.test(senha)) return "Use letras e números.";
  return null;
}

export async function definirSenha(memberId: string, senha: string, senhaAtual?: string) {
  const atual = await db.senhaAntecedentes.findUnique({ where: { memberId } });
  if (atual && !(senhaAtual && confere(senhaAtual, atual.hash))) throw new Error("A senha atual não confere.");
  const erro = validarNovaSenha(senha);
  if (erro) throw new Error(erro);
  await db.senhaAntecedentes.upsert({ where: { memberId }, update: { hash: gerarHash(senha), falhas: 0, bloqueadoAte: null }, create: { memberId, hash: gerarHash(senha) } });
  await db.acessoAntecedente.create({ data: { diretorId: memberId, acao: atual ? "trocou_senha" : "criou_senha" } });
}

/** Confere a senha exclusiva e libera por 10 minutos. Bloqueia 15 minutos depois de 5 erros. */
export async function liberar(memberId: string, senha: string) {
  const s = await db.senhaAntecedentes.findUnique({ where: { memberId } });
  if (!s) throw new Error("Crie antes a sua senha exclusiva.");
  if (s.bloqueadoAte && s.bloqueadoAte > new Date()) throw new Error("Muitas tentativas. Tente de novo em alguns minutos.");
  if (!confere(senha, s.hash)) {
    const falhas = s.falhas + 1;
    await db.senhaAntecedentes.update({ where: { memberId }, data: { falhas: falhas >= MAX_FALHAS ? 0 : falhas, bloqueadoAte: falhas >= MAX_FALHAS ? new Date(Date.now() + BLOQUEIO_MS) : null } });
    await db.acessoAntecedente.create({ data: { diretorId: memberId, acao: "senha_errada" } });
    throw new Error("Senha incorreta.");
  }
  await db.senhaAntecedentes.update({ where: { memberId }, data: { falhas: 0, bloqueadoAte: null } });
  await db.acessoAntecedente.create({ data: { diretorId: memberId, acao: "liberou" } });
  (await cookies()).set(COOKIE, cifrar(JSON.stringify({ memberId, ate: Date.now() + VALIDADE_MS }), "antecedentes-sessao"), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/voluntario/merlin-janos",
    maxAge: VALIDADE_MS / 1000,
  });
}

export async function bloquear() {
  (await cookies()).set(COOKIE, "", { path: "/voluntario/merlin-janos", maxAge: 0 });
}

/** A liberação de 10 minutos ainda vale para esta pessoa? */
export async function estaLiberado(memberId: string) {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  try {
    const d = JSON.parse(decifrar(v, "antecedentes-sessao")) as { memberId: string; ate: number };
    return d.memberId === memberId && d.ate > Date.now();
  } catch {
    return false;
  }
}

export type AntecedenteView = {
  memberId: string;
  nome: string;
  matricula: string | null;
  programa: string;
  schoolId: string;
  registro: { resultado: Resultado; pesquisadoEm: string | null; validade: string | null; obs: string | null; atualizadoEm: string } | null;
};

/** Voluntários dos programas nas filiais da direção, com o registro do Maat. Registra a consulta. */
export async function listarAntecedentes(m: Pessoa): Promise<AntecedenteView[]> {
  const escolas = await escolasDaDirecao(m);
  if (escolas && !escolas.length) return [];
  if (!(await estaLiberado(m.id))) throw new Error("Digite a senha exclusiva para ver os antecedentes.");
  const voluntarios = await db.voluntarioInfantojuvenil.findMany({ where: escolas ? { schoolId: { in: escolas } } : {}, orderBy: { createdAt: "asc" } });
  const ids = [...new Set(voluntarios.map((v) => v.memberId))];
  const [pessoas, registros] = await Promise.all([
    db.member.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, mercurioId: true } }),
    db.antecedenteVoluntario.findMany({ where: { memberId: { in: ids } } }),
  ]);
  await db.acessoAntecedente.create({ data: { diretorId: m.id, acao: "consultou_lista" } });
  const dia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return ids
    .map((id) => {
      const p = pessoas.find((x) => x.id === id);
      const vs = voluntarios.filter((v) => v.memberId === id);
      const r = registros.find((x) => x.memberId === id);
      return {
        memberId: id,
        nome: p?.name ?? "—",
        matricula: p?.mercurioId ?? null,
        programa: vs.map((v) => v.programa).join(" e "),
        schoolId: vs[0].schoolId,
        registro: r
          ? { resultado: decifrar(r.resultadoCifrado, "antecedentes") as Resultado, pesquisadoEm: dia(r.pesquisadoEm), validade: dia(r.validade), obs: r.obsCifrada ? decifrar(r.obsCifrada, "antecedentes") : null, atualizadoEm: r.updatedAt.toISOString() }
          : null,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function registrarAntecedente(m: Pessoa, d: { memberId: string; resultado: Resultado; pesquisadoEm: string | null; validade: string | null; obs: string | null }) {
  const escolas = await escolasDaDirecao(m);
  if (!(await estaLiberado(m.id))) throw new Error("A liberação expirou. Digite a senha exclusiva de novo.");
  if (!(d.resultado in RESULTADOS)) throw new Error("Resultado inválido.");
  const vol = await db.voluntarioInfantojuvenil.findFirst({ where: { memberId: d.memberId, ...(escolas ? { schoolId: { in: escolas } } : {}) } });
  if (!vol) throw new Error("Esta pessoa não é voluntária dos programas numa filial da sua direção.");
  const data = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : null);
  const campos = {
    resultadoCifrado: cifrar(d.resultado, "antecedentes"),
    pesquisadoEm: data(d.pesquisadoEm),
    validade: data(d.validade),
    obsCifrada: d.obs?.trim() ? cifrar(d.obs.trim().slice(0, 1000), "antecedentes") : null,
    registradoPorId: m.id,
  };
  await db.antecedenteVoluntario.upsert({ where: { memberId: d.memberId }, update: campos, create: { memberId: d.memberId, schoolId: vol.schoolId, ...campos } });
  await db.acessoAntecedente.create({ data: { diretorId: m.id, memberId: d.memberId, acao: "registrou" } });
}
