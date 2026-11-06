import type { ItemCalendario } from "@/lib/calendario-filial";

/**
 * Agenda da sala (pedido do usuário 07/11/2026): o que ocupa cada sala da filial e os choques de horário. Não existe um
 * cadastro de salas; o nome vem do que já está escrito em cada lugar (turma do Mercúrio, abertura, local do evento ou do
 * grupo), então "Sala Platão", "PLATAO" e "platão" contam como a mesma sala. Online e links ficam de fora.
 */
export function chaveDaSala(sala: string | null | undefined): string | null {
  if (!sala) return null;
  const s = sala
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^sala\s+(de\s+|do\s+|da\s+)?/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s === "online" || /^https?:|zoom|meet\.google|teams/.test(s)) return null;
  return s;
}

const DUAS_HORAS = 2 * 3600_000;
function intervalo(i: ItemCalendario): [number, number] {
  const ini = new Date(i.inicio).getTime();
  if (i.diaInteiro) return [ini, ini + 24 * 3600_000];
  const fim = i.fim ? new Date(i.fim).getTime() : ini + DUAS_HORAS;
  return [ini, Math.max(fim, ini + 30 * 60_000)];
}

export type SalaDaAgenda = { sala: string; itens: ItemCalendario[]; choques: [ItemCalendario, ItemCalendario][] };

/** Itens com sala, agrupados por sala (nome mais usado como rótulo), com os pares que se sobrepõem. */
export function agendaPorSala(itens: ItemCalendario[]): SalaDaAgenda[] {
  const grupos = new Map<string, { nomes: Map<string, number>; itens: ItemCalendario[] }>();
  for (const i of itens) {
    if (i.camada === "evento_externo" || i.camada === "feriado") continue;
    const chave = chaveDaSala(i.sala);
    if (!chave) continue;
    const g = grupos.get(chave) ?? { nomes: new Map<string, number>(), itens: [] as ItemCalendario[] };
    const nome = i.sala!.trim();
    g.nomes.set(nome, (g.nomes.get(nome) ?? 0) + 1);
    g.itens.push(i);
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .map((g) => {
      const lista = g.itens.sort((a, b) => a.inicio.localeCompare(b.inicio));
      const choques: [ItemCalendario, ItemCalendario][] = [];
      for (let a = 0; a < lista.length; a++) {
        const [ia, fa] = intervalo(lista[a]);
        for (let b = a + 1; b < lista.length; b++) {
          const [ib] = intervalo(lista[b]);
          if (ib >= fa) break;
          if (ia < intervalo(lista[b])[1]) choques.push([lista[a], lista[b]]);
        }
      }
      const rotulo = [...g.nomes.entries()].sort((x, y) => y[1] - x[1])[0][0];
      return { sala: rotulo.replace(/^sala\s+/i, ""), itens: lista, choques };
    })
    .sort((a, b) => b.choques.length - a.choques.length || a.sala.localeCompare(b.sala, "pt-BR"));
}
