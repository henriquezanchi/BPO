/** Repertório da Secretaria de Artes (24/11/2026): tipos de número e o que uma apresentação pode exigir. */
export const TIPOS_REPERTORIO = [
  ["musica", "Música"],
  ["poesia", "Poesia e leitura"],
  ["teatro", "Teatro e esquete"],
  ["danca", "Dança"],
  ["outro", "Outro"],
] as const;
export type TipoRepertorio = (typeof TIPOS_REPERTORIO)[number][0];

export const REQUISITOS_REPERTORIO = [
  ["microfone", "Microfone"],
  ["pedestal", "Pedestal de microfone"],
  ["estante", "Estante de partitura/letras"],
  ["som", "Caixa de som / mesa"],
  ["luzes", "Iluminação"],
  ["projetor", "Projetor ou TV"],
  ["teclado", "Teclado / piano"],
  ["palco", "Espaço de palco"],
  ["figurino", "Figurino / cenário"],
  ["ensaio", "Ensaio no local"],
] as const;
export const rotuloTipo = (t: string) => TIPOS_REPERTORIO.find(([k]) => k === t)?.[1] ?? t;
export const rotuloRequisito = (r: string) => REQUISITOS_REPERTORIO.find(([k]) => k === r)?.[1] ?? r;
