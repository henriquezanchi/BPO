import { db } from "@/lib/db";
import { ehAdministradorNacional, escolasQueLibera } from "@/lib/acesso-voluntario";
import { escolasDoTerritorio, territorioDoMandato } from "@/lib/secretarias-rede/regras";
import type { Member } from "@prisma/client";
import {
  PROGRAMAS,
  direcaoPorFuncao,
  programasNaEscola,
  programasNoTexto,
  situacaoDaCertidao,
  type AcessoInfantojuvenil,
  type Programa,
  type Situacao,
} from "./infantojuvenil-comum";

/**
 * Voluntários do Merlin e do Janos (pedido do usuário 09/11/2026). Marcação discreta: não aparece no perfil, na
 * carteirinha nem em listas públicas. Quem vê e edita, sempre reconferido no servidor:
 *  - Chefe e Sub-Chefe de Filial (e quem chefia outras filiais): os dois programas da(s) filial(is);
 *  - secretário(a), pró ou sub-secretário(a) do programa pela função no Mercúrio: aquele programa, na própria filial;
 *  - função nacional do programa no Mercúrio, ou mandato de secretaria do programa na rede (nacional, regional ou
 *    local): aquele programa no território do mandato;
 *  - administração nacional: tudo.
 */
type Pessoa = Pick<Member, "id" | "schoolId" | "isDiretor" | "isSubChefe" | "filiaisChefiadas" | "mercurioId" | "cargos">;

export async function acessoInfantojuvenil(m: Pessoa): Promise<AcessoInfantojuvenil> {
  if (await ehAdministradorNacional(m)) return { todas: [...PROGRAMAS], porEscola: {} };
  const acesso: AcessoInfantojuvenil = { todas: [], porEscola: {} };
  const dar = (schoolId: string, ps: Programa[]) => {
    acesso.porEscola[schoolId] = [...new Set([...(acesso.porEscola[schoolId] ?? []), ...ps])];
  };
  for (const id of await escolasQueLibera(m)) dar(id, [...PROGRAMAS]);
  for (const f of direcaoPorFuncao(m.cargos)) {
    if (f.nacional) acesso.todas = [...new Set([...acesso.todas, f.programa])];
    else dar(m.schoolId, [f.programa]);
  }
  const mandatos = (await db.secretariaMandato.findMany({ where: { memberId: m.id, ativo: true } })).filter((x) => programasNoTexto(x.secretaria).length);
  if (mandatos.length) {
    const escolas = await db.school.findMany({ select: { id: true, name: true, city: true, uf: true } });
    for (const x of mandatos) {
      const ps = programasNoTexto(x.secretaria);
      if (x.escopo === "nacional") acesso.todas = [...new Set([...acesso.todas, ...ps])];
      else for (const e of escolasDoTerritorio(escolas, territorioDoMandato(x))) dar(e.id, ps);
    }
  }
  return acesso;
}

/** Condição do Prisma para os registros que a pessoa pode ver. */
function ondeVe(a: AcessoInfantojuvenil) {
  const ou: { programa: { in: Programa[] }; schoolId?: string }[] = [];
  if (a.todas.length) ou.push({ programa: { in: a.todas } });
  for (const [schoolId, ps] of Object.entries(a.porEscola)) if (ps.length) ou.push({ schoolId, programa: { in: ps } });
  return ou.length ? { OR: ou } : { id: "__nenhum__" };
}

/** Escolas (ids) em que a pessoa pode marcar alguém, ou null quando vale para todas. */
function escolasDoAcesso(a: AcessoInfantojuvenil): string[] | null {
  if (a.todas.length) return null;
  return Object.entries(a.porEscola).filter(([, ps]) => ps.length).map(([id]) => id);
}

export type RegistroInfantojuvenil = {
  id: string;
  memberId: string;
  nome: string;
  matricula: string | null;
  filial: string;
  programa: Programa;
  certidaoEm: string | null;
  certidaoValidade: string | null;
  certidaoOrgao: string | null;
  observacao: string | null;
  situacao: Situacao;
  ativo: boolean;
};

const dataIso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function listarInfantojuvenil(a: AcessoInfantojuvenil, hoje = new Date()): Promise<RegistroInfantojuvenil[]> {
  const regs = await db.voluntarioInfantojuvenil.findMany({ where: ondeVe(a) });
  if (!regs.length) return [];
  const [membros, escolas] = await Promise.all([
    db.member.findMany({ where: { id: { in: regs.map((r) => r.memberId) } }, select: { id: true, name: true, mercurioId: true, mercurioAtivo: true } }),
    db.school.findMany({ where: { id: { in: [...new Set(regs.map((r) => r.schoolId))] } }, select: { id: true, name: true, city: true } }),
  ]);
  const pm = new Map(membros.map((x) => [x.id, x]));
  const pe = new Map(escolas.map((x) => [x.id, x.city ?? x.name]));
  return regs
    .map((r) => {
      const p = pm.get(r.memberId);
      return {
        id: r.id,
        memberId: r.memberId,
        nome: p?.name ?? "(cadastro removido)",
        matricula: p?.mercurioId ?? null,
        filial: pe.get(r.schoolId) ?? "",
        programa: r.programa as Programa,
        certidaoEm: dataIso(r.certidaoEm),
        certidaoValidade: dataIso(r.certidaoValidade),
        certidaoOrgao: r.certidaoOrgao,
        observacao: r.observacao,
        situacao: situacaoDaCertidao(r.certidaoValidade, hoje),
        ativo: p?.mercurioAtivo ?? false,
      };
    })
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR", { sensitivity: "base" }));
}

/** Pendências (vencidas, vencendo e sem certidão) para o número no menu. */
export async function pendenciasInfantojuvenil(a: AcessoInfantojuvenil, hoje = new Date()): Promise<number> {
  const regs = await db.voluntarioInfantojuvenil.findMany({ where: ondeVe(a), select: { certidaoValidade: true } });
  return regs.filter((r) => situacaoDaCertidao(r.certidaoValidade, hoje) !== "emDia").length;
}

/** Quem tem função do programa no Mercúrio e ainda não foi marcado: sugestões para a direção confirmar. */
export async function sugestoesInfantojuvenil(a: AcessoInfantojuvenil) {
  const escolas = escolasDoAcesso(a);
  const pessoas = await db.member.findMany({
    where: { mercurioAtivo: true, cargos: { isEmpty: false }, ...(escolas ? { schoolId: { in: escolas } } : {}) },
    select: { id: true, name: true, schoolId: true, cargos: true, school: { select: { city: true, name: true } } },
  });
  const ja = new Set(
    (await db.voluntarioInfantojuvenil.findMany({ where: { memberId: { in: pessoas.map((p) => p.id) } }, select: { memberId: true, programa: true } })).map(
      (r) => `${r.memberId}:${r.programa}`,
    ),
  );
  const r: { memberId: string; nome: string; filial: string; programa: Programa; funcao: string }[] = [];
  for (const p of pessoas) {
    const pode = programasNaEscola(a, p.schoolId);
    for (const c of p.cargos)
      for (const programa of programasNoTexto(c))
        if (pode.includes(programa) && !ja.has(`${p.id}:${programa}`) && !r.some((x) => x.memberId === p.id && x.programa === programa))
          r.push({ memberId: p.id, nome: p.name, filial: p.school.city ?? p.school.name, programa, funcao: c });
  }
  return r.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR", { sensitivity: "base" }));
}

/** Busca de pessoas ativas para marcar, só nas filiais do acesso (nome ou matrícula, a partir de 3 caracteres). */
export async function buscarPessoasInfantojuvenil(a: AcessoInfantojuvenil, termo: string) {
  const q = termo.trim();
  if (q.length < 3) return [];
  const escolas = escolasDoAcesso(a);
  const pessoas = await db.member.findMany({
    where: {
      mercurioAtivo: true,
      ...(escolas ? { schoolId: { in: escolas } } : {}),
      OR: [{ name: { contains: q, mode: "insensitive" } }, ...(/^\d+$/.test(q) ? [{ mercurioId: q }] : [])],
    },
    select: { id: true, name: true, mercurioId: true, schoolId: true, school: { select: { city: true, name: true } } },
    orderBy: { name: "asc" },
    take: 15,
  });
  return pessoas
    .map((p) => ({ memberId: p.id, nome: p.name, matricula: p.mercurioId, filial: p.school.city ?? p.school.name, programas: programasNaEscola(a, p.schoolId) }))
    .filter((p) => p.programas.length);
}
