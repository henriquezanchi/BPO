"use client";

import { formatDateBR } from "@/lib/format";
import { Award, BookOpen, ChevronDown, DoorOpen, Flame, MapPin } from "lucide-react";
import { useState } from "react";

interface JornadaPanelProps {
  dataEntrada: Date | null;
  dataSegundoNivel: Date | null;
  streakMeses: number;
  levelHistory: { nivel: string; changedAt: Date }[];
  badges: { badgeType: string; label: string; description: string; earnedAt: Date }[];
  eventHistory?: {title:string;date:Date}[];
  integrationCourses: { courseName: string; instructor: string; date: Date }[];
  turma?: { nome: string; sala: string | null; conclusao: string | null } | null;
}

/** "2 anos e 3 meses" (pedido do usuário 06/11/2026: tempo de casa). Menos de um mês: "menos de um mês". */
export function tempoDeCasa(entrada: Date, hoje = new Date()) {
  let meses = (hoje.getUTCFullYear() - entrada.getUTCFullYear()) * 12 + (hoje.getUTCMonth() - entrada.getUTCMonth());
  if (hoje.getUTCDate() < entrada.getUTCDate()) meses--;
  if (meses < 1) return "menos de um mês";
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = anos ? `${anos} ${anos === 1 ? "ano" : "anos"}` : "";
  const m = resto ? `${resto} ${resto === 1 ? "mês" : "meses"}` : "";
  return [a, m].filter(Boolean).join(" e ");
}

const MESES_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

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
export function JornadaPanel({ dataEntrada, dataSegundoNivel, streakMeses, levelHistory, badges, integrationCourses, eventHistory=[], turma = null }: JornadaPanelProps) {
  // Aniversário de N anos de casa na data real (entrada + N anos), como o de 1 ano.
  const anosDepois = (n: number) => (dataEntrada ? new Date(Date.UTC(dataEntrada.getUTCFullYear() + n, dataEntrada.getUTCMonth(), dataEntrada.getUTCDate(), 12)) : null);
  const umAnoDeCasa = anosDepois(1);

  const eventos = [
    ...eventHistory.map(e=>({data:e.date,titulo:e.title,subtitulo:"Participação conferida pela recepção",tipo:"curso" as const})),
    ...(dataEntrada ? [{ data: dataEntrada, titulo: "Entrou na Nova Acrópole", tipo: "entrada" as const }] : []),
    ...(dataSegundoNivel ? [{ data: dataSegundoNivel, titulo: "Passou para o 2º nível", tipo: "nivel" as const }] : []),
    ...levelHistory.map((l) => ({ data: l.changedAt, titulo: `Passou para o nível "${l.nivel}"`, tipo: "nivel" as const })),
    ...badges
      .filter((b) => !SEM_DATA_REAL.has(b.badgeType))
      .flatMap((b) => {
        if (b.badgeType === "um_ano_casa") return umAnoDeCasa ? [{ data: umAnoDeCasa, titulo: b.label, subtitulo: b.description, tipo: "conquista" as const }] : [];
        const casa = b.badgeType.match(/^casa_(\d+)$/);
        if (casa) {
          const data = anosDepois(Number(casa[1]));
          return data ? [{ data, titulo: b.label, subtitulo: b.description, tipo: "conquista" as const }] : [];
        }
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
      {(dataEntrada || turma) && (
        // Cartões brancos com o ícone em destaque, como no resto do Portal (coesão visual, 10/11/2026).
        <div className="mb-3 flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
          {dataEntrada && (
            <p className="flex items-center gap-2.5 text-[15px] font-bold text-gray-900 dark:text-gray-100">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-na-green-light text-na-green dark:bg-emerald-900/40 dark:text-emerald-400">
                <DoorOpen size={17} />
              </span>
              Na Nova Acrópole há {tempoDeCasa(dataEntrada)}
            </p>
          )}
          {dataEntrada && <p className="pl-[46px] text-[12px] text-gray-600 dark:text-gray-400">Desde {formatDateBR(dataEntrada)}</p>}
          {turma && (
            <p className="mt-1 pl-[46px] text-[12px] text-gray-700 dark:text-gray-300">
              Turma <span className="font-semibold">{turma.nome}</span>
              {turma.sala && <> · {turma.sala === "Online" ? "aulas online" : `sala ${turma.sala}`}</>}
              {turma.conclusao && <> · conclusão prevista para {MESES_EXTENSO[Number(turma.conclusao.slice(5, 7)) - 1]} de {turma.conclusao.slice(0, 4)}</>}
            </p>
          )}
        </div>
      )}
      {streakMeses > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-na-gold/20 text-na-gold-dark dark:bg-amber-950/50 dark:text-amber-300">
            <Flame size={17} />
          </span>
          <div>
            <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
              {streakMeses} {streakMeses === 1 ? "mês" : "meses"} em dia
            </p>
            <p className="text-[12px] text-gray-600 dark:text-gray-400">Continue assim!</p>
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
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{formatDateBR(e.data)}</p>
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
