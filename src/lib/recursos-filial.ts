import { ehAdministradorNacional, escolasChefiadas } from "@/lib/acesso-voluntario";
import { db } from "@/lib/db";
import { ehDonoDoSistema } from "@/lib/dono-do-sistema";
import type { Member } from "@prisma/client";

/**
 * Recursos do Portal do Aluno que a filial libera (pedido do usuário
 * 2026-10-19): painéis sem função real ficam ocultos até um administrador
 * da filial ligar. Tudo começa desligado.
 */
export const RECURSOS = {
  voluntariado: { nome: "Voluntariado", descricao: "Quadrinho onde o aluno se oferece para ajudar em secretarias." },
  gaf: { nome: "GAF", descricao: "Quadrinho do Grupo de Acompanhamento Filosófico (pedido de adesão)." },
  acropole_play: { nome: "Acrópole Play", descricao: "Atalho para a Acrópole Play na Área de Estudos." },
  apostilas: { nome: "Apostilas", descricao: "Botão de apostilas na Área de Estudos (ainda sem conteúdo)." },
  // oculto (25/11/2026, pedido do usuário): ainda em construção; some do Portal inteiro (aluno, administração da
  // filial, busca e Central de Ajuda) até ficar pronta. Para reativar, basta tirar o `oculto`.
  transparencia: { nome: "Transparência financeira", descricao: "Quadrinho com receitas e despesas da filial.", oculto: true },
} as const;

/** Recursos escondidos do Portal inteiro enquanto não ficam prontos. */
export const RECURSOS_OCULTOS = new Set<ChaveRecurso>(
  (Object.entries(RECURSOS) as [ChaveRecurso, { oculto?: boolean }][]).filter(([, r]) => r.oculto).map(([k]) => k),
);

export type ChaveRecurso = keyof typeof RECURSOS;

export async function recursosDaFilial(schoolId: string): Promise<Record<ChaveRecurso, boolean>> {
  const ativos = await db.recursoFilial.findMany({ where: { schoolId, ativo: true }, select: { chave: true } });
  const ligados = new Set(ativos.map((a) => a.chave));
  return Object.fromEntries(Object.keys(RECURSOS).map((k) => [k, ligados.has(k) && !RECURSOS_OCULTOS.has(k as ChaveRecurso)])) as Record<ChaveRecurso, boolean>;
}

type Pessoa = Pick<Member, "id" | "schoolId" | "isDiretor" | "isSubChefe" | "filiaisChefiadas" | "mercurioId" | "mercurioAtivo">;

/** 25/11/2026: quem saiu da escola (mercurioAtivo=false, ver auth.ts) perde os poderes de direção/administração; o dono do sistema não. */
const semPoder = (m: Pessoa) => !m.mercurioAtivo && !ehDonoDoSistema(m);

/** Chefe ou Sub-Chefe da filial (ou administração nacional): administra e escolhe administradores. */
export async function ehDirecaoDaFilial(m: Pessoa, schoolId: string): Promise<boolean> {
  if (semPoder(m)) return false;
  if ((await escolasChefiadas(m)).includes(schoolId)) return true;
  return m.isSubChefe && m.schoolId === schoolId;
}

/** Filiais que a pessoa administra no Portal (direção + designados). */
export async function filiaisAdministradas(m: Pessoa): Promise<string[]> {
  if (semPoder(m)) return [];
  const ids = new Set(await escolasChefiadas(m));
  // Sub-chefe administra a própria filial, salvo se o chefe retirou esse acesso.
  if (m.isSubChefe && !(await db.acessoRetiradoSubchefe.count({ where: { schoolId: m.schoolId, memberId: m.id, area: "admin" } }))) ids.add(m.schoolId);
  for (const a of await db.administradorFilial.findMany({ where: { memberId: m.id }, select: { schoolId: true } })) ids.add(a.schoolId);
  return [...ids];
}

export async function podeAdministrar(m: Pessoa, schoolId: string) {
  return (await filiaisAdministradas(m)).includes(schoolId);
}

export { ehAdministradorNacional };
