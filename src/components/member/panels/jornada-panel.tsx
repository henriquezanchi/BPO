import { formatDateBR } from "@/lib/format";
import { Award, BookOpen, Flame, MapPin } from "lucide-react";

interface JornadaPanelProps {
  dataEntrada: Date | null;
  dataSegundoNivel: Date | null;
  streakMeses: number;
  levelHistory: { nivel: string; changedAt: Date }[];
  badges: { badgeType: string; label: string; description: string; earnedAt: Date }[];
  integrationCourses: { courseName: string; instructor: string; date: Date }[];
}

/**
 * Conquistas cuja data de concessão é só quando o PORTAL percebeu a
 * condição (ex: alguém em dia há 8 anos "ganha" 3 meses em dia no dia em
 * que o Portal calculou) — não é marco da escola. Viram selos sem data,
 * fora da linha do tempo. Pedido do usuário 2026-10-18: data do Portal não
 * vira marco.
 */
const SEM_DATA_REAL = new Set(["streak_3", "streak_6", "streak_12", "streak_24", "eventos_1", "eventos_5", "eventos_10"]);

/**
 * Linha do tempo do membro na escola — decisão do usuário 2026-09-28. Só
 * entra aqui o que tem data real: entrada e 2º nível vêm do Mercúrio
 * (banco de consulta, ver mercurio-db/importar.ts); cursos de integração,
 * da ficha; "1 ano de casa" é calculado da entrada. Sem data de entrada
 * conhecida, NÃO usa a data de entrada no Portal como aproximação.
 */
export function JornadaPanel({ dataEntrada, dataSegundoNivel, streakMeses, levelHistory, badges, integrationCourses }: JornadaPanelProps) {
  const umAnoDeCasa = dataEntrada ? new Date(Date.UTC(dataEntrada.getUTCFullYear() + 1, dataEntrada.getUTCMonth(), dataEntrada.getUTCDate(), 12)) : null;

  const eventos = [
    ...(dataEntrada ? [{ data: dataEntrada, titulo: "Entrou na Nova Acrópole", tipo: "entrada" as const }] : []),
    ...(dataSegundoNivel ? [{ data: dataSegundoNivel, titulo: "Passou para o 2º nível", tipo: "nivel" as const }] : []),
    ...levelHistory.map((l) => ({ data: l.changedAt, titulo: `Passou para o nível "${l.nivel}"`, tipo: "nivel" as const })),
    ...badges
      .filter((b) => !SEM_DATA_REAL.has(b.badgeType))
      .flatMap((b) => {
        if (b.badgeType === "um_ano_casa") return umAnoDeCasa ? [{ data: umAnoDeCasa, titulo: b.label, subtitulo: b.description, tipo: "conquista" as const }] : [];
        return [{ data: b.earnedAt, titulo: b.label, subtitulo: b.description, tipo: "conquista" as const }];
      }),
    ...integrationCourses.map((c) => ({ data: c.date, titulo: c.courseName, subtitulo: `Instrutor: ${c.instructor}`, tipo: "curso" as const })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  const selos = badges.filter((b) => SEM_DATA_REAL.has(b.badgeType));

  return (
    <div className="text-left">
      {streakMeses > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-na-warning/30 bg-na-warning-light p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <Flame size={24} className="shrink-0 text-na-warning" />
          <div>
            <p className="text-sm font-bold text-na-warning-dark dark:text-amber-300">
              {streakMeses} {streakMeses === 1 ? "mês" : "meses"} em dia
            </p>
            <p className="text-[11px] text-na-warning-dark dark:text-amber-400">Continue assim!</p>
          </div>
        </div>
      )}

      {selos.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {selos.map((b) => (
            <span
              key={b.badgeType}
              title={b.description}
              className="inline-flex items-center gap-1 rounded-full bg-na-green-light px-2.5 py-1 text-[11px] font-semibold text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-400"
            >
              <Award size={11} /> {b.label}
            </span>
          ))}
        </div>
      )}

      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Sua caminhada até aqui:</p>

      {eventos.length === 0 ? (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">Seus marcos na escola vão aparecer aqui.</p>
      ) : (
        <ul className="flex flex-col gap-3 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
          {eventos.map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute top-1 -left-[21px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-na-green dark:bg-emerald-500">
                {e.tipo === "entrada" && <MapPin size={8} className="text-white" />}
                {e.tipo === "conquista" && <Award size={8} className="text-white" />}
                {e.tipo === "curso" && <BookOpen size={8} className="text-white" />}
              </span>
              <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{e.titulo}</p>
              {"subtitulo" in e && e.subtitulo && <p className="text-[11px] text-gray-500 dark:text-gray-400">{e.subtitulo}</p>}
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{formatDateBR(e.data)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
