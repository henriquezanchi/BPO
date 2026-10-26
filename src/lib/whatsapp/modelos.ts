/**
 * Modelos de mensagem do WhatsApp do financeiro (categoria UTILIDADE, pt_BR). O texto é o que a Meta aprova: o
 * Portal só preenche as variáveis {{1}}, {{2}}... Mudar um texto aqui exige cadastrar o modelo de novo
 * (scripts/whatsapp-modelos.ts) e esperar a aprovação. A Meta não aceita variável no começo ou no fim do texto.
 * Mensagens de divulgação (marketing) ficam de fora de propósito (decisão do usuário 2026-10-26).
 */
export const IDIOMA_MODELOS = "pt_BR";

export const RODAPE_MODELOS = "Responda SAIR para não receber mais estas mensagens.";

export const MODELOS = {
  na_contribuicao_recebida: {
    descricao: "Contribuição recebida (recibo novo no Mercúrio ou pagamento confirmado no Portal)",
    texto: "Olá, {{1}}! A Nova Acrópole {{2}} recebeu sua contribuição de {{3}}, no valor de {{4}}. O recibo fica disponível no Portal do Membro. Obrigado!",
    exemplo: ["Maria", "Goiânia Universitário", "outubro/2026", "R$ 150,00"],
  },
  na_contribuicao_lembrete: {
    descricao: "Lembrete da contribuição do mês (régua: dia 10)",
    texto: "Olá, {{1}}! Lembrete da Nova Acrópole {{2}}: sua contribuição de {{3}}, no valor de {{4}}, está disponível para pagamento no Portal do Membro. Se já pagou, desconsidere esta mensagem.",
    exemplo: ["Maria", "Goiânia Universitário", "outubro/2026", "R$ 150,00"],
  },
  na_contribuicao_em_aberto: {
    descricao: "Contribuição em aberto (régua: atraso)",
    texto: "Olá, {{1}}. A Nova Acrópole {{2}} registra {{3}} de contribuição em aberto, somando {{4}}. Você pode pagar pelo Portal do Membro ou responder esta mensagem para combinar com a secretaria. Se já pagou, desconsidere.",
    exemplo: ["Maria", "Goiânia Universitário", "2 meses", "R$ 300,00"],
  },
  na_inscricao_confirmada: {
    descricao: "Pagamento de inscrição em evento confirmado",
    texto: "Olá, {{1}}! Recebemos o pagamento da sua inscrição em {{2}}, na Nova Acrópole {{3}}. O evento será em {{4}}. Até lá!",
    exemplo: ["Maria", "Palestra: O Mito da Caverna", "Goiânia Universitário", "15/11/2026 às 19h30"],
  },
  na_matricula_confirmada: {
    descricao: "Pagamento da matrícula pelo site confirmado",
    texto: "Olá, {{1}}! Recebemos o pagamento da sua matrícula em {{2}}, na Nova Acrópole {{3}}. A secretaria vai entrar em contato com os próximos passos. Boas-vindas!",
    exemplo: ["Maria", "Curso de Filosofia Prática", "Goiânia Universitário"],
  },
} as const satisfies Record<string, { descricao: string; texto: string; exemplo: string[] }>;

export type NomeModelo = keyof typeof MODELOS;

/** Texto final, como chega ao celular (para a fila de aprovação e o histórico). */
export function textoDoModelo(modelo: NomeModelo, parametros: string[]) {
  return MODELOS[modelo].texto.replace(/\{\{(\d+)\}\}/g, (_, n) => parametros[Number(n) - 1] ?? "");
}

/** "Nova Acrópole - Goiânia Universitário" → "Goiânia Universitário" (o modelo já diz "Nova Acrópole"). */
export const nomeCurtoDaFilial = (nome: string) => nome.replace(/^Nova Acr[oó]pole\s*[-–—]\s*/i, "").trim() || nome;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const mesPorExtenso = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`;

/** "MARIA DA SILVA" → "Maria". */
export function primeiroNome(nome: string) {
  const p = nome.trim().split(/\s+/)[0] ?? "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "tudo bem";
}

export const reais =(valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Telefone só com dígitos e DDI 55 (o Mercúrio guarda sem o país). null se não parecer celular brasileiro. */
export function telefoneInternacional(numero: string | null | undefined) {
  const d = (numero ?? "").replace(/\D/g, "");
  if (!d) return null;
  const comPais = (d.length === 12 || d.length === 13) && d.startsWith("55") ? d : `55${d}`;
  return comPais.length === 12 || comPais.length === 13 ? comPais : null;
}

/** "15/11/2026 às 19h30" no fuso da filial. */
export function dataEHora(quando: Date, fuso: string) {
  const f = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(quando);
  const v = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}h${v("minute") === "00" ? "" : v("minute")}`;
}
