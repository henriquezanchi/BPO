/** Públicos do calendário inteligente (mesma lista pedida para os eventos). Sem acesso ao banco: roda também no navegador. */
export type Publico = "todos" | "membros" | "fv" | "provacionistas" | "hd" | "dirigentes";

export const PUBLICOS: { id: Publico; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos os ativos" },
  { id: "membros", rotulo: "Membros" },
  { id: "fv", rotulo: "FV" },
  { id: "provacionistas", rotulo: "Provacionistas" },
  { id: "hd", rotulo: "HD" },
  { id: "dirigentes", rotulo: "Dirigentes" },
];

/** Converte os públicos do evento do Portal (EVENT_AUDIENCES, vários) para o calendário. */
export function publicosDeAudiencia(audiencias: string | string[]): Publico[] {
  const mapa: Record<string, Publico[]> = {
    todos_ativos: ["todos"],
    membros: ["membros"],
    fv: ["fv"],
    provacionistas: ["provacionistas"],
    hd: ["hd"],
    dirigentes: ["dirigentes"],
    voluntarios: ["fv"],
    direcao: ["dirigentes"],
  };
  const lista = [...new Set((Array.isArray(audiencias) ? audiencias : [audiencias]).flatMap((a) => mapa[a] ?? []))];
  return lista.length ? lista : ["todos"];
}

export const ROTULO_CAMADA = {
  aula: "Aulas das turmas",
  reuniao_grupo: "Reuniões dos grupos",
  evento_filial: "Eventos da filial",
  evento_externo: "Nacionais e regionais",
  feriado: "Feriados",
} as const;
