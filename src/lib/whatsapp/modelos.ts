/**
 * Modelos de mensagem do WhatsApp do financeiro (categoria UTILIDADE, pt_BR). O texto é o que a Meta aprova: o
 * Portal só preenche as variáveis {{1}}, {{2}}... Mudar um texto aqui exige cadastrar o modelo de novo
 * (scripts/whatsapp-modelos.ts) e esperar a aprovação. A Meta não aceita variável no começo ou no fim do texto.
 * Mensagens de divulgação (marketing) ficam de fora de propósito (decisão do usuário 2026-10-26).
 */
export const IDIOMA_MODELOS = "pt_BR";

export const RODAPE_MODELOS = "Responda SAIR para não receber mais estas mensagens.";

/**
 * Botões de resposta rápida dos avisos de pagamento (12/11/2026, WhatsApp direto na Meta). O texto do botão é fixo no
 * modelo; o payload (ação + pessoa, assinado) vai no envio — ver lib/whatsapp/meta.ts e api/webhooks/whatsapp.
 */
export const BOTOES_PAGAR = ["Quero o código Pix", "Falar com a Economia"] as const;
export const ACOES_BOTOES_PAGAR = ["pix", "economia"] as const;

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
    botoes: BOTOES_PAGAR,
  },
  na_contribuicao_em_aberto: {
    descricao: "Contribuição em aberto (régua: atraso)",
    texto: "Olá, {{1}}. A Nova Acrópole {{2}} registra {{3}} de contribuição em aberto, somando {{4}}. Você pode pagar pelo Portal do Membro ou responder esta mensagem para combinar com a secretaria. Se já pagou, desconsidere.",
    exemplo: ["Maria", "Goiânia Universitário", "2 meses", "R$ 300,00"],
    botoes: BOTOES_PAGAR,
  },
  // Modelos da cobrança pelo Portal (12/11/2026, cronograma do spread). Ainda não cadastrados na Meta.
  na_contribuicao_vence_em_breve: {
    descricao: "Contribuição vence em poucos dias (antes do dia 10)",
    texto: "Olá, {{1}}! A contribuição de {{2}} à Nova Acrópole {{3}}, no valor de {{4}}, vence em {{5}}. Você pode pagar com Pix ou cartão no Portal do Membro. Se já pagou, desconsidere.",
    exemplo: ["Maria", "novembro/2026", "Goiânia Universitário", "R$ 150,00", "10/11/2026"],
    botoes: BOTOES_PAGAR,
  },
  na_contribuicao_vence_hoje: {
    descricao: "Contribuição vence hoje (dia 10)",
    texto: "Olá, {{1}}! Hoje é o último dia para pagar sem atraso a contribuição de {{2}} à Nova Acrópole {{3}}, no valor de {{4}}. Pague com Pix ou cartão no Portal do Membro. Se já pagou, desconsidere.",
    exemplo: ["Maria", "novembro/2026", "Goiânia Universitário", "R$ 150,00"],
    botoes: BOTOES_PAGAR,
  },
  na_pix_codigo: {
    descricao: "Código Pix Copia e Cola da contribuição (pedido pela pessoa ou enviado pela Economia)",
    texto: "Olá, {{1}}! Segue o código Pix da contribuição de {{2}} à Nova Acrópole {{3}}, no valor de {{4}}. Copie o código abaixo e cole no app do seu banco, em Pix Copia e Cola:\n\n{{5}}\n\nO código vale até {{6}}. Se já pagou, desconsidere.",
    exemplo: ["Maria", "novembro/2026", "Goiânia Universitário", "R$ 150,00", "00020101021226850014br.gov.bcb.pix2563qrpix.exemplo", "12/11/2026"],
  },
  na_debito_automatico_ativado: {
    descricao: "Pix Automático autorizado (débito mensal ativo)",
    texto: "Olá, {{1}}! O débito automático da sua contribuição à Nova Acrópole {{2}} está ativo. Todo mês, o valor de {{3}} será debitado perto do dia {{4}}, sem você precisar abrir o Portal. Você pode cancelar quando quiser pelo app do seu banco.",
    exemplo: ["Maria", "Goiânia Universitário", "R$ 150,00", "10"],
  },
  na_debito_automatico_falhou: {
    descricao: "Débito automático do mês não concluído pelo banco",
    texto: "Olá, {{1}}. O débito automático da contribuição de {{2}} à Nova Acrópole {{3}}, no valor de {{4}}, não foi concluído pelo banco. Você pode pagar com Pix ou cartão no Portal do Membro. Se precisar de ajuda, responda esta mensagem.",
    exemplo: ["Maria", "novembro/2026", "Goiânia Universitário", "R$ 150,00"],
    botoes: BOTOES_PAGAR,
  },
  na_debito_automatico_cancelado: {
    descricao: "Autorização do débito automático cancelada, recusada ou vencida",
    texto: "Olá, {{1}}. A autorização do débito automático da sua contribuição à Nova Acrópole {{2}} não está mais ativa. Para voltar a pagar sem precisar lembrar, ative de novo no Portal do Membro, em Contribuição. Se foi engano, responda esta mensagem.",
    exemplo: ["Maria", "Goiânia Universitário"],
  },
  na_cartao_recusado: {
    descricao: "Pagamento no cartão não aprovado pela operadora",
    texto: "Olá, {{1}}. O pagamento no cartão da contribuição de {{2}} à Nova Acrópole {{3}} não foi aprovado pela operadora. Você pode tentar outro cartão ou pagar com Pix no Portal do Membro. Se precisar de ajuda, responda esta mensagem.",
    exemplo: ["Maria", "novembro/2026", "Goiânia Universitário"],
    botoes: BOTOES_PAGAR,
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
} as const satisfies Record<string, { descricao: string; texto: string; exemplo: string[]; botoes?: readonly string[] }>;

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
