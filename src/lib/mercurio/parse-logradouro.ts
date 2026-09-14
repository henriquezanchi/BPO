/**
 * O Mercúrio guarda rua+número+complemento como 1 campo de texto livre só
 * ("Logradouro") — ex: "RUA 239, 338 - APTO 1301". Pro formulário do
 * Portal ter campos separados (e autofill funcionar), tentamos separar
 * isso numa heurística best-effort.
 *
 * Padrão mais comum observado em dado real (Mercúrio, Nova Acrópole
 * Goiânia/Barra do Garças): "<RUA/AV ...>, [Nº]<número>[ -,] <resto>"
 *   "RUA 239, 338 - APTO 1301"                              -> rua "RUA 239", número "338", compl. "APTO 1301"
 *   "RUA T-30, Nº1200, APT. 504-B, RESIDENCIAL SOLAR DE FRANCE" -> rua "RUA T-30", número "1200", compl. "APT. 504-B, RESIDENCIAL SOLAR DE FRANCE"
 *   "RUA 34, 125 AP 1201, ED BOUGAINVILLE SQUARE"           -> rua "RUA 34", número "125", compl. "AP 1201, ED BOUGAINVILLE SQUARE"
 *
 * Endereços por quadra/lote (comuns em Goiânia/GO, sem número de porta
 * separado, ex: "ALAMEDA D05 QD16 LT 23") não batem no padrão — nesse
 * caso devolve tudo em `street` e deixa number/complement vazios, pro
 * próprio morador completar/corrigir pelo formulário do Portal.
 */
export interface LogradouroParseado {
  street: string;
  number: string;
  complement: string;
}

export function parseLogradouro(raw: string): LogradouroParseado {
  const trimmed = raw.trim();
  if (!trimmed) return { street: "", number: "", complement: "" };

  const match = trimmed.match(/^([^,]+),\s*(?:N[ºo°]\.?\s*)?(\d+)\s*[-,]?\s*(.*)$/i);
  if (match) {
    return {
      street: match[1].trim(),
      number: match[2].trim(),
      complement: match[3].trim(),
    };
  }

  return { street: trimmed, number: "", complement: "" };
}
