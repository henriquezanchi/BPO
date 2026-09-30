/**
 * Agrupamento das ~160 rubricas de pagamento reais do Mercúrio (catálogo
 * nacional da Nova Acrópole, ver SchoolPaymentRubrica) em categorias
 * práticas pro membro entender — pedido do usuário 2026-09-30: "em vez de
 * um balanço contábil frio, os principais indicadores agrupados (água,
 * luz, telefone, internet, aluguel, manutenção, propaganda etc)".
 *
 * Baseado em prefixo/palavra-chave porque a Nova Acrópole usa famílias de
 * rubrica com sufixo (ex: "PROVACIONISMO-FACEBOOK", "RELAÇÕES
 * PÚBLICAS-INTERNET" — dezenas de variações da mesma ideia). Não precisa
 * cobrir toda rubrica existente — o que não bater cai em "Outras
 * Despesas", que continua visível (não escondemos nada, só agrupamos).
 */
export const CATEGORIAS_DESPESA = [
  "Água, Luz, Telefone e Internet",
  "Aluguel e Condomínio",
  "Manutenção e Reforma",
  "Propaganda e Divulgação",
  "Pessoal e Encargos",
  "Eventos e Atividades",
  "Material Didático e Livraria",
  "Cafeteria e Restaurante",
  "Impostos e Taxas Bancárias",
  "Repasses e Fundos",
  "Outras Despesas",
] as const;

export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];

const REGRAS: [RegExp, CategoriaDespesa][] = [
  [/CONTA DE ÁGUA|CONTA DE LUZ|CONTA DE TELEFONE|ACESSO INTERNET|^GÁS$|Água\/Luz\/Telefone\/Internet/i, "Água, Luz, Telefone e Internet"],
  [/ALUGUEL|CONDOMÍNIO|LOCAÇÃO DE ESPAÇO/i, "Aluguel e Condomínio"],
  [/REFORMA|CONSTRUÇÃO|MATERIAL DE CONSTRUÇÃO|MATERIAL ELÉTRICO|MATERIAL HIDRÁULICO|BENFEITORIAS|FERRAMENTAS|Manutenção/i, "Manutenção e Reforma"],
  [/PROPAGANDA|PROVACIONISMO-|RELAÇÕES P[ÚU]BLICAS-|ATIVIDADE DE RRPP/i, "Propaganda e Divulgação"],
  [/DESP\.ADMIN\.|PREVIDÊNCIA SOCIAL|PAGAMENTO INSTRUTOR/i, "Pessoal e Encargos"],
  [/EVENTOS-|DIÁRIAS |TÁVOLAS|CURSO - COFFE BREAK|INGREDIENTES/i, "Eventos e Atividades"],
  [/^LIVRO|APOSTILAS|MATERIAL DID[ÁA]TICO|FOTOC[ÓO]PIAS|REVISTA OUTRAS EDITORAS/i, "Material Didático e Livraria"],
  [/COMPRAS PARA LANCHONETE|COMPRAS PARA RESTAURANTE|COMPRAS PARA BAZAR|COMPRAS PARA EMP[ÓO]RIO|MERCEARIA|SALGADOS|DOCES E BALAS|REFRIGERANTE|LANCHES/i, "Cafeteria e Restaurante"],
  [/IMPOSTOS E TAXAS|^IPTU$|DESPESAS BANC[ÁA]RIAS|DESPESAS CART[ÃA]O|EMPR[ÉE]STIMO/i, "Impostos e Taxas Bancárias"],
  [/^REPASSE|^FUNDO |DOAÇÃO PARA OUTRA FILIAL|SUBS[ÍI]DIOS EMPRESA/i, "Repasses e Fundos"],
];

export function categorizarRubrica(label: string | null | undefined): CategoriaDespesa {
  if (!label) return "Outras Despesas";
  for (const [regex, categoria] of REGRAS) {
    if (regex.test(label)) return categoria;
  }
  return "Outras Despesas";
}

/**
 * Fontes de receita "fora da contribuição" que o Portal consegue medir
 * sozinho (eventos, recargas Fortuna feitas pelo Portal — proxy pra
 * lanchonete). Livraria/cursos/doações não passam pelo Portal hoje, então
 * viram lançamento manual do diretor (ver OtherIncome/repasse-actions.ts).
 */
export const CATEGORIAS_OUTRAS_RECEITAS = ["livraria", "cursos", "doacoes", "outras"] as const;
export type CategoriaOutraReceita = (typeof CATEGORIAS_OUTRAS_RECEITAS)[number];

export const LABEL_OUTRAS_RECEITAS: Record<CategoriaOutraReceita, string> = {
  livraria: "Livraria",
  cursos: "Cursos e Workshops",
  doacoes: "Doações",
  outras: "Outras Receitas",
};

/**
 * Agrupamento das rubricas de RECEITA do relatório "Movimento do Período"
 * (Tesouraria > Movimento, ver mercurio/browser-session.ts#lerMovimentoSintetico)
 * nos mesmos 4 baldes que a Transparência Financeira já usa pro lado da
 * receita — achado ao vivo 2026-09-30: esse relatório é a fonte de verdade
 * real do Mercúrio (entradas E saídas por rubrica), substitui a composição
 * anterior (PaymentCharge/Event/FortunaTopUpCharge do banco local, que não
 * pegava pagamento feito direto na secretaria fora do Portal).
 */
const REGRAS_RECEITA: [RegExp, CategoriaOutraReceita | "contribuicoes" | "eventos" | "lanchonete"][] = [
  [/^CONTRIBUI[ÇC][ÃA]O/i, "contribuicoes"],
  [/EVENTO|FESTA|INSCRI[ÇC][ÃA]O CURSO|DI[ÁA]RIAS/i, "eventos"],
  [/LANCHONETE|CAF[ÉE] SOPHIA|RESTAURANTE|BAZAR|EMP[ÓO]RIO/i, "lanchonete"],
  [/DOA[ÇC][ÃA]O/i, "doacoes"],
  [/LIVRO|APOSTILA/i, "livraria"],
];

export function categorizarReceita(label: string): "contribuicoes" | "eventos" | "lanchonete" | CategoriaOutraReceita {
  for (const [regex, categoria] of REGRAS_RECEITA) {
    if (regex.test(label)) return categoria;
  }
  return "outras";
}
