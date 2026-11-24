/**
 * Nome para mostrar nas telas (pedido do usuário 24/11/2026): "como gosta de ser chamado" quando a pessoa definiu;
 * senão, primeiro e último nome em caixa normal (o Mercúrio guarda tudo em maiúsculas). O nome completo continua
 * nos documentos e onde a identificação precisa ser exata.
 */
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
export const caixaNormal = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((p, i) => (MINUSCULAS.has(p.toLowerCase()) && i > 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ");

export function nomeExibicao(m: { name: string; apelido?: string | null }): string {
  const apelido = m.apelido?.trim();
  if (apelido) return apelido;
  const partes = m.name.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return caixaNormal(partes.join(" "));
  return caixaNormal(`${partes[0]} ${partes[partes.length - 1]}`);
}
