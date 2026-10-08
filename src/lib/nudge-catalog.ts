/**
 * Catálogo fixo de sugestões de contribuição extra — pedido do usuário
 * 2026-10-08: "estimular (sem sermos inconvenientes) a inclusão de créditos
 * extras". Dois tipos:
 * - "fortuna": não é item de composição, é Member.fortunaTopUpRecorrente
 *   (cobrado junto de toda cobrança futura — ver process-pix-automatico.ts).
 * - "composicao": item real do catálogo da escola (SchoolCompositionCatalogItem),
 *   casado por regex no label (confirmado ao vivo nos dados reais de Barra
 *   do Garças: "CONTRIBUIÇÃO BIBLIOTECA" e "DOAÇÃO CRIANÇA PARA O BEM MENSAL"
 *   — essa última é UM item só no Mercúrio, as 3 "opções" do usuário
 *   (Transporte/Oficinas/Apadrinhar) são só valores sugeridos diferentes pro
 *   mesmo mercurioGroupId, não 3 rubricas separadas).
 *
 * Em arquivo PRÓPRIO (não dentro de nudge-actions.ts) porque um arquivo
 * "use server" só pode exportar função async — exportar esse array/tipos
 * de lá quebra o build ("A use server file can only export async
 * functions, found object" — achado real em produção, 2026-10-08).
 */
export interface NudgeOpcaoValor {
  label: string;
  valor: number;
}

export interface NudgeSuggestion {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "fortuna" | "composicao";
  labelRegex?: RegExp;
  opcoes: NudgeOpcaoValor[];
}

export const NUDGE_CATALOGO: NudgeSuggestion[] = [
  {
    id: "fortuna-recorrente",
    titulo: "Crédito recorrente na lanchonete",
    descricao: "Um valor fixo de crédito Fortuna, cobrado junto da sua contribuição todo mês — sem precisar recarregar na hora.",
    tipo: "fortuna",
    opcoes: [{ label: "Incluir R$ 50,00/mês", valor: 50 }],
  },
  {
    id: "doacao-biblioteca",
    titulo: "Doação para a Biblioteca",
    descricao: "Ajude a manter e ampliar o acervo da biblioteca da escola.",
    tipo: "composicao",
    labelRegex: /biblioteca/i,
    opcoes: [{ label: "Doar R$ 20,00/mês", valor: 20 }],
  },
  {
    id: "crianca-pelo-bem",
    titulo: "Criança pelo Bem",
    descricao: "Programa social da escola — escolha como quer contribuir.",
    tipo: "composicao",
    labelRegex: /crian[cç]a.*bem/i,
    opcoes: [
      { label: "Transporte — R$ 95,00/mês", valor: 95 },
      { label: "Oficinas e lanche — R$ 195,00/mês", valor: 195 },
      { label: "Apadrinhar a criança — R$ 280,00/mês", valor: 280 },
    ],
  },
];
