import type { AgendaItem } from "@/lib/member-data";

/**
 * Programação do mês (pedido do usuário 17/11/2026): a partir da Agenda de quem está logado, monta os compromissos
 * do mês para a arte 1080×1350 (lib/arte-programacao.ts) e o texto do WhatsApp, no guia da marca (modelo da
 * "Programação da Turma Hilárion"). Sem invenção: o que não existe no compromisso (horário, descrição) fica de fora.
 * Atendimentos individuais e enquetes não entram (são pessoais ou não têm data própria).
 */
export type TipoProgramacao = "aula" | "revisao" | "prova" | "especial" | "evento_publico";

export type ItemProgramacao = {
  /** AAAA-MM-DD no fuso da filial. */
  data: string;
  dia: number;
  mes: number; // 1-12
  semana: number; // 0 = domingo
  titulo: string;
  descricao: string | null;
  horario: string | null;
  tipo: TipoProgramacao;
};

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
export const SEMANA_ABREV = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
export const MENSAGEM_CHAVE = "Todos aprendemos e todos ensinamos";
const TITULO_MAX = 28;

const ROTULO_ATIVIDADE: Record<string, string> = { prova: "Prova", trabalho: "Trabalho", leitura: "Leitura", atividade_turma: "Atividade de turma", aviso: "Aviso" };

function dataNoFuso(date: Date, fuso: string, diaInteiro: boolean) {
  // Dia inteiro é uma data, não um instante: vale a data em UTC (mesma regra da Agenda).
  const iso = diaInteiro ? date.toISOString().slice(0, 10) : date.toLocaleDateString("en-CA", { timeZone: fuso });
  const [a, m, d] = iso.split("-").map(Number);
  return { iso, ano: a, mes: m, dia: d, semana: new Date(Date.UTC(a, m - 1, d)).getUTCDay() };
}

function hora(date: Date, fuso: string) {
  const [h, m] = date.toLocaleTimeString("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

const limpa = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
function primeiraLinha(s: string | null | undefined, max = 90) {
  const t = limpa((s ?? "").split(/\r?\n/).find((l) => l.trim()) ?? "");
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, "")}…` : t;
}

/** Título curto: se passar de ~28 caracteres e tiver separador ("Prova: Psicologia"), o resto vai para a descrição. */
function encurtar(titulo: string, descricao: string | null): { titulo: string; descricao: string | null } {
  const t = limpa(titulo);
  if (t.length <= TITULO_MAX) return { titulo: t, descricao };
  const m = t.match(/^(.{3,28}?)\s*(?::|\s[–—-]\s)\s*(.+)$/);
  if (!m) return { titulo: t, descricao };
  return { titulo: m[1], descricao: descricao ? `${m[2]} · ${descricao}` : m[2] };
}

export function itensDoMes(items: AgendaItem[], ano: number, mes: number, fuso: string): ItemProgramacao[] {
  const saida: ItemProgramacao[] = [];
  for (const it of items) {
    if (it.kind === "atendimento" || it.kind === "enquete") continue;
    const diaInteiro = it.kind === "evento" ? it.allDay : false;
    const d = dataNoFuso(it.date, it.kind === "evento" && it.fusoLocal ? it.fusoLocal : fuso, diaInteiro);
    if (d.ano !== ano || d.mes !== mes) continue;
    let base: { titulo: string; descricao: string | null; horario: string | null; tipo: TipoProgramacao };
    if (it.kind === "reuniao") {
      if (/cancel/i.test(it.status)) continue;
      const revisao = /revis/i.test(it.title);
      // Turma de pedagogos (24/11/2026): a descrição passa a ser quem apresenta e o tema.
      const descricao = it.apresentacoes?.length ? it.apresentacoes.join("; ") : it.leitura ?? primeiraLinha(it.description);
      base = { titulo: it.title || "Aula", descricao, horario: hora(it.date, fuso), tipo: revisao ? "revisao" : "aula" };
    } else if (it.kind === "atividade") {
      const assunto = [it.materiaNome, it.temas?.length ? it.temas.join(", ") : null].filter(Boolean).join(" · ") || primeiraLinha(it.description);
      const rotulo = ROTULO_ATIVIDADE[it.type] ?? "Atividade";
      const titulo = it.type === "prova" ? "Prova" : limpa(it.title) || rotulo;
      base = { titulo, descricao: assunto || (titulo !== limpa(it.title) ? primeiraLinha(it.title) : null), horario: null, tipo: it.type === "prova" ? "prova" : /revis/i.test(it.title) ? "revisao" : "aula" };
    } else {
      if (/cancel/i.test(it.status ?? "")) continue;
      const especial = /especial|confraterniza|festa|celebra/i.test(it.title);
      base = {
        titulo: it.title,
        descricao: limpa(it.location) || null,
        horario: it.allDay ? null : hora(it.date, it.fusoLocal ?? fuso),
        tipo: especial ? "especial" : it.source === "ulisses" ? "evento_publico" : "especial",
      };
    }
    const curto = encurtar(base.titulo, base.descricao);
    saida.push({ data: d.iso, dia: d.dia, mes: d.mes, semana: d.semana, ...base, ...curto });
  }
  return saida.sort((a, b) => a.data.localeCompare(b.data) || (a.horario ?? "").localeCompare(b.horario ?? ""));
}

/** Turma mais frequente nos compromissos do mês (aulas e atividades); null se não houver. */
export function turmaDoMes(items: AgendaItem[]): string | null {
  const conta = new Map<string, number>();
  for (const it of items) if ((it.kind === "reuniao" || it.kind === "atividade") && it.className) conta.set(it.className, (conta.get(it.className) ?? 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const dd = (n: number) => String(n).padStart(2, "0");
export const descricaoComHorario = (i: ItemProgramacao) => [i.descricao, i.horario].filter(Boolean).join(" · ") || null;

/** Texto do WhatsApp que acompanha a arte (formatação do WhatsApp, até 3 emojis, ~900 caracteres). */
export function textoWhatsappProgramacao(d: { turma: string | null; publico: string; ano: number; mes: number; itens: ItemProgramacao[]; abertos?: boolean; escola?: string; hoje?: string }) {
  let emojis = 1; // 🏛️ do título
  const mesNome = MESES[d.mes - 1];
  // Só eventos abertos (membro sem atribuições ou aluno, 17/11/2026): convite para qualquer pessoa.
  const linhas = d.abertos
    ? [`*Programação aberta da Nova Acrópole${d.escola ? ` ${d.escola}` : ""} em ${mesNome}* 🏛️`, `Segue a nossa programação aberta ao público em ${mesNome}. Venha participar e traga quem você quiser!`, ""]
    : [`*Programação ${d.turma ? `da ${d.turma}` : "do mês"} em ${mesNome}* 🏛️`, `Queridos ${d.publico.toLowerCase()}, segue a nossa agenda de ${mesNome}. Já anotem!`, ""];
  const eventos: string[] = [];
  for (const i of d.itens) {
    const quando = `*${dd(i.dia)}/${dd(i.mes)} (${SEMANA_ABREV[i.semana].toLowerCase()})${i.horario ? `, ${i.horario}` : ""}*`;
    const titulo = i.tipo === "prova" ? "*Prova*" : i.titulo;
    const apresentacoes = i.descricao?.includes(" — ") ? i.descricao.split("; ").filter((x) => x.includes(" — ")) : [];
    let linha = apresentacoes.length ? `${quando} – ${titulo}\n${apresentacoes.map((a) => `   • ${a}`).join("\n")}` : `${quando} – ${titulo}${i.descricao ? `: ${i.descricao}` : ""}`;
    if (i.tipo === "prova" && emojis < 3) {
      linha = `⚠️ ${linha}`;
      emojis++;
    } else if (/confraterniza|festa/i.test(i.titulo) && emojis < 3) {
      linha = `${linha} 🎉`;
      emojis++;
    }
    // Dia já passado (24/11/2026): riscado no WhatsApp.
    if (d.hoje && i.data < d.hoje) linha = linha.split("\n").map((l) => `~${l.trim()}~`).join("\n");
    eventos.push(linha);
  }
  const fim = ["", d.abertos ? "Contamos com a sua presença! Qualquer dúvida, é só chamar." : "Contamos com a presença de todos! Qualquer dúvida, é só chamar.", "", `_${MENSAGEM_CHAVE}_`];
  // Cabe em ~900 caracteres: corta as últimas linhas de compromisso se precisar, avisando que há mais no Portal.
  let corpo = eventos;
  const tamanho = (l: string[]) => [...linhas, ...l, ...fim].join("\n").length;
  // Com apresentações (uma por linha) o texto cresce; o limite sobe para caber o mês inteiro (24/11/2026).
  const limite = eventos.some((l) => l.includes("\n   • ")) ? 1800 : 900;
  if (tamanho(corpo) > limite) {
    while (corpo.length > 1 && tamanho([...corpo, "…e mais compromissos no Portal."]) > limite) corpo = corpo.slice(0, -1);
    corpo = [...corpo, "…e mais compromissos no Portal."];
  }
  return [...linhas, ...corpo, ...fim].join("\n");
}
