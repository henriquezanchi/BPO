/**
 * Texto das declarações da Escolástica (pedido do usuário 02/11/2026: "uma funcionalidade que gera declarações [...]
 * de que o aluno está matriculado (desde quando, em que unidade, etc), de que o voluntário realiza atividades de
 * voluntariado na escola, e quais [...] Tudo buscando os dados do mercúrio"). Só monta frases a partir dos dados já
 * lidos (ver dados.ts); não consulta nada.
 */

export type Secao = "matricula" | "instrucao" | "voluntariado" | "cursos";
export const SECOES: { id: Secao; rotulo: string; descricao: string }[] = [
  { id: "matricula", rotulo: "Matrícula", descricao: "Desde quando, unidade, nível e turma." },
  { id: "instrucao", rotulo: "Instrução", descricao: "Desde quando dá aula, dias e horários, formação de instrutores." },
  { id: "voluntariado", rotulo: "Voluntariado", descricao: "Funções na escola e corpo de voluntários." },
  { id: "cursos", rotulo: "Cursos e seminários", descricao: "Cursos da Nova Acrópole de que participou." },
];

export type DadosDeclaracao = {
  nome: string;
  matricula: string;
  feminino: boolean;
  unidade: { nome: string; cnpj: string | null; endereco: { logradouro: string; bairro: string | null; cep: string | null } | null; cidade: string; uf: string };
  ingresso: string | null; // AAAA-MM-DD
  reingresso: string | null;
  nivel: string | null; // "Nível 2"
  nivelDesde: string | null; // data de entrada no 2º nível (cad_2o_nivel)
  formatura: string | null;
  turma: { nome: string; dia: string | null; horario: string | null; inicio: string | null } | null;
  aulas: { inicio: string | null; dia: string | null; horario: string | null }[];
  pedagogo: "formacao" | "instrutor" | null;
  funcoes: { nome: string; atual: boolean; inicio: string | null; termino: string | null }[];
  voluntariado: { situacao: "brigadista" | "provacionista"; corpo: string } | null;
  cursos: { nome: string; data: string | null }[];
  diretor: { nome: string; feminino: boolean } | null;
};

export type Declaracao = { titulo: string; paragrafos: string[]; localData: string; assinatura: { nome: string; cargo: string } | null };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "na", "no", "nas", "nos", "para", "por", "com", "à", "ao"]);

export function data(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function dataPorExtenso(d: Date): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.day)} de ${MESES[Number(p.month) - 1]} de ${p.year}`;
}

/** "PRÁTICA DE PSICOLOGIA I" → "Prática de Psicologia I" (siglas romanas ficam em maiúsculas). */
export function titulo(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(p) ? p.toUpperCase() : i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

const DIAS: Record<string, string> = {
  SEGUNDA: "às segundas-feiras",
  TERÇA: "às terças-feiras",
  QUARTA: "às quartas-feiras",
  QUINTA: "às quintas-feiras",
  SEXTA: "às sextas-feiras",
  SÁBADO: "aos sábados",
  DOMINGO: "aos domingos",
};

/** "20:00:00" → "às 20h"; "18:30:00" → "às 18h30". */
function hora(h: string | null) {
  const m = h?.match(/^(\d{1,2}):(\d{2})/);
  return m ? `às ${Number(m[1])}h${m[2] === "00" ? "" : m[2]}` : "";
}

function periodo(inicio: string | null, termino: string | null) {
  if (inicio && termino) return ` (de ${data(inicio)} a ${data(termino)})`;
  if (inicio) return ` (desde ${data(inicio)})`;
  return termino ? ` (até ${data(termino)})` : "";
}

function lista(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  // Itens com vírgula por dentro: ponto e vírgula entre eles, para não confundir onde um termina.
  const sep = itens.some((i) => i.includes(",")) ? "; " : ", ";
  return `${itens.slice(0, -1).join(sep)}${sep === "; " ? "; e " : " e "}${itens[itens.length - 1]}`;
}

/** Sede pelo cadastro da unidade no Mercúrio (o usuário confirmou em 02/11/2026 que o de BGA está certo). */
function sede(u: DadosDeclaracao["unidade"]) {
  const e = u.endereco;
  if (!e) return "";
  const cep = (e.cep ?? "").replace(/\D/g, "");
  const partes = [titulo(e.logradouro), e.bairro ? titulo(e.bairro) : "", u.cidade ? `${titulo(u.cidade)}/${u.uf}` : "", cep.length === 8 ? `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : ""];
  return `, com sede na ${partes.filter(Boolean).join(", ")}`;
}

function cnpj(c: string | null) {
  const n = (c ?? "").replace(/\D/g, "");
  return n.length === 14 ? `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}` : null;
}

export function montarDeclaracao(
  d: DadosDeclaracao,
  secoes: Secao[],
  opcoes: { finalidade?: string; hoje?: Date; assinatura?: { nome: string; cargo: string }; instrutorDesde?: string; formacaoDesde?: string } = {},
): Declaracao {
  const a = d.feminino ? "a" : "o";
  const escola = `Organização Nova Acrópole ${titulo(d.unidade.nome)}`;
  const doc = cnpj(d.unidade.cnpj);
  const paragrafos: string[] = [];
  const quem = `${d.nome}, matrícula nº ${d.matricula}`;

  // Abertura sempre identifica a pessoa e a escola; as seções escolhidas acrescentam o resto.
  if (secoes.includes("matricula")) {
    let p = `Declaramos, para os devidos fins, que ${quem}, é alun${a} regularmente matriculad${a} na ${escola}${doc ? `, inscrita no CNPJ sob o nº ${doc}` : ""}${sede(d.unidade)}, desde ${data(d.ingresso)}`;
    p += d.reingresso ? `, com reingresso em ${data(d.reingresso)}.` : ".";
    const atual: string[] = [];
    if (d.nivel) atual.push(`cursa atualmente o ${d.nivel}${d.nivelDesde ? `, no qual ingressou em ${data(d.nivelDesde)}` : ""}`);
    if (d.turma) {
      const quando = [d.turma.dia ? DIAS[d.turma.dia.toUpperCase()] : "", hora(d.turma.horario)].filter(Boolean).join(", ");
      atual.push(`na turma ${titulo(d.turma.nome)}${d.turma.inicio ? ` (turma iniciada em ${data(d.turma.inicio)})` : ""}${quando ? `, com aulas ${quando}` : ""}`);
    }
    if (atual.length) p += ` ${atual.join(", ").replace(/^./, (c) => c.toUpperCase())}.`;
    if (d.formatura) p += ` Concluiu o curso de Filosofia à Maneira Clássica em ${data(d.formatura)}.`;
    paragrafos.push(p);
  } else {
    paragrafos.push(`Declaramos, para os devidos fins, que ${quem}, integra a ${escola}${doc ? `, inscrita no CNPJ sob o nº ${doc}` : ""}${sede(d.unidade)}.`);
  }

  if (secoes.includes("instrucao")) {
    const partes: string[] = [];
    // Sem matérias nem nomes de turma (pedido do usuário 02/11/2026): só dias e horários. "Desde quando" não vem do
    // Mercúrio: tma_inicio é o início na turma ATUAL (as turmas encerradas somem do banco de consulta), então quem
    // gera informa a data, se souber.
    if (d.aulas.length || opcoes.instrutorDesde) {
      const desde = opcoes.instrutorDesde ?? null;
      const horarios = [...new Set(d.aulas.map((x) => [x.dia ? DIAS[x.dia.toUpperCase()] : "", hora(x.horario)].filter(Boolean).join(", ")).filter(Boolean))];
      partes.push(
        `Atua como instrutor${d.feminino ? "a" : ""} voluntári${a} da escola${desde ? ` desde ${data(desde)}` : ""}${horarios.length ? `, com aulas ${lista(horarios)}` : ""}. Os dias e horários de aula podem variar de acordo com a necessidade da escola e dos alunos.`,
      );
    }
    // Início na formação de instrutores também não está no Mercúrio: vem de quem gera (pedido do usuário 02/11/2026).
    if (d.pedagogo === "formacao" || opcoes.formacaoDesde)
      partes.push(`Participa do curso de formação de instrutores da Nova Acrópole${opcoes.formacaoDesde ? ` desde ${data(opcoes.formacaoDesde)}` : ""}.`);
    if (d.pedagogo === "instrutor") partes.push(`É instrutor${d.feminino ? "a" : ""} habilitad${a} pela Nova Acrópole.`);
    if (partes.length) paragrafos.push(partes.join(" "));
  }

  if (secoes.includes("voluntariado")) {
    const atuais = d.funcoes.filter((f) => f.atual);
    const anteriores = d.funcoes.filter((f) => !f.atual);
    const partes: string[] = [];
    if (atuais.length) partes.push(`Exerce na escola, de forma voluntária, ${atuais.length > 1 ? "as funções de" : "a função de"} ${lista(atuais.map((f) => `${titulo(f.nome)}${f.inicio ? `, desde ${data(f.inicio)}` : ""}`))}.`);
    if (anteriores.length) partes.push(`Exerceu anteriormente ${lista(anteriores.map((f) => `${titulo(f.nome)}${periodo(f.inicio, f.termino)}`))}.`);
    if (d.voluntariado)
      partes.push(`Integra o corpo de voluntários da Nova Acrópole como ${d.voluntariado.situacao === "brigadista" ? "brigadista" : `provacionista`}${d.voluntariado.corpo ? ` (${d.voluntariado.corpo})` : ""}.`);
    if (partes.length) paragrafos.push(partes.join(" "));
  }

  if (secoes.includes("cursos") && d.cursos.length) {
    paragrafos.push(
      d.cursos.length > 1
        ? `Participou dos seguintes cursos da Nova Acrópole: ${lista(d.cursos.map((c) => `“${titulo(c.nome)}”${c.data ? `, realizado em ${data(c.data)}` : ""}`))}.`
        : `Participou do curso “${titulo(d.cursos[0].nome)}”, da Nova Acrópole${d.cursos[0].data ? `, realizado em ${data(d.cursos[0].data)}` : ""}.`,
    );
  }

  const fim = opcoes.finalidade?.trim().replace(/[.\s]+$/, "");
  paragrafos.push(`A presente declaração é emitida a pedido d${a} interessad${a}${fim ? `, para fins de ${fim.replace(/^para fins de\s+/i, "")}` : ""}.`);

  return {
    titulo: "Declaração",
    paragrafos,
    localData: `${titulo(d.unidade.cidade)}/${d.unidade.uf}, ${dataPorExtenso(opcoes.hoje ?? new Date())}.`,
    assinatura: opcoes.assinatura ?? (d.diretor ? { nome: d.diretor.nome, cargo: d.diretor.feminino ? "Diretora" : "Diretor" } : null),
  };
}
