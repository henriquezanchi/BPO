import { Prisma } from "@prisma/client";
import { areasNaFilial } from "@/lib/areas-filial";
import { db } from "@/lib/db";
import { donosDoSistema, matriculasComDirecaoLiberada } from "@/lib/dono-do-sistema";
import { fusoDaEscola } from "@/lib/fuso-escola";
import { agoraNoFuso } from "@/lib/lembrete-aula";
import { consultarMercurio, sqlTexto } from "@/lib/mercurio-db/client";
import { emPaginas, type ResumoFilialDados } from "@/lib/mercurio-db/resumo-filial";
import { enviarPush } from "@/lib/push";
import { CATEGORIAS_FILIAL, CATEGORIAS_PORTAL } from "@/lib/sugestoes-comum";

/**
 * Avisos semanais para a direção e a Escolástica (pedido do usuário 06/11/2026), na rotina de avisos (5 em 5 min):
 *  - segunda, 8h da filial: resumo da semana para a direção (alunos novos, saídas, contribuição em atraso, pendências
 *    da Escolástica), para não precisar abrir o Portal;
 *  - segunda, 9h da filial: alunos "sumindo" viram pendência da Escolástica, para o contato antes de a pessoa sair.
 *    O Mercúrio não tem faltas; o sinal é a contribuição: ativo que contribuía (recibo nos últimos 12 meses) e está sem
 *    recibo há 60 dias. Os recibos são view ao vivo (a cópia `fichas` pode estar atrasada).
 */
export const HORA_RESUMO_DIRECAO = 8;
export const HORA_ALUNOS_SUMINDO = 9;
export const DIAS_SEM_RECIBO = 60;
const MAX_POR_SEMANA = 15;
export const TIPO_ALUNO_SUMINDO = "aluno_sumindo";

async function reservar(chave: string) {
  try {
    await db.pushEnviado.create({ data: { chave } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function textoResumoDirecao(n: { entradas: number; saidas: number; comAtraso: number | null; pendencias: number; vencidas: number; sugestoes?: number }) {
  const partes = [
    n.entradas || n.saidas ? `${plural(n.entradas, "aluno novo", "alunos novos")} e ${plural(n.saidas, "saída", "saídas")} na semana` : "Nenhuma entrada ou saída na semana",
    n.comAtraso !== null ? `${plural(n.comAtraso, "pessoa", "pessoas")} com contribuição em atraso` : null,
    n.pendencias ? `${plural(n.pendencias, "pendência", "pendências")} da Escolástica${n.vencidas ? ` (${n.vencidas} vencida${n.vencidas > 1 ? "s" : ""})` : ""}` : "Escolástica sem pendências",
    // Caixa de sugestões (10/11/2026, escolha do usuário: resumo semanal): as que ninguém leu ainda.
    n.sugestoes ? `${plural(n.sugestoes, "sugestão nova", "sugestões novas")} na caixa de sugestões` : null,
  ].filter(Boolean);
  return { titulo: "Sua filial na semana", corpo: `${partes.join(". ")}.` };
}

/** Quem está sumindo: contribuía nos últimos 12 meses e não tem recibo há `dias`. Entradas recentes ficam de fora. */
export function quemEstaSumindo(
  ativos: { matricula: string; nome: string; ingresso: string | null }[],
  recibos: { matricula: string; data: string }[],
  hoje: string,
  dias = DIAS_SEM_RECIBO,
) {
  const limite = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - dias * 864e5).toISOString().slice(0, 10);
  const ultimo = new Map<string, string>();
  for (const r of recibos) if ((ultimo.get(r.matricula) ?? "") < r.data) ultimo.set(r.matricula, r.data);
  return ativos
    .filter((a) => (a.ingresso ?? "") < limite && ultimo.has(a.matricula) && ultimo.get(a.matricula)! < limite)
    .map((a) => ({ ...a, ultimoRecibo: ultimo.get(a.matricula)! }))
    .sort((a, b) => a.ultimoRecibo.localeCompare(b.ultimoRecibo));
}

async function escolasDoMercurio() {
  return db.school.findMany({ where: { mercurioUnidade: { not: null }, sistemaRegistro: "mercurio", language: { not: "en" } }, select: { id: true, uf: true, mercurioUnidade: true } });
}

export async function resumoSemanalDaDirecao(agora = new Date()) {
  let total = 0;
  for (const escola of await escolasDoMercurio()) {
    const { hoje, semana, minuto } = agoraNoFuso(agora, fusoDaEscola(escola.uf));
    if (semana !== 1 || minuto < HORA_RESUMO_DIRECAO * 60 || minuto >= 12 * 60) continue;
    const direcao = await db.member.findMany({
      where: { schoolId: escola.id, mercurioAtivo: true, pushSubscriptions: { some: {} }, OR: [{ isDiretor: true }, { isSubChefe: true }, { mercurioId: { in: matriculasComDirecaoLiberada() } }] },
      select: { id: true },
    });
    if (!direcao.length || !(await reservar(`semana-direcao:${escola.id}:${hoje}`))) continue;

    const u = sqlTexto(escola.mercurioUnidade!);
    const desde = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - 7 * 864e5).toISOString().slice(0, 10);
    const [[e], [s], resumo, pendencias, vencidas, sugestoes] = await Promise.all([
      consultarMercurio(`SELECT COUNT(*) n FROM cadastro WHERE cad_unidade=${u} AND cad_situacao='ATI' AND cad_ingresso >= '${desde}'`),
      consultarMercurio(`SELECT COUNT(*) n FROM cadastro WHERE cad_unidade=${u} AND cad_situacao='INA' AND cad_baixa >= '${desde}'`),
      db.resumoFilial.findUnique({ where: { schoolId: escola.id }, select: { dados: true } }),
      db.scholasticPendency.count({ where: { schoolId: escola.id, completedAt: null } }),
      db.scholasticPendency.count({ where: { schoolId: escola.id, completedAt: null, dueDate: { lt: agora } } }),
      db.sugestaoPortal.count({ where: { schoolId: escola.id, status: "nova", categoria: { in: CATEGORIAS_FILIAL } } }),
    ]);
    const comAtraso = (resumo?.dados as unknown as ResumoFilialDados | undefined)?.contribuicao?.pessoasComAtraso ?? null;
    const texto = textoResumoDirecao({ entradas: Number(e?.n ?? 0), saidas: Number(s?.n ?? 0), comAtraso, pendencias, vencidas, sugestoes });
    total += (await enviarPush(direcao.map((d) => d.id), { ...texto, url: "/diretor", etiqueta: `semana-direcao-${hoje}` })).pessoas;
  }
  return total;
}

export async function avisosDeAlunosSumindo(agora = new Date()) {
  let criadas = 0;
  for (const escola of await escolasDoMercurio()) {
    const { hoje, semana, minuto } = agoraNoFuso(agora, fusoDaEscola(escola.uf));
    if (semana !== 1 || minuto < HORA_ALUNOS_SUMINDO * 60 || minuto >= 13 * 60) continue;
    if (!(await reservar(`sumindo:${escola.id}:${hoje}`))) continue;

    const u = sqlTexto(escola.mercurioUnidade!);
    const doze = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - 365 * 864e5).toISOString().slice(0, 10);
    // Sem GROUP BY (o phpMyAdmin já devolveu vazio numa agregação): o último recibo de cada um é calculado aqui.
    const [ativos, recibos] = await Promise.all([
      emPaginas(`SELECT cad_matr, cad_nome, cad_ingresso FROM cadastro WHERE cad_unidade=${u} AND cad_situacao='ATI' ORDER BY cad_matr`),
      emPaginas(
        `SELECT i.rei_matr, r.rec_data, r.rec_status, r.rec_data_cancel FROM reciboc r JOIN reciboi i ON i.rei_id=r.rec_id WHERE r.rec_unidade=${u} AND r.rec_data >= '${doze}' ORDER BY r.rec_id`,
      ),
    ]);
    const validos = recibos
      .filter((r) => r.rec_status !== "CAN" && !(r.rec_data_cancel && r.rec_data_cancel >= "1900-01-01"))
      .map((r) => ({ matricula: r.rei_matr ?? "", data: (r.rec_data ?? "").slice(0, 10) }));
    const sumindo = quemEstaSumindo(
      ativos.map((a) => ({ matricula: a.cad_matr ?? "", nome: (a.cad_nome ?? "").trim(), ingresso: a.cad_ingresso && a.cad_ingresso > "1900" ? a.cad_ingresso.slice(0, 10) : null })),
      validos,
      hoje,
    );

    // Não repete quem já virou pendência nos últimos 90 dias (aberta ou concluída).
    const recentes = await db.scholasticPendency.findMany({
      where: { schoolId: escola.id, tipo: TIPO_ALUNO_SUMINDO, createdAt: { gte: new Date(agora.getTime() - 90 * 864e5) } },
      select: { notes: true },
    });
    const jaAvisados = new Set(recentes.map((r) => /matrícula (\d+)/.exec(r.notes ?? "")?.[1]).filter(Boolean));
    const novos = sumindo.filter((p) => !jaAvisados.has(p.matricula)).slice(0, MAX_POR_SEMANA);
    if (!novos.length) continue;

    const membros = new Map(
      (await db.member.findMany({ where: { schoolId: escola.id, mercurioId: { in: novos.map((n) => n.matricula) } }, select: { id: true, mercurioId: true } })).map((m) => [m.mercurioId!, m.id]),
    );
    const prazo = new Date(agora.getTime() + 7 * 864e5);
    for (const p of novos) {
      const [a, m] = p.ultimoRecibo.split("-");
      await db.scholasticPendency.create({
        data: {
          schoolId: escola.id,
          memberId: membros.get(p.matricula) ?? null,
          tipo: TIPO_ALUNO_SUMINDO,
          title: `Fazer contato: ${p.nome.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())}`,
          notes: `Sem contribuição desde ${m}/${a} (matrícula ${p.matricula}). Um contato agora, antes de a pessoa se afastar de vez.`,
          dueDate: prazo,
        },
      });
      criadas++;
    }
    const escolastica = await db.member.findMany({ where: { schoolId: escola.id, mercurioAtivo: true, pushSubscriptions: { some: {} } } });
    const quem = (await Promise.all(escolastica.map(async (x) => ((await areasNaFilial(x, escola.id)).includes("escolastica") ? x.id : null)))).filter((x): x is string => !!x);
    await enviarPush(quem, {
      titulo: novos.length === 1 ? "1 aluno para contatar" : `${novos.length} alunos para contatar`,
      corpo: "Sem contribuição há mais de 2 meses. Um contato agora ajuda a pessoa a não se afastar.",
      url: "/escolastica",
      etiqueta: `sumindo-${escola.id}-${hoje}`,
    });
  }
  return criadas;
}

/** Texto do resumo semanal das sugestões sobre o Portal, para a administração nacional. */
export function textoResumoSugestoesDoPortal(n: { problemas: number; ideias: number }) {
  const partes = [n.problemas ? plural(n.problemas, "problema relatado", "problemas relatados") : null, n.ideias ? plural(n.ideias, "ideia", "ideias") : null].filter(Boolean);
  return { titulo: "Sugestões sobre o Portal", corpo: `${partes.join(" e ")} aguardando leitura.` };
}

/**
 * Segunda, 8h de Brasília (10/11/2026): sugestões sobre o Portal ainda não lidas, para a administração nacional (dono do
 * sistema e liberadores nacionais). Sem nada novo, não avisa.
 */
export async function resumoSemanalDeSugestoesDoPortal(agora = new Date()) {
  const { hoje, semana, minuto } = agoraNoFuso(agora, "America/Sao_Paulo");
  if (semana !== 1 || minuto < HORA_RESUMO_DIRECAO * 60 || minuto >= 12 * 60) return 0;
  const porCategoria = await db.sugestaoPortal.groupBy({ by: ["categoria"], where: { status: "nova", categoria: { in: CATEGORIAS_PORTAL } }, _count: true });
  const n = (c: string) => porCategoria.find((x) => x.categoria === c)?._count ?? 0;
  const problemas = n("portal_problema");
  const ideias = n("portal_ideia");
  if (!problemas && !ideias) return 0;
  const nacionais = (await db.liberadorNacional.findMany({ select: { mercurioId: true } })).map((l) => l.mercurioId);
  const pessoas = await db.member.findMany({
    where: { mercurioAtivo: true, pushSubscriptions: { some: {} }, mercurioId: { in: [...nacionais, ...donosDoSistema()] } },
    select: { id: true },
  });
  if (!pessoas.length || !(await reservar(`semana-sugestoes-portal:${hoje}`))) return 0;
  return (await enviarPush(pessoas.map((p) => p.id), { ...textoResumoSugestoesDoPortal({ problemas, ideias }), url: "/voluntario/sugestoes", etiqueta: `semana-sugestoes-${hoje}` })).pessoas;
}
