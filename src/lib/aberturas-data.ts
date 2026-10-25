import "server-only";

import { experienciasDaRede } from "@/lib/aberturas/experiencias";
import { avaliarFatos } from "@/lib/aberturas/avaliacao";
import { db } from "@/lib/db";
import { exigirAberturas } from "@/lib/aberturas/permissoes";
import { agregarAprendizadosRede, gerarRelatoriosAberturas, medirAvaliacoes } from "@/lib/aberturas/relatorios";
import { eventScopeWhere } from "@/lib/event-policy";

type JsonObject = Record<string, unknown>;

const objeto = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};

const iso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const SECRET_KEY = /(token|secret|password|senha|credential|credencial|authorization|cookie|session|cipher|encrypted|api.?key)/i;

/** Serializa JSON do cache e remove credenciais que não devem chegar ao cliente. */
function jsonSeguro(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSeguro);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .filter(([key]) => !SECRET_KEY.test(key))
        .map(([key, entry]) => [key, jsonSeguro(entry)]),
    );
  }
  return value;
}

function linhas(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(objeto) : [];
}

function selecionar(row: JsonObject, keys: string[]): JsonObject {
  return Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, jsonSeguro(row[key])]));
}

function mapearCache(dados: unknown, sincronizadoEm: Date | null) {
  const cache = objeto(jsonSeguro(dados));
  return {
    status: typeof cache.status === "string" ? cache.status : "atualizado",
    leads: linhas(cache.leads).map((lead) => selecionar(lead, ["id", "nome", "sinais", "interesse", "avaliadoEm"])),
    matriculas: linhas(cache.matriculas).map((matricula) => selecionar(matricula, ["mercurioId", "leadId", "data", "turmaId", "tipo", "fonte", "ativo", "aberturaId"])),
    baseAtualizadaEm: iso(typeof cache.baseAtualizadaEm === "string" ? cache.baseAtualizadaEm : null) ?? iso(sincronizadoEm),
  };
}

function leadsDeRegistros(registros: Array<{ tipo: string; dados: unknown }>) {
  const ids = new Set<string>();
  for (const registro of registros) {
    if (!(["sinal", "avaliacao", "resultado"] as string[]).includes(registro.tipo)) continue;
    const dados = objeto(registro.dados);
    if (registro.tipo === "resultado" && dados.status !== "matriculado") continue;
    if (typeof dados.leadId === "string" && dados.leadId.trim()) ids.add(dados.leadId.trim());
  }
  return [...ids];
}

function leadsDaCachePorAbertura(dados: unknown, aberturaId: string) {
  const cache = objeto(dados);
  const ids = new Set<string>();
  for (const key of ["acontecimentos", "avaliacoes", "acoes", "resultados", "matriculas"]) {
    for (const row of linhas(cache[key])) {
      if (String(row.aberturaId ?? "") !== aberturaId || typeof row.leadId !== "string" || !row.leadId.trim()) continue;
      ids.add(row.leadId.trim());
    }
  }
  return [...ids];
}

function turmaResumo(dados: unknown): Array<JsonObject & {id:string}> {
  const turmas = objeto(objeto(dados).turmas);
  return linhas(turmas.lista).map((turma,index) => ({...jsonSeguro(turma) as JsonObject,id:`turma:${String(turma.turma??index)}`}));
}

/** Dados de abertura da filial, prontos para serializar como props do Client Component. */
export async function getPainelAberturas(requestedSchoolId?: string) {
  const { member, escolas, schoolId } = await exigirAberturas(requestedSchoolId);
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { id: true, uf: true } });
  if (!school) throw new Error("Filial não encontrada.");

  const agora = new Date();
  const [aberturasDb, professoresDb, disponibilidadesDb, eventosDb, resumo, escalasDb, configDb, cacheDb] = await Promise.all([
    db.aberturaTurma.findMany({
      where: { schoolId },
      include: {
        registros: { orderBy: { createdAt: "asc" } },
        matriculasOnline: { where: { status: { not: "cancelada" } }, orderBy: { createdAt: "desc" }, select: { id: true, nome: true, celular: true, email: true, status: true, pagoEm: true, createdAt: true } },
      },
      orderBy: [{ primeiraAula: "asc" }, { createdAt: "asc" }],
    }),
    db.member.findMany({ where: { schoolId, mercurioAtivo: true }, select: { id: true, name: true, isPedagogo: true }, orderBy: { name: "asc" } }),
    db.professorDisponibilidade.findMany({ where: { schoolId }, orderBy: [{ professorId: "asc" }, { diaSemana: "asc" }, { inicioMinuto: "asc" }] }),
    db.event.findMany({
      where: {
        AND: [
          { status: "publicado" },
          eventScopeWhere(school),
          { OR: [{ startsAt: { gte: agora } }, { endsAt: { gte: agora } }] },
        ],
      },
      select: { id: true, title: true, startsAt: true, endsAt: true },
      orderBy: { startsAt: "asc" },
      take: 500,
    }),
    db.resumoFilial.findUnique({ where: { schoolId }, select: { dados: true } }),
    db.secretariaEscala.findMany({ where: { schoolId }, orderBy: [{ diaSemana: "asc" }, { inicioMinuto: "asc" }] }),
    db.aberturaConfig.findUnique({ where: { schoolId } }),
    db.aberturaCrmCache.findUnique({ where: { schoolId }, select: { dados: true, sincronizadoEm: true } }),
  ]);

  const aberturas = aberturasDb.map((abertura) => ({
    id: abertura.id,
    mercurioTurmaId: abertura.mercurioTurmaId,
    inscricoesAte: abertura.inscricoesAte?.toISOString() ?? null,
    titulo: abertura.titulo,
    primeiraAula: abertura.primeiraAula.toISOString(),
    diaSemana: abertura.diaSemana,
    inicioMinuto: abertura.inicioMinuto,
    duracaoMinutos: abertura.duracaoMinutos,
    capacidade: abertura.capacidade,
    metaMatriculas: abertura.metaMatriculas,
    orcamentoCentavos: abertura.orcamentoCentavos,
    matriculaToken: abertura.matriculaToken,
    matriculaAberta: abertura.matriculaAberta,
    valorContribuicaoCentavos: abertura.valorContribuicaoCentavos,
    matriculasSite: abertura.matriculasOnline.map((m) => ({ ...m, pagoEm: m.pagoEm?.toISOString() ?? null, createdAt: m.createdAt.toISOString() })),
    sala: abertura.sala || null,
    status: abertura.status,
    professorIds: [...abertura.professorIds],
    revisao: abertura.revisao,
    registros: abertura.registros.map((registro) => ({
      id: registro.id,
      tipo: registro.tipo,
      dados: jsonSeguro(registro.dados) as JsonObject,
      createdAt: registro.createdAt.toISOString(),
    })),
  }));

  const crm = cacheDb
    ? mapearCache(cacheDb.dados, cacheDb.sincronizadoEm)
    : { status: "pendente", leads: [], matriculas: [], baseAtualizadaEm: null };
  for(const lead of crm.leads){
    const locais=aberturasDb.flatMap(a=>a.registros.filter(r=>r.tipo==='sinal'&&String(objeto(r.dados).leadId)===String(lead.id)).map(r=>({...objeto(r.dados),aberturaId:a.id,responsavel:r.autorId,registradoEm:r.createdAt.toISOString()})));
    const sinais=[...(Array.isArray(lead.sinais)?lead.sinais.map(objeto):[]),...locais];
    lead.avaliacoesPorAbertura=Object.fromEntries(aberturasDb.map(a=>[a.id,avaliarFatos(sinais,{id:a.id,diaSemana:a.diaSemana,inicioMinuto:a.inicioMinuto,primeiraAula:a.primeiraAula.toISOString()},undefined,{naoContatar:lead.naoContatar===true,atualizadoEm:lead.preferenciaContatoEm||null})]));
  }
  const config = configDb
    ? {
        capacidadeEscola: configDb.capacidadeEscola,
        funcoesNecessarias: [...configDb.funcoesNecessarias],
        compartilharAprendizados: configDb.compartilharAprendizados,
        revisao: configDb.revisao,
      }
    : { capacidadeEscola: null, funcoesNecessarias: [], compartilharAprendizados: false, revisao: 0 };

  const configsRede = await db.aberturaConfig.findMany({ where: { compartilharAprendizados: true }, select: { schoolId: true } });
  const schoolIdsOptIn = configsRede.map((c) => c.schoolId);
  const [aberturasCompartilhadasDb, cachesCompartilhadosDb] = schoolIdsOptIn.length
    ? await Promise.all([
        db.aberturaTurma.findMany({
          where: { schoolId: { in: schoolIdsOptIn } },
          select: { id: true, schoolId: true, titulo:true, primeiraAula:true, diaSemana:true, capacidade:true, status:true, registros: { select: { tipo: true, dados: true } } },
        }),
        db.aberturaCrmCache.findMany({ where: { schoolId: { in: schoolIdsOptIn } }, select: { schoolId: true, dados: true } }),
      ])
    : [[], []];
  const cachePorEscola = new Map(cachesCompartilhadosDb.map((cache) => [cache.schoolId, cache.dados]));
  const optIns = new Set(schoolIdsOptIn);
  const aprendizadosRede = agregarAprendizadosRede(
    aberturasCompartilhadasDb
      .filter((abertura) => abertura.schoolId !== schoolId)
      .map((abertura) => ({
        schoolId: abertura.schoolId,
        compartilharAprendizados: optIns.has(abertura.schoolId),
        aberturas: [{ id: abertura.id, registros: abertura.registros }],
        leadsPorAbertura: {
          [abertura.id]: [
            ...leadsDeRegistros(abertura.registros),
            ...leadsDaCachePorAbertura(cachePorEscola.get(abertura.schoolId), abertura.id),
          ],
        },
      })),
  );
  const aprendizadosLocais = aberturas.flatMap((abertura) => abertura.registros
    .filter((registro) => registro.tipo === "aprendizado")
    .map((registro) => ({ escopo: "local", registroId: registro.id, aberturaId: abertura.id, createdAt: registro.createdAt, ...objeto(registro.dados) })));
  const relatorios = gerarRelatoriosAberturas(aberturas, cacheDb?.dados);

  return {
    member: { id: member.id, name: member.name },
    escolas: escolas.map((escola) => ({ id: escola.id, name: escola.name })),
    schoolId,
    aberturas,
    pessoas: professoresDb.map(({ id, name }) => ({ id, name })),
    professores: professoresDb.filter(p=>p.isPedagogo).map(({ id, name }) => ({ id, name })),
    disponibilidades: disponibilidadesDb.map((disponibilidade) => ({
      id: disponibilidade.id,
      professorId: disponibilidade.professorId,
      diaSemana: disponibilidade.diaSemana,
      inicioMinuto: disponibilidade.inicioMinuto,
      fimMinuto: disponibilidade.fimMinuto,
      validaDe: disponibilidade.validaDe,
      validaAte: disponibilidade.validaAte,
      impedimentos: jsonSeguro(disponibilidade.impedimentos),
      habilitado: disponibilidade.habilitado,
    })),
    eventos: eventosDb.map((evento) => ({ id: evento.id, title: evento.title, startDate: evento.startsAt.toISOString(), endDate: iso(evento.endsAt) })),
    turmas: turmaResumo(resumo?.dados),
    escalas: escalasDb.map((escala) => ({
      id: escala.id,
      secretaria: escala.secretaria,
      memberId: escala.memberId,
      funcao: escala.funcao,
      diaSemana: escala.diaSemana,
      inicioMinuto: escala.inicioMinuto,
      fimMinuto: escala.fimMinuto,
      validaDe: escala.validaDe,
      validaAte: escala.validaAte,
      confirmado: escala.confirmado,
    })),
    config,
    configs: config,
    crm,
    experienciasRede: experienciasDaRede(aberturasCompartilhadasDb.map(a=>({...a,compartilhar:true,baseAtualizadaEm:typeof objeto(cachePorEscola.get(a.schoolId)).baseAtualizadaEm==='string'?String(objeto(cachePorEscola.get(a.schoolId)).baseAtualizadaEm):null}))),
    validacaoAvaliacoes: aberturasDb.map(a=>({aberturaId:a.id,...medirAvaliacoes(a,cacheDb?.dados)})),
    aprendizados: [...aprendizadosLocais, ...aprendizadosRede],
    relatorios,
  };
}
