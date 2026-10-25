import { db } from "@/lib/db";
import { sqlTexto } from "@/lib/mercurio-db/client";
import { emPaginas } from "@/lib/mercurio-db/resumo-filial";
import type { Escola } from "@/lib/panorama";
import { Prisma } from "@prisma/client";

/**
 * Quem usa e quem não usa o Portal (pedido do usuário 2026-10-25): as pessoas ativas no Mercúrio das filiais
 * escolhidas, separadas por já terem entrado no Portal (login real, auth.users.last_sign_in_at). A matrícula
 * do Mercúrio liga as duas pontas.
 */
export type PessoaUso = { matricula: string; nome: string; nivel: string; filial: string; ultimoAcesso: string | null; notificacoes: boolean };

export async function usoDoPortal(escolas: Escola[]) {
  const unidades = escolas.map((e) => e.unidade).filter(Boolean) as string[];
  const nomeDaUnidade = new Map(escolas.map((e) => [e.unidade, e.nome]));
  const ids = escolas.filter((e) => !e.foraDoPortal).map((e) => e.id);
  const [ativos, entraram, comPush] = await Promise.all([
    unidades.length
      ? emPaginas(`SELECT cad_matr, cad_nome, cad_nivel, cad_unidade FROM cadastro WHERE cad_situacao='ATI' AND cad_unidade IN (${unidades.map(sqlTexto).join(",")}) ORDER BY cad_matr`)
      : Promise.resolve([]),
    ids.length
      ? db.$queryRaw<{ mercurioId: string; ultimo: Date }[]>`SELECT m."mercurioId", u.last_sign_in_at ultimo FROM auth.users u JOIN "Member" m ON m."authUserId" = u.id::text WHERE u.last_sign_in_at IS NOT NULL AND m."mercurioId" IS NOT NULL AND m."schoolId" IN (${Prisma.join(ids)})`
      : Promise.resolve([]),
    ids.length ? db.pushSubscription.findMany({ where: { member: { schoolId: { in: ids } } }, select: { member: { select: { mercurioId: true } } } }) : Promise.resolve([]),
  ]);
  const acesso = new Map(entraram.map((e) => [e.mercurioId, e.ultimo.toISOString()]));
  const notificacoes = new Set(comPush.map((p) => p.member.mercurioId));
  const usando: PessoaUso[] = [];
  const naoUsando: PessoaUso[] = [];
  for (const a of ativos) {
    const matricula = a.cad_matr ?? "";
    const p: PessoaUso = {
      matricula,
      nome: (a.cad_nome ?? "").trim(),
      nivel: a.cad_nivel ?? "",
      filial: nomeDaUnidade.get(a.cad_unidade ?? "") ?? a.cad_unidade ?? "",
      ultimoAcesso: acesso.get(matricula) ?? null,
      notificacoes: notificacoes.has(matricula),
    };
    (p.ultimoAcesso ? usando : naoUsando).push(p);
  }
  const porNome = (x: PessoaUso, y: PessoaUso) => x.nome.localeCompare(y.nome, "pt-BR");
  return { ativos: ativos.length, usando: usando.sort(porNome), naoUsando: naoUsando.sort(porNome) };
}
