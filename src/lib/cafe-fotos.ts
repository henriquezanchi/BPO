/**
 * Fotos dos produtos da lanchonete (23/11/2026, pedido do usuário: "fotos tornam a utilização mais fácil e rápida").
 * O Fortuna não guarda foto de produto; o Portal escolhe pela palavra no nome do produto. Fotos de licença livre
 * (domínio público, CC0, CC BY e CC BY-SA, do Wikimedia Commons), em public/cafe/fotos; créditos em public/cafe/fotos/creditos.txt. A primeira regra que
 * bater vale, então as mais específicas vêm antes (ex.: "pão de queijo" antes de "pão").
 */
const REGRAS: [RegExp, string][] = [
  [/p[aã]o\s+de\s+queijo/i, "pao-de-queijo"],
  [/cappuc+ino/i, "cappuccino"],
  [/caf[eé]\s+com\s+leite|latte|pingado/i, "cafe-com-leite"],
  [/caf[eé]|expresso|espresso|coado/i, "cafe"],
  [/(^|\s)(ch[aá]|mate)(\s|$)/i, "cha"],
  [/[aá]gua/i, "agua"],
  [/refri|coca|guaran[aá]|soda|lata/i, "refrigerante"],
  [/suco|vitamina/i, "suco"],
  [/coxinha/i, "coxinha"],
  [/esfi(h|f)a|empada|empadinha|pastel|salgad|enroladinho|kibe|quibe|folhad/i, "salgado"],
  [/brownie/i, "brownie"],
  [/bolo/i, "bolo"],
  [/torta|quiche/i, "torta"],
  [/biscoito|bolacha|cookie/i, "biscoito"],
  [/chocolate|bombom/i, "chocolate"],
  [/sandu[ií]che|misto|wrap|hamb[uú]rguer|lanche natural/i, "sanduiche"],
  [/p[aã]o/i, "pao"],
  [/fruta|banana|ma[cç][aã]|salada de fruta/i, "fruta"],
];

/** Fotos disponíveis em public/cafe/fotos (preenchido ao gerar as fotos; regra sem foto não mostra imagem). */
export const FOTOS_DISPONIVEIS = new Set<string>(["cafe", "cappuccino", "cafe-com-leite", "cha", "agua", "refrigerante", "suco", "pao-de-queijo", "coxinha", "salgado", "bolo", "biscoito", "chocolate", "sanduiche", "torta", "brownie", "pao", "fruta"]);

export function fotoDoProduto(titulo: string): string | null {
  const achada = REGRAS.find(([re]) => re.test(titulo))?.[1];
  return achada && FOTOS_DISPONIVEIS.has(achada) ? `/cafe/fotos/${achada}.webp` : null;
}
