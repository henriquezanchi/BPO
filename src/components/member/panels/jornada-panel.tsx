"use client";

import { formatDateBR } from "@/lib/format";
import { Award, BookOpen, ChevronDown, Flame, MapPin } from "lucide-react";
import { useState } from "react";

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
    ...integrationCourses.map((c) => ({ data: c.date, titulo: c.courseName, subtitulo: c.instructor ? `Instrutor: ${c.instructor}` : undefined, tipo: "curso" as const })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());

  const selos = badges.filter((b) => SEM_DATA_REAL.has(b.badgeType));

  // Gavetas por ano (pedido do usuário 2026-10-18) — mais recente primeiro,
  // e só ele aberto de início; dentro do ano, ordem cronológica.
  const porAno = new Map<number, typeof eventos>();
  for (const e of eventos) {
    const ano = e.data.getUTCFullYear();
    porAno.set(ano, [...(porAno.get(ano) ?? []), e]);
  }
  const anos = [...porAno.keys()].sort((a, b) => b - a);
  const [abertos, setAbertos] = useState<Set<number>>(() => new Set(anos.slice(0, 1)));
  const todosAbertos = anos.length > 0 && anos.every((a) => abertos.has(a));
  function alternar(ano: number) {
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(ano)) novo.delete(ano);
      else novo.add(ano);
      return novo;
    });
  }

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

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">Sua caminhada até aqui:</p>
        {anos.length > 1 && (
          <button
            onClick={() => setAbertos(todosAbertos ? new Set() : new Set(anos))}
            className="text-[11px] font-semibold text-na-green dark:text-emerald-400"
          >
            {todosAbertos ? "Fechar todos" : "Abrir todos"}
          </button>
        )}
      </div>

      {eventos.length === 0 ? (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">Seus marcos na escola vão aparecer aqui.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {anos.map((ano) => {
            const doAno = porAno.get(ano)!;
            const aberto = abertos.has(ano);
            return (
              <section key={ano} className="rounded-xl border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => alternar(ano)}
                  aria-expanded={aberto}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                >
                  <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{ano}</span>
                  <span className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    {doAno.length} {doAno.length === 1 ? "marco" : "marcos"}
                    <ChevronDown size={14} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {aberto && (
                  <ul className="mx-3 mb-3 flex flex-col gap-3 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
                    {doAno.map((e, i) => (
                      <li key={i} className="relative">
                        <span className="absolute top-1 -left-[21px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-na-green dark:bg-emerald-500">
                          {e.tipo === "entrada" && <MapPin size={8} className="text-white" />}
                          {e.tipo === "conquista" && <Award size={8} className="text-white" />}
                          {e.tipo === "curso" && <BookOpen size={8} className="text-white" />}
                        </span>
                        <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{e.titulo}</p>
                        {"subtitulo" in e && e.subtitulo && <p className="text-[11px] text-gray-500 dark:text-gray-300">{e.subtitulo}</p>}
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatDateBR(e.data)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
