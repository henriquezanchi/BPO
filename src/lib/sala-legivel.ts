/** "PLATAO" → "Platão"; "ONLINE" → "Online". O Mercúrio grava em maiúsculas e às vezes sem acento. */
export function salaLegivel(sala: string | null): string | null {
  if (!sala) return null;
  const s = sala.trim().toLowerCase();
  const conhecidas: Record<string, string> = { platao: "Platão", "platão": "Platão", online: "Online" };
  return conhecidas[s] ?? s.replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
}
