/**
 * Diário de FV (pedido do usuário 2026-10-31): regras e textos compartilhados entre servidor e tela. Os textos vêm do
 * diário de FV antigo (repositório diario-filosofico-fv, especificação em docs/CONTINUIDADE-VOLUNTARIADO-DIARIOS.md),
 * sem os recursos de IA. Privado: só a própria pessoa (ver lib/fv/dados.ts).
 */
import { BASTIOES_DB, type Bastiao } from "@/lib/fv/bastioes";

// ---------- Degrau (A Escalada): os itens da Carta de Degrau ----------
export const ITENS_CARTA = [
  { id: "item1", rotulo: "1 – VARRER POR DENTRO", descricao: "Exame da personalidade, descobrir os nós, buscar as causas que os geraram, encontrar a fórmula de limpeza (redenção) e aplicá-las." },
  {
    id: "item2",
    rotulo: "2 – AS LEIS DA MATÉRIA",
    descricao: "Descobrir como atuam em nós os ciclos da matéria (para não nos afetarem): instintos de conservação/procriação, idade, enfermidade, ânimo, humor, ideias, sentimentos, ambiente.",
  },
  { id: "item34", rotulo: "3 e 4 – TRABALHO ORDENADO E EFICAZ", descricao: "Colocar ordem na vida. Necessária disciplina e perseverança: exercícios de ordem e limpeza." },
  { id: "item5", rotulo: "5 – ECONOMIA DE TEMPO E ENERGIA", descricao: "Requer atenção." },
  { id: "item6", rotulo: "6 – OS VÍCIOS", descricao: "Superar: preguiça, gula e luxúria e outros da mesma natureza (apatia, moleza, debilidade, negligência). Moderar: álcool e fumo. Proibido: drogas." },
  {
    id: "item7",
    rotulo: "7 – AS VIRTUDES: PERSEVERANÇA E CONSTÂNCIA",
    descricao: "Perseverança: repetir sem rotina com sentido de perfeição. Constância: estabilidade e consciência elevada. (Nota: Comentar sobre frequência no diário, carta, exercícios, ED, etc).",
  },
] as const;

export const SUBITENS_2 = [
  ["instintos", "Instintos (Conserv. / Procriação)"],
  ["idade", "Idade"],
  ["enfermidade", "Enfermidade"],
  ["animo", "Ânimo"],
  ["humor", "Humor"],
  ["ideias", "Ideias"],
  ["sentimentos", "Sentimentos"],
  ["ambiente", "Ambiente"],
] as const;

/** Todas as chaves de texto do Degrau (o item 2 tem as oito subdivisões; "item2" sozinho só vem do diário antigo). */
export const CHAVES_DEGRAU = ["item1", ...SUBITENS_2.map(([k]) => `item2_${k}`), "item2", "item34", "item5", "item6", "item7"];

export type ItensDegrau = Record<string, string>;

/** Texto de um item no dia (o item 2 junta as subdivisões), para contar e para o Histórico da Carta. */
export function textoDoItem(itens: ItensDegrau, id: string, rotulosCurtos = false) {
  const t = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (id !== "item2") return t(itens[id]);
  const partes = SUBITENS_2.filter(([k]) => t(itens[`item2_${k}`])).map(([k, r]) => `${rotulosCurtos && k === "instintos" ? "Instintos" : r}: ${t(itens[`item2_${k}`])}`);
  if (t(itens.item2)) partes.push(t(itens.item2));
  return partes.join("\n");
}

// ---------- Forja do Caráter: práticas ----------
export type ChavePratica = "tratak" | "recitarHonra" | "recitar7Fases" | "camara" | "formasGeometricas" | "porta" | "patioAberto" | "patioColunas" | "santuario";

/** Práticas da Forja; o Tratak fica nas práticas do diário comum (DiarioDia), as demais em DiarioFvDia. */
export const PRATICAS_FORJA: { chave: ChavePratica; rotulo: string }[] = [
  { chave: "tratak", rotulo: "Tratak" },
  { chave: "recitarHonra", rotulo: "Recitar Código de Dignidade" },
  { chave: "recitar7Fases", rotulo: "Recitar 7 fases da ED" },
  { chave: "camara", rotulo: "Câmara de Purificação" },
  { chave: "formasGeometricas", rotulo: "Formas Geométricas" },
];

export const ETAPAS_TEMPLO: { chave: ChavePratica; rotulo: string }[] = [
  { chave: "porta", rotulo: "1. Porta" },
  { chave: "patioAberto", rotulo: "2. Pátio Aberto" },
  { chave: "patioColunas", rotulo: "3. Pátio de Colunas" },
  { chave: "santuario", rotulo: "4. Santuário" },
];

export const CHAVES_PRATICA_FV = [...PRATICAS_FORJA.filter((p) => p.chave !== "tratak"), ...ETAPAS_TEMPLO].map((p) => p.chave);
export const ROTULO_PRATICA: Record<string, string> = Object.fromEntries([...PRATICAS_FORJA, ...ETAPAS_TEMPLO].map((p) => [p.chave, p.rotulo.replace(/^\d\. /, "")]));

// ---------- Balanço de Serviço e Atividades ----------
export type ChavePresenca = "aulaRegular" | "reuniaoRaio" | "aulaMinistrada" | "crm" | "aulaEd";
export const PERGUNTAS_PRESENCA: { chave: ChavePresenca; pergunta: string; sim: string; nao: string; resumo?: string }[] = [
  { chave: "aulaRegular", pergunta: "Assistiu à Aula Regular?", sim: "Sim, assisti", nao: "Não (Faltei)", resumo: "Aula Regular:" },
  { chave: "reuniaoRaio", pergunta: "Participou da Reunião de Raio?", sim: "Sim, participei", nao: "Não (Faltei)", resumo: "Reunião de Raio:" },
  { chave: "aulaMinistrada", pergunta: "Ministrou sua Aula hoje?", sim: "Sim, ministrei", nao: "Não", resumo: "Aula Ministrada:" },
  { chave: "crm", pergunta: "Esteve na CRM Mensal?", sim: "Sim, estive", nao: "Não (Faltei)" },
  { chave: "aulaEd", pergunta: "Assistiu à Aula de ED?", sim: "Sim, assisti", nao: "Não (Faltei)" },
];
export type Presencas = Partial<Record<ChavePresenca, "Sim" | "Não">>;

export type Calendario = {
  aulaRegularDia?: string; // "0" (domingo) a "6"
  aulaRegularHora?: string;
  aulaRegularFim?: string;
  reuniaoRaioDia?: string;
  reuniaoRaioHora?: string;
  reuniaoRaioFim?: string;
  aulaMinistradaDias?: string[];
  aulaMinistradaTempos?: Record<string, { inicio?: string; fim?: string }>;
  dataCrm?: string; // "AAAA-MM-DD"
  dataAulaEd?: string;
};

export const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Dia da semana (0 = domingo) de uma data civil "AAAA-MM-DD". */
export const diaDaSemana = (data: string) => new Date(`${data}T12:00:00Z`).getUTCDay();

/** Perguntas de presença do dia, pelo calendário fixo da pessoa (como no diário antigo). */
export function perguntasDoDia(cal: Calendario, data: string): ChavePresenca[] {
  const dia = String(diaDaSemana(data));
  return PERGUNTAS_PRESENCA.filter(({ chave }) =>
    chave === "aulaRegular" ? cal.aulaRegularDia === dia : chave === "reuniaoRaio" ? cal.reuniaoRaioDia === dia : chave === "aulaMinistrada" ? (cal.aulaMinistradaDias ?? []).includes(dia) : chave === "crm" ? cal.dataCrm === data : cal.dataAulaEd === data,
  ).map((p) => p.chave);
}

/** "HH:MM" -> minutos (null se vazio ou inválido). */
export function minutosDe(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v > 0 ? v : null;
}
export const hhmm = (min: number | null | undefined) => (min ? `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}` : "");
export const formatarHoras = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

/** Duração entre dois horários do calendário, em minutos. */
const duracao = (inicio?: string, fim?: string) => {
  const a = minutosDe(inicio), b = minutosDe(fim);
  return a !== null && b !== null && b > a ? b - a : 0;
};

/**
 * Horas de aula do dia: o diário antigo prometia "as horas das aulas já são calculadas sozinhas", mas nunca gravava.
 * Aqui: presença "Sim" na aula regular ou na aula ministrada vale o horário do calendário (2026-10-31).
 */
export function minutosDeAula(cal: Calendario, data: string, presencas: Presencas) {
  const dia = String(diaDaSemana(data));
  const tempo = cal.aulaMinistradaTempos?.[dia];
  return {
    assistida: presencas.aulaRegular === "Sim" ? duracao(cal.aulaRegularHora, cal.aulaRegularFim) : 0,
    ministrada: presencas.aulaMinistrada === "Sim" ? duracao(tempo?.inicio, tempo?.fim) : 0,
  };
}

// ---------- Ficha: unidade, condição, Carta de Degrau ----------
export const CONDICOES = ["GS", "GF", "GM", "Prov GS", "Prov GF", "Prov GM"];
export const UNIDADES = [
  "ACROPOLEPLAY", "AGORA", "ÁGUAS CLARAS", "ALTIPLANO", "ALTO DA GLORIA", "ANANINDEUA", "ANÁPOLIS", "ARAGUAINA", "ASA NORTE", "ASA SUL", "BARRA DO GARÇAS", "BELÉM", "BOA VISTA", "BODHIDHARMA", "BRASÍLIA", "BRASILIA SAMAMBAIA",
  "CAMPINA GRANDE", "CAMPO NOVO DO PARECIS", "CARUARU", "CATALÃO", "CEILÂNDIA", "CUIABÁ", "FAZENDA NOVA ACRÓPOLE", "FORMOSA", "FORTALEZA DIONISIO TORRES", "FORTALEZA FÁTIMA", "FORTALEZA MEIRELES", "FORTALEZA MESSEJANA", "FORTALEZA SUL", "GAMA",
  "GOIANIA CIDADE JARDIM", "GOIÂNIA ELDORADO", "GOIANIA GARAVELO", "GOIANIA II", "GOIANIA ITUMBIARA", "GOIANIA JARDIM AMÉRICA", "GOIANIA SETOR OESTE", "GOIÂNIA UNIVERSITARIO", "GUARÁ", "ITACA", "JOÃO PESSOA", "JUAZEIRO DO NORTE", "LAGO SUL", "MACAPÁ",
  "MANAUS", "MÓDULO SÃO JORGE", "MOSSORÓ", "MOSSORÓ ASSU", "NATAL CANDELARIA", "NATAL MORRO BRANCO", "NATAL PONTA NEGRA", "NATAL TIROL", "NATAL ZONA NORTE", "NOVA PARNAMIRIM", "PALMAS", "PALMAS AURENY", "PETROLINA", "PLANALTINA", "PORTO VELHO",
  "RECIFE BOA VIAGEM", "RECIFE DERBY", "RIO VERDE", "RONDONÓPOLIS", "SANTA MARIA", "SÃO LUIS", "SAO LUIS VINHAIS", "SENADOR CANEDO", "SERAPHIS", "SINOP", "SOBRADINHO", "SOBRAL", "SORRISO", "SUDOESTE", "TAGUATINGA", "TERESINA", "VALPARAISO", "Outra",
];

/** Próxima entrega sugerida: a última + 3 meses, no mesmo dia (como no diário antigo). */
export function proximaCartaSugerida(ultima: string) {
  const [a, m, d] = ultima.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + 3, d));
  return alvo.toISOString().slice(0, 10);
}

// ---------- GDVE: práticas específicas do ciclo ----------
export type TarefaGdve = { id: string; nome: string; meta: number; ciclo: boolean };

/** Cor do contador diário (vermelho, laranja, amarelo, verde-limão, verde), como no diário antigo. */
export function nivelDaTarefa(feito: number, meta: number): "zero" | "pouco" | "metade" | "quase" | "feito" {
  if (feito <= 0) return "zero";
  if (feito >= meta) return "feito";
  const p = feito / meta;
  return p <= 0.34 ? "pouco" : p <= 0.67 ? "metade" : "quase";
}

/** Tarefa que parece leitura: vira "Missão do Ciclo" com meta 1 ao criar (o usuário pode trocar). */
export const pareceLeitura = (nome: string) => /bastiao|leitura|\bler\b/.test(nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase());

const limpar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Bastião citado no nome da tarefa: pelo número, senão pelo título (um resultado, vários, ou nenhum). */
export function bastiaoDaTarefa(nome: string): { unico: Bastiao } | { varios: Bastiao[] } | null {
  const limpo = limpar(nome);
  if (!limpo.includes("bastiao") && !limpo.includes("leitura")) return null;
  const numero = nome.match(/\d+/);
  if (numero) {
    const unico = BASTIOES_DB.find((b) => b.numero === String(parseInt(numero[0], 10)));
    if (unico) return { unico };
  }
  const termo = limpo.replace("bastiao", "").replace("leitura", "").replace("ler", "").replace(/(^|\s)o(\s|$)/g, " ").trim();
  if (termo.length <= 3) return null;
  const achados = BASTIOES_DB.filter((b) => {
    const t = limpar(b.titulo);
    return t.length >= 3 && (t.includes(termo) || termo.includes(t));
  });
  return achados.length === 1 ? { unico: achados[0] } : achados.length > 1 ? { varios: achados } : null;
}

// ---------- Constância e relatório do ciclo (últimos 30 dias) ----------
export type FaixaFrequencia = { rotulo: string; relatorio: string };
export function faixaDeFrequencia(dias: number): FaixaFrequencia {
  if (dias >= 28) return { rotulo: "Sempre", relatorio: "Sempre - Fez todos os dias do mês" };
  if (dias >= 20) return { rotulo: "Frequentemente", relatorio: "Frequentemente - fez mais de 4 vezes por semana" };
  if (dias >= 12) return { rotulo: "Às vezes", relatorio: "Às vezes - fez pelo menos três vezes por semana" };
  if (dias > 0) return { rotulo: "Raramente", relatorio: "Raramente - Fez menos de duas vezes por semana" };
  return { rotulo: "Nunca", relatorio: "Nunca - Não fez nenhum dia do mês" };
}

/** Grau de constância das práticas (selo do diário antigo) e quanto falta para o próximo. */
export function constanciaDasPraticas(dias: number) {
  const graus = [
    { min: 28, nome: "Sempre" },
    { min: 20, nome: "Frequente" },
    { min: 12, nome: "Às vezes" },
    { min: 1, nome: "Raramente" },
    { min: 0, nome: "Nunca" },
  ];
  const atual = graus.find((g) => dias >= g.min)!;
  const proximo = [...graus].reverse().find((g) => g.min > dias) ?? null;
  return { atual: atual.nome, proximo: proximo?.nome ?? null, faltam: proximo ? proximo.min - dias : 0 };
}

/** Dia de FV resumido para as contas do ciclo. */
export type DiaDoCiclo = {
  data: string;
  prologo: boolean; // diário comum
  praticas: string[]; // chaves feitas (inclui "tratak")
  praticasPessoais: string[]; // nomes das práticas pessoais feitas no diário comum (limpeza, GN, estudos, bastião)
  presencas: Presencas;
  minutosVoluntariado: number;
  minutosAulaAssistida: number;
  minutosAulaMinistrada: number;
};

export function estatisticasDoCiclo(dias: DiaDoCiclo[]) {
  const nomes = dias.flatMap((d) => d.praticasPessoais.map((n) => n.toLowerCase()));
  const conta = (f: (n: string) => boolean) => nomes.filter(f).length;
  const sim = (k: ChavePresenca) => dias.filter((d) => d.presencas[k] === "Sim").length;
  return {
    diasDiario: dias.filter((d) => d.prologo).length,
    diasPraticas: dias.filter((d) => d.praticas.length > 0).length,
    totalPraticas: dias.reduce((s, d) => s + d.praticas.length, 0),
    diasVoluntariado: dias.filter((d) => d.minutosVoluntariado > 0).length,
    minutosVoluntariado: dias.reduce((s, d) => s + d.minutosVoluntariado, 0),
    minutosAulaAssistida: dias.reduce((s, d) => s + d.minutosAulaAssistida, 0),
    minutosAulaMinistrada: dias.reduce((s, d) => s + d.minutosAulaMinistrada, 0),
    aulaRegular: sim("aulaRegular"),
    aulaMinistrada: sim("aulaMinistrada"),
    raio: sim("reuniaoRaio"),
    crm: sim("crm"),
    ed: sim("aulaEd"),
    limpeza: conta((n) => /limpeza|faxina|mutirão/.test(n)),
    gn: conta((n) => /\bgn\b/.test(n) || n.includes("guarda noturna")),
    estudos: conta((n) => /estudar|matéria|curso|resumo/.test(n)),
    bastiao: conta((n) => /bastião|bastiao|leitura do ciclo/.test(n)),
  };
}
export type EstatisticasDoCiclo = ReturnType<typeof estatisticasDoCiclo>;

export function frequenciaDeVoluntariado(dias: number) {
  return dias >= 12 ? "Mais de três vezes por semana" : dias >= 5 ? "Duas a três vezes por semana" : dias >= 1 ? "Uma vez por semana" : "Não participou";
}

/** Campos que a pessoa preenche no Relatório Mensal (não ficam gravados, como no diário antigo). */
export type FormRelatorio = {
  outrasCrm: string;
  bastioesLidos: string;
  propaganda: string[];
  contribuicao: string;
  doacao: string;
  secretariaAtuacao: string;
  secretariaReuniao: string;
  secretariaMembros: string;
  pontosPositivos: string;
  desafioCrescimento: string;
};

export const OPCOES_RELATORIO = {
  outrasCrm: ["Sim", "Não", "Não teve CRM extra"],
  bastioesLidos: ["1", "2", "3", "4", "5 ou mais", "Nenhum"],
  propaganda: ["Contato Pessoal", "Divulgação WhatsApp", "Redes Sociais (Insta/Face)", "Cartazes/Folhetos", "Não tenho me envolvido"],
  contribuicao: [
    ["Sim, estou em dias", "Sim, em dias"],
    ["Sim, mas com atraso", "Sim, mas com atraso"],
    ["Não", "Não"],
  ],
  doacao: [
    ["Em espécie", "Sim, em espécie"],
    ["Objeto que necessitavam", "Objeto necessitado"],
    ["Espécie e Objeto", "Ambos"],
    ["Não tive condições/Lembrei", "Não"],
  ],
  secretarias: [
    "Abertura de Turma", "Artes", "Biblioteca", "Café Artemis", "Difusão", "Economia", "Escolástica", "GGFF", "GGMM", "GGSS", "Integração", "Livraria", "Manutenção", "Programa Janos", "Programa Merlin",
    "Escola do Esporte", "Círculo de Amigos", "Assuntos Legais", "GEA", "Assistência Social",
  ],
} as const;

const dataBR = (d: string | null | undefined) => (d ? d.split("-").reverse().join("/") : "Não informado");

/** Texto do Relatório Mensal, no modelo do diário antigo (App.jsx, generateMonthlyReportText). */
export function textoDoRelatorioMensal(p: {
  mesAno: string;
  primeiroNome: string;
  ficha: { unidade: string | null; condicao: string | null; mestre: string | null; ultimoEncontro: string | null; ultimaCarta: string | null };
  e: EstatisticasDoCiclo;
  form: FormRelatorio;
  livroAtual: string | null;
}) {
  const { e, form, ficha } = p;
  const bastioes = form.bastioesLidos || (e.bastiao > 0 ? `${e.bastiao} sessões de leitura` : "Não registrado");
  return `RELATÓRIO MENSAL - ${p.mesAno.toUpperCase()}

[IDENTIFICAÇÃO]
Nome: ${p.primeiroNome}
Unidade: ${ficha.unidade || "Não informada"}
Condição: ${ficha.condicao || "Não informada"}

[ACOMPANHAMENTO INTERNO]
Tem feito o diário? ${faixaDeFrequencia(e.diasDiario).relatorio} (App registrou ${e.diasDiario} dias)
Para quem envia CD? ${ficha.mestre || "Não informado"}
Data do último encontro: ${dataBR(ficha.ultimoEncontro)}
Data da última entrega da CD: ${dataBR(ficha.ultimaCarta)}
Assistiu aula de ED esse mês? ${e.ed > 0 ? `Sim (${e.ed}x)` : "Não"}

[IDEOLÓGICO]
Participou da CRM Mensal? ${e.crm > 0 ? "Sim" : "Não"}
Reuniões por Raio? ${e.raio} reuniões registradas
Outras CRM? ${form.outrasCrm || "-"}
Quantos bastiões leu esse mês? ${bastioes}

[ESCOLÁSTICA]
Dias de aula do Curso de Filosofia assistidos: ${e.aulaRegular} aulas
Práticas de psicologia (Tratak/Câmara/Atenção): ${faixaDeFrequencia(e.diasPraticas).relatorio} (${e.totalPraticas} práticas feitas)
Horas Aula Assistidas (Calculadas): ${formatarHoras(e.minutosAulaAssistida)}
Estudando para matérias? ${e.estudos > 0 ? `Sim (${e.estudos} sessões de estudo na Missão)` : "Não registrado"}
Livro filosófico lendo: ${p.livroAtual || "Nenhum no momento"}

[VOLUNTARIADO]
Frequência voluntariado (Calculada): ${frequenciaDeVoluntariado(e.diasVoluntariado)} (${e.diasVoluntariado} dias com serviço registrado)
Fez GN esse mês? ${e.gn > 0 ? `Sim (${e.gn}x)` : "Não"}
Horas Voluntariado Totais: ${formatarHoras(e.minutosVoluntariado)}
Ministrou aulas de filosofia? ${e.aulaMinistrada > 0 ? `Sim (${e.aulaMinistrada} aulas)` : "Não"}
Horas Aula Ministradas (Calculadas): ${formatarHoras(e.minutosAulaMinistrada)}
Escalas de limpeza: ${e.limpeza > 0 ? `${e.limpeza}` : "Nenhuma"}
Envolvimento propaganda: ${form.propaganda.join(", ") || "-"}

[FINANCEIRO]
Contribuição mensal: ${form.contribuicao || "-"}
Doação para a escola: ${form.doacao || "-"}

[SECRETARIAS]
Secretaria / Área: ${form.secretariaAtuacao || "-"}
Trabalho junto/reunião: ${form.secretariaReuniao || "-"}
Membros participando / Destaques: ${form.secretariaMembros || "-"}

[ANÁLISE E REFLEXÃO]
Pontos positivos/crescimento:
${form.pontosPositivos || "-"}

Desafio que está percebendo para crescer:
${form.desafioCrescimento || "-"}
`;
}
