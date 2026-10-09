import { formatDateBR } from "@/lib/format";
import { Award, BookOpen, Flame, MapPin } from "lucide-react";

interface JornadaPanelProps {
  dataEntrada: Date;
  streakMeses: number;
  levelHistory: { nivel: string; changedAt: Date }[];
  badges: { badgeType: string; label: string; description: string; earnedAt: Date }[];
  integrationCourses: { courseName: string; instructor: string; date: Date }[];
}

/**
 * Linha do tempo do membro na escola — decisão do usuário 2026-09-28.
 * `dataEntrada` já vem resolvida (Member.dataEntradaEscola se preenchida
 * pelo diretor, senão Member.createdAt como aproximação — ver
 * member-data.ts). Mudança de nível só existe a partir de quando passamos
 * a capturar (2026-09-28 em diante, ver sync-monthly-status.ts) — não dá
 * pra saber retroativamente. Cursos de integração vêm da aba "CURSOS
 * INTEGRAÇÃO" da ficha do Mercúrio, fonte indicada pelo usuário
 * 2026-09-30 — ver src/lib/mercurio/browser-session.ts#lerCursosIntegracao.
 */
export function JornadaPanel({ dataEntrada, streakMeses, levelHistory, badges, integrationCourses }: JornadaPanelProps) {
  const eventos = [
    { data: dataEntrada, titulo: "Entrou na Nova Acrópole", tipo: "entrada" as const },
    ...levelHistory.map((l) => ({ data: l.changedAt, titulo: `Passou para o nível "${l.nivel}"`, tipo: "nivel" as const })),
    ...badges.map((b) => ({ data: b.earnedAt, titulo: b.label, subtitulo: b.description, tipo: "conquista" as const })),
    ...integrationCourses.map((c) => ({ data: c.date, titulo: c.courseName, subtitulo: `Instrutor: ${c.instructor}`, tipo: "curso" as const })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

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

      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Sua caminhada até aqui:</p>

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

      {badges.length === 0 && (
        <p className="mt-4 text-center text-[11px] text-gray-400 dark:text-gray-500">
          Suas conquistas vão aparecer aqui conforme você participa da escola.
        </p>
      )}
    </div>
  );
}
