import { EscalaPedagogos, type ApresentacaoView } from "@/components/grupos/escala-pedagogos";
import { fusoDaEscola } from "@/lib/atendimentos";
import { db } from "@/lib/db";
import { disciplinasDisponiveis, hojeNoFuso, prazoDoPlano, progressoNoPrograma, situacaoDoPlano } from "@/lib/escala-pedagogos";
import { programaDaDisciplina, programasDosPedagogos } from "@/lib/pedagogos-programa";
import { catalogoDaMateria } from "@/lib/temas-curriculo";

/** Aba "Escala de apresentações" da turma de pedagogos: dados do servidor para a tela (escala-pedagogos.tsx). */
export async function EscalaDoGrupo({ grupoId, euId, podeGerir }: { grupoId: string; euId: string; podeGerir: boolean }) {
  const grupo = await db.classGroup.findUniqueOrThrow({ where: { id: grupoId }, select: { school: { select: { uf: true } } } });
  const fuso = fusoDaEscola(grupo.school.uf);
  const hoje = hojeNoFuso(fuso);
  const [apresentacoes, integrantes] = await Promise.all([
    db.apresentacaoPedagogo.findMany({
      where: { classGroupId: grupoId, data: { gte: new Date(Date.parse(`${hoje}T12:00:00Z`) - 120 * 864e5).toISOString().slice(0, 10) } },
      include: { pedagogo: { select: { name: true } }, plano: true },
      orderBy: [{ data: "asc" }, { ordem: "asc" }],
    }),
    db.classMembership.findMany({ where: { classGroupId: grupoId, role: "aluno", member: { mercurioAtivo: true } }, select: { member: { select: { id: true, name: true } } }, orderBy: { member: { name: "asc" } } }),
  ]);
  // Progresso na formação: o programa N1 sempre e os outros com apresentação na turma. Quem gere vê todos;
  // o pedagogo, só o próprio.
  const programas = programasDosPedagogos();
  const emUso = new Set(apresentacoes.map((a) => programaDaDisciplina(a.materiaSigla)?.sigla).filter(Boolean));
  const pessoas = integrantes.map((i) => i.member).filter((p) => podeGerir || p.id === euId);
  const progresso = await Promise.all(
    programas
      .filter((p, i) => i === 0 || emUso.has(p.sigla))
      .map(async (p) => ({ sigla: p.sigla, programa: p.nome, total: p.temas.length, pessoas: (await progressoNoPrograma(p, pessoas)).map((x) => ({ ...x, proximo: x.proximo ? `${x.proximo.disciplina} · ${x.proximo.titulo}` : null })) })),
  );
  // O pedagogo vê o próprio plano; o rascunho dos outros não aparece para ninguém além de quem gere a turma.
  const views: ApresentacaoView[] = apresentacoes.map((a) => {
    const verPlano = a.plano && (a.pedagogoId === euId || (podeGerir && a.plano.status !== "rascunho"));
    return {
      id: a.id,
      data: a.data,
      ordem: a.ordem,
      pedagogoId: a.pedagogoId,
      pedagogo: a.pedagogo.name,
      materiaSigla: a.materiaSigla,
      tema: a.tema,
      topicos: a.topicos,
      status: a.status,
      prazo: prazoDoPlano(a.data, a.createdAt, fuso),
      situacao: situacaoDoPlano(a.data, a.plano, hoje, prazoDoPlano(a.data, a.createdAt, fuso)),
      plano: verPlano && a.plano
        ? {
            status: a.plano.status,
            sintese: a.plano.sintese,
            praticaFilosofica: a.plano.praticaFilosofica,
            ponteParaVida: a.plano.ponteParaVida,
            consequencias: a.plano.consequencias,
            arquivoNome: a.plano.arquivoNome,
            entregueEm: a.plano.entregueEm?.toISOString() ?? null,
            comentarioInstrutor: a.plano.comentarioInstrutor,
          }
        : null,
    };
  });
  return (
    <EscalaPedagogos
      grupoId={grupoId}
      hoje={hoje}
      euId={euId}
      podeGerir={podeGerir}
      pedagogos={integrantes.map((i) => ({ id: i.member.id, nome: i.member.name }))}
      disciplinas={disciplinasDisponiveis().map((d) => ({ ...d, temas: (catalogoDaMateria(d.sigla)?.temas ?? []).map((t) => ({ titulo: t.titulo, topicos: t.topicos ?? [] })) }))}
      programas={programas}
      progresso={progresso}
      apresentacoes={views}
    />
  );
}
