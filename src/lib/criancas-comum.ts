/**
 * Crianças e adolescentes dos programas (pedido do usuário 18/11/2026): Correntinha (CO) e Távolas (TA), do Merlin, e
 * Janos (JN). Não têm login próprio no Portal: tudo passa pelo responsável (lib/responsaveis.ts). Sem acesso ao banco.
 */
export const NIVEIS_INFANTIS = ["CO", "TA", "JN"] as const;
export const ehCrianca = (m: { nivel?: string | null }) => !!m.nivel && (NIVEIS_INFANTIS as readonly string[]).includes(m.nivel.toUpperCase());
export const programaDoNivel = (nivel: string | null | undefined): "MERLIN" | "JANOS" | null =>
  nivel === "JN" ? "JANOS" : nivel === "CO" || nivel === "TA" ? "MERLIN" : null;
export const NOME_NIVEL: Record<string, string> = { CO: "Correntinha", TA: "Távolas", JN: "Janos" };
