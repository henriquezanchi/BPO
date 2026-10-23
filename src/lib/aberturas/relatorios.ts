type Registro = { id?: string; tipo: string; dados: unknown; createdAt?: Date | string };

export type AberturaRelatorioInput = {
  id: string;
  titulo?: string;
  primeiraAula: Date | string;
  inscricoesAte?: Date | string | null;
  diaSemana?: number;
  registros?: Registro[];
};

type JsonObject = Record<string, unknown>;

const objeto = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};

const texto = (value: unknown): string => typeof value === "string" ? value.trim() : "";

const dataIso = (value: unknown): string | null => {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function partesDataLocal(value: Date | string): { year: number; month: number; day: number } | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) ? { year, month, day } : null;
}

function mesLocal(value: Date | string): string | null {
  const parts = partesDataLocal(value);
  return parts ? `${parts.year}-${String(parts.month).padStart(2, "0")}` : null;
}

function diaSemanaLocal(value: Date | string): number | null {
  const parts = partesDataLocal(value);
  return parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() : null;
}

function valorCentavos(dados: JsonObject): number | null {
  const stored = dados.valorCentavos;
  if (typeof stored === "number" && Number.isSafeInteger(stored) && stored >= 0) return stored;
  const value = dados.valor;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = typeof value === "number" ? value : Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function idValido(value: unknown): string | null {
  const id = texto(value);
  return id && !/^(?:desconhecido|unknown|negado|n\/a|null)$/i.test(id) ? id : null;
}

function leadsVinculados(aberturaId: string, registros: Registro[], crm?: unknown): Set<string> {
  const ids = new Set<string>();
  for (const registro of registros) {
    const dados = objeto(registro.dados);
    if (registro.tipo === "sinal" || registro.tipo === "avaliacao" || registro.tipo === "resultado") {
      const id = idValido(dados.leadId);
      if (id) ids.add(id);
    }
  }
  const cache = objeto(crm);
  for (const key of ["acontecimentos", "avaliacoes", "acoes", "resultados", "matriculas"]) {
    const rows = cache[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const data = objeto(row);
      if (String(data.aberturaId ?? "") !== aberturaId) continue;
      const id = idValido(data.leadId);
      if (id) ids.add(id);
    }
  }
  return ids;
}

function matriculasConfirmadas(aberturaId: string, registros: Registro[], crm?: unknown): Set<string> {
  const ids = new Set<string>();
  for (const registro of registros) {
    if (registro.tipo !== "resultado") continue;
    const dados = objeto(registro.dados);
    if (dados.status !== "matriculado") continue;
    // A action confirma matrícula no Mercúrio antes de gravar este registro.
    if (dados.fonte !== "mercurio" && !dataIso(dados.confirmadoEm)) continue;
    const id = idValido(dados.mercurioId);
    if (id) ids.add(id);
  }

  const cache = objeto(crm);
  if (Array.isArray(cache.matriculas)) {
    for (const row of cache.matriculas) {
      const data = objeto(row);
      if (String(data.aberturaId ?? "") !== aberturaId || data.ativo === false) continue;
      const id = idValido(data.mercurioId);
      if (id) ids.add(id);
    }
  }
  return ids;
}

function coorte(registros: Registro[], status: string) {
  const estadosPorMatricula = new Map<string, Set<boolean>>();
  for (const registro of registros) {
    if (registro.tipo !== "resultado") continue;
    const dados = objeto(registro.dados);
    if (dados.status !== status) continue;
    // Só observações locais explicitamente booleanas entram na coorte.
    // Desconhecido/negado não vira falta nem participa do denominador.
    if (dados.fonte !== "registro_local" || typeof dados.presente !== "boolean") continue;
    const mercurioId = idValido(dados.mercurioId);
    if (!mercurioId) continue;
    const estados = estadosPorMatricula.get(mercurioId) ?? new Set<boolean>();
    estados.add(dados.presente);
    estadosPorMatricula.set(mercurioId, estados);
  }
  // Registros contraditórios para a mesma matrícula são ambíguos e ficam fora.
  const estadosValidos = [...estadosPorMatricula.values()].filter((estados) => estados.size === 1);
  const presentes = estadosValidos.filter((estados) => estados.has(true)).length;
  const ausenciasObservadas = estadosValidos.filter((estados) => estados.has(false)).length;
  const avaliados = presentes + ausenciasObservadas;
  return {
    presentes,
    ausenciasObservadas,
    avaliados,
    taxaPresenca: avaliados ? presentes / avaliados : null,
  };
}

function dataResultado(dados: JsonObject): number | null {
  const data = texto(dados.data);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const timestamp = Date.parse(`${data}T03:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === data ? timestamp : null;
}

function snapshotsAnteriores(aberturaId: string, registros: Registro[], crm?: unknown) {
  const matriculasPorLead = new Map<string, { timestamp: number; data: string }>();
  const adicionarMatricula = (leadValue: unknown, dados: JsonObject) => {
    const leadId = idValido(leadValue);
    const timestamp = dataResultado(dados);
    const data = texto(dados.data);
    if (!leadId || timestamp === null) return;
    const anterior = matriculasPorLead.get(leadId);
    if (!anterior || timestamp < anterior.timestamp) matriculasPorLead.set(leadId, { timestamp, data });
  };
  for (const registro of registros) {
    if (registro.tipo !== "resultado") continue;
    const dados = objeto(registro.dados);
    if (
      dados.status === "matriculado" && idValido(dados.mercurioId) &&
      (dados.fonte === "mercurio" || dataIso(dados.confirmadoEm))
    ) adicionarMatricula(dados.leadId, dados);
  }
  const cache = objeto(crm);
  if (Array.isArray(cache.matriculas)) {
    for (const row of cache.matriculas) {
      const dados = objeto(row);
      if (String(dados.aberturaId ?? "") !== aberturaId || dados.ativo === false) continue;
      if (idValido(dados.mercurioId)) adicionarMatricula(dados.leadId, dados);
    }
  }

  const avaliacoes = registros.filter((registro) => registro.tipo === "avaliacao");
  const snapshots: JsonObject[] = [];
  for (const registro of avaliacoes) {
    const avaliacao = objeto(registro.dados);
    if(avaliacao.preResultado===false)continue;
    const leadId = idValido(avaliacao.leadId);
    const matricula = leadId ? matriculasPorLead.get(leadId) : null;
    const avaliadoEm = dataIso(typeof avaliacao.avaliadoEm === "string" ? avaliacao.avaliadoEm : registro.createdAt);
    if (!matricula || !avaliadoEm || Date.parse(avaliadoEm) >= matricula.timestamp) continue;
    snapshots.push({
      avaliadoEm,
      resultadoEm: matricula.data,
      interesse: avaliacao.interesse ?? null,
      adequacaoTurma: avaliacao.adequacaoTurma ?? null,
      proximaAcao: avaliacao.proximaAcao ?? null,
      fundamentos: avaliacao.fundamentos ?? [],
      sinais: avaliacao.sinais ?? [],
    });
  }
  return snapshots.sort((a, b) => String(a.avaliadoEm).localeCompare(String(b.avaliadoEm)));
}

export type RelatorioAbertura = {
  aberturaId: string;
  titulo: string;
  primeiraAula: string | null;
  diaSemana: number | null;
  mes: string | null;
  despesas: { previstoCentavos: number; realCentavos: number; amostrasPrevisto: number; amostrasReal: number };
  leads: { denominadorObservado: number | null; matriculadosUnicos: number; conversaoMatricula: number | null };
  matriculas: { confirmadasUnicasMercurio: number; custoRealPorMatriculaCentavos: number | null };
  coortes: {
    presenca30: ReturnType<typeof coorte>;
    presenca60: ReturnType<typeof coorte>;
    presenca90: ReturnType<typeof coorte>;
  };
  snapshotsAnteriores: ReturnType<typeof snapshotsAnteriores>;
};

export function gerarRelatorioAbertura(abertura: AberturaRelatorioInput, crm?: unknown): RelatorioAbertura {
  const registros = abertura.registros ?? [];
  let previstoCentavos = 0;
  let realCentavos = 0;
  let amostrasPrevisto = 0;
  let amostrasReal = 0;
  for (const registro of registros) {
    if (registro.tipo !== "despesa") continue;
    const dados = objeto(registro.dados);
    const valor = valorCentavos(dados);
    if (valor === null) continue;
    if (dados.previsto === true || dados.previsto === "true") {
      previstoCentavos += valor;
      amostrasPrevisto++;
    } else {
      realCentavos += valor;
      amostrasReal++;
    }
  }

  const matriculas = matriculasConfirmadas(abertura.id, registros, crm);
  const leads = leadsVinculados(abertura.id, registros, crm);
  const matriculasLead = new Set<string>();
  for (const registro of registros) {
    if (registro.tipo !== "resultado") continue;
    const dados = objeto(registro.dados);
    if (dados.status !== "matriculado" || (dados.fonte !== "mercurio" && !dataIso(dados.confirmadoEm))) continue;
    const leadId = idValido(dados.leadId);
    if (leadId) matriculasLead.add(leadId);
  }
  const cache = objeto(crm);
  if (Array.isArray(cache.matriculas)) {
    for (const row of cache.matriculas) {
      const data = objeto(row);
      if (String(data.aberturaId ?? "") !== abertura.id || data.ativo === false) continue;
      const leadId = idValido(data.leadId);
      if (leadId) matriculasLead.add(leadId);
    }
  }
  const data = abertura.primeiraAula ? dataIso(abertura.primeiraAula) : null;
  const mes = abertura.primeiraAula ? mesLocal(abertura.primeiraAula) : null;
  const denominador = leads.size || null;

  return {
    aberturaId: abertura.id,
    titulo: abertura.titulo ?? "",
    primeiraAula: data,
    diaSemana: Number.isInteger(abertura.diaSemana) ? abertura.diaSemana! : abertura.primeiraAula ? diaSemanaLocal(abertura.primeiraAula) : null,
    mes,
    despesas: { previstoCentavos, realCentavos, amostrasPrevisto, amostrasReal },
    leads: {
      denominadorObservado: denominador,
      matriculadosUnicos: matriculasLead.size,
      conversaoMatricula: denominador ? matriculasLead.size / denominador : null,
    },
    matriculas: {
      confirmadasUnicasMercurio: matriculas.size,
      custoRealPorMatriculaCentavos: matriculas.size ? Math.round(realCentavos / matriculas.size) : null,
    },
    coortes: {
      presenca30: coorte(registros, "presenca30"),
      presenca60: coorte(registros, "presenca60"),
      presenca90: coorte(registros, "presenca90"),
    },
    snapshotsAnteriores: snapshotsAnteriores(abertura.id, registros, crm),
  };
}

type Media = {
  amostras: number;
  amostrasPrevisto: number;
  amostrasReal: number;
  amostrasLeads: number;
  amostrasMatriculas: number;
  gastoPrevistoMedioCentavos: number | null;
  gastoRealMedioCentavos: number | null;
  leadsMedios: number | null;
  matriculasMedias: number | null;
  conversaoMatriculaMedia: number | null;
};

function mediaRelatorios(relatorios: RelatorioAbertura[]): Media {
  const comPrevisto = relatorios.filter((r) => r.despesas.amostrasPrevisto > 0);
  const comReal = relatorios.filter((r) => r.despesas.amostrasReal > 0);
  const comLeads = relatorios.filter((r) => r.leads.denominadorObservado !== null);
  const comMatriculas = relatorios.filter((r) => r.matriculas.confirmadasUnicasMercurio > 0);
  const media = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return {
    amostras: relatorios.length,
    amostrasPrevisto: comPrevisto.length,
    amostrasReal: comReal.length,
    amostrasLeads: comLeads.length,
    amostrasMatriculas: comMatriculas.length,
    gastoPrevistoMedioCentavos: media(comPrevisto.map((r) => r.despesas.previstoCentavos)),
    gastoRealMedioCentavos: media(comReal.map((r) => r.despesas.realCentavos)),
    leadsMedios: media(comLeads.map((r) => r.leads.denominadorObservado ?? 0)),
    matriculasMedias: media(comMatriculas.map((r) => r.matriculas.confirmadasUnicasMercurio)),
    conversaoMatriculaMedia: media(comLeads.flatMap((r) => r.leads.conversaoMatricula === null ? [] : [r.leads.conversaoMatricula])),
  };
}

export function gerarRelatoriosAberturas(aberturas: AberturaRelatorioInput[], crm?: unknown) {
  const relatorios = aberturas.map((abertura) => gerarRelatorioAbertura(abertura, crm));
  const porDia = new Map<number, RelatorioAbertura[]>();
  const porMes = new Map<string, RelatorioAbertura[]>();
  for (const relatorio of relatorios) {
    if (relatorio.diaSemana !== null) porDia.set(relatorio.diaSemana, [...(porDia.get(relatorio.diaSemana) ?? []), relatorio]);
    if (relatorio.mes) porMes.set(relatorio.mes, [...(porMes.get(relatorio.mes) ?? []), relatorio]);
  }
  return {
    aberturas: relatorios,
    historico: {
      porDiaSemana: [...porDia].sort(([a], [b]) => a - b).map(([diaSemana, rows]) => ({ diaSemana, ...mediaRelatorios(rows) })),
      porMes: [...porMes].sort(([a], [b]) => a.localeCompare(b)).map(([mes, rows]) => ({ mes, ...mediaRelatorios(rows) })),
    },
  };
}

type FonteAprendizado = {
  schoolId: string;
  compartilharAprendizados: boolean;
  aberturas: Array<{ id: string; registros?: Registro[] }>;
  leadsPorAbertura?: Record<string, string[]>;
};

/**
 * Aprendizados de outras filiais só saem depois do opt-in da filial e do
 * mínimo de três aberturas e dez interessados identificados. A resposta não
 * inclui texto livre, ids, nomes de escolas, autores nem ids do CRM. O número
 * de amostras identifica exatamente quantos apontamentos formam o agregado.
 */
export function agregarAprendizadosRede(fontes: FonteAprendizado[]) {
  const optins = fontes.filter((fonte) => fonte.compartilharAprendizados);
  const aberturaIds = new Set<string>();
  const leadIds = new Set<string>();
  let amostrasAprendizado = 0;
  for (const fonte of optins) {
    for (const abertura of fonte.aberturas) {
      const registros = abertura.registros ?? [];
      const amostras = registros.filter((registro) => registro.tipo === "aprendizado" && objeto(registro.dados).compartilhar === true).length;
      if (!amostras) continue;
      aberturaIds.add(`${fonte.schoolId}:${abertura.id}`);
      amostrasAprendizado += amostras;
      for (const leadId of fonte.leadsPorAbertura?.[abertura.id] ?? []) {
        const id = idValido(leadId);
        if (id) leadIds.add(`${fonte.schoolId}:${id}`);
      }
    }
  }
  if (aberturaIds.size < 3 || leadIds.size < 10) return [];
  return [{
    escopo: "rede",
    categoria: "aprendizados_compartilhados",
    amostras: amostrasAprendizado,
    aberturasAgregadas: aberturaIds.size,
    leadsAgregados: leadIds.size,
    representacao: "contagem_agregada_sem_texto",
  }];
}

/** Validação das avaliações em coortes, sem chamar ausência de dado de fracasso.
 * A janela inicial de conversão é de 30 dias após a primeira aula. Só
 * classificamos ausência de matrícula quando a base cobre toda essa janela. */
export function medirAvaliacoes(abertura: AberturaRelatorioInput & {status?:string;mercurioTurmaId?:string|null}, crm?:unknown, agora=new Date().toISOString()) {
 const cache=objeto(crm),registros=abertura.registros??[];
 const primeira=dataIso(abertura.primeiraAula);
 const limite=dataIso(abertura.inscricoesAte)??(primeira?new Date(Date.parse(primeira)+30*86400000).toISOString():null);
 const corte=dataIso(cache.baseAtualizadaEm);
 const fechada=!!(abertura.status==='concluida'&&abertura.mercurioTurmaId&&limite&&corte&&Date.parse(corte)>=Date.parse(limite)&&Date.parse(agora)>=Date.parse(limite));
 const matriculas=new Map<string,number>();
 for(const r of registros){const d=objeto(r.dados);if(r.tipo!=='resultado'||d.status!=='matriculado'||d.fonte!=='mercurio')continue;const id=idValido(d.leadId),data=dataResultado(d);if(id&&data!==null)matriculas.set(id,Math.min(matriculas.get(id)??Infinity,data));}
 for(const row of Array.isArray(cache.matriculas)?cache.matriculas:[]){const d=objeto(row);if(String(d.aberturaId)!==abertura.id&&(!abertura.mercurioTurmaId||String(d.turmaId)!==abertura.mercurioTurmaId))continue;const id=idValido(d.leadId),data=dataResultado(d);if(id&&data!==null)matriculas.set(id,Math.min(matriculas.get(id)??Infinity,data));}
 const snapshots=new Map<string,{d:JsonObject;data:number}>();
 for(const r of registros){if(r.tipo!=='avaliacao')continue;const d=objeto(r.dados),id=idValido(d.leadId),at=dataIso(d.avaliadoEm);if(d.preResultado===false)continue;if(!id||!at||!limite)continue;const data=Date.parse(at);if(data>Date.parse(limite)||data>Date.parse(agora)||data>=(matriculas.get(id)??Infinity))continue;if(data>(snapshots.get(id)?.data??-Infinity))snapshots.set(id,{d,data});}
 const grupos=new Map<string,{versao:string;interesse:string;adequacao:string;avaliados:number;matriculados:number;semMatriculaNoPeriodo:number;pendentes:number;acoesRegistradas:number;taxaObservada:number|null}>();
 for(const [id,{d}] of snapshots){const versao=texto(d.versaoMotor)||'não informada',interesse=texto(objeto(d.interesse).estado)||'a_confirmar',adequacao=texto(objeto(d.adequacaoTurma).estado)||'a_confirmar',key=JSON.stringify([versao,interesse,adequacao]);const g=grupos.get(key)??{versao,interesse,adequacao,avaliados:0,matriculados:0,semMatriculaNoPeriodo:0,pendentes:0,acoesRegistradas:0,taxaObservada:null};g.avaliados++;
 const data=matriculas.get(id);if(data!==undefined&&limite&&data<=Date.parse(limite))g.matriculados++;else if(fechada)g.semMatriculaNoPeriodo++;else g.pendentes++;
 g.acoesRegistradas+=registros.filter(r=>{const s=objeto(r.dados);return r.tipo==='sinal'&&s.tipo==='acao_realizada'&&String(s.leadId)===id;}).length;
 g.taxaObservada=g.matriculados+g.semMatriculaNoPeriodo?g.matriculados/(g.matriculados+g.semMatriculaNoPeriodo):null;grupos.set(key,g);}
 return {janelaDias:primeira&&limite?Math.ceil((Date.parse(limite)-Date.parse(primeira))/86400000):30,ate:limite,baseAtualizadaEm:corte,coorteConcluida:fechada,grupos:[...grupos.values()],aviso:'Taxas observadas não são probabilidades individuais. Compare também o atendimento recebido; bases incompletas permanecem pendentes.'};
}
