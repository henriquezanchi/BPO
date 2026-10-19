"use client";

import { PerguntaPresenca } from "@/components/grupos/pergunta-presenca";
import { MODALIDADES, TIPOS_GRUPO, type TipoGrupo } from "@/lib/grupos-comum";
import { CalendarClock, ChevronRight, MapPin, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Avisos = {
  hoje: { id: string; title: string; startsAt: string; classGroup: { id: string; name: string; tipo: string; modalidade: string | null; local: string | null; linkOnline: string | null } }[];
  perguntas: { id: string; title: string; startsAt: string; classGroup: { name: string; tipo: string } }[];
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
const tipo = (t: string) => TIPOS_GRUPO[t as TipoGrupo]?.nome ?? "";

/**
 * Avisos dos grupos no Portal do Aluno (pedido do usuário 2026-10-19):
 * o encontro de hoje (GAF, GDVE, secretaria) e, depois dele, a pergunta
 * "você participou?", com motivo opcional e "prefiro não informar".
 * Quando houver app, o mesmo aviso vira notificação no celular.
 */
export function AvisosGrupos({ avisos }: { avisos: Avisos }) {
  const [respondidas, setRespondidas] = useState<string[]>([]);
  const perguntas = avisos.perguntas.filter((p) => !respondidas.includes(p.id));
  if (!avisos.hoje.length && !perguntas.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Seus grupos">
      {avisos.hoje.map((e) => (
        <div key={e.id} className="flex flex-col gap-1 rounded-2xl border border-na-gold/40 bg-na-gold/10 p-3.5 dark:border-na-gold/30 dark:bg-na-gold/10">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-na-gold-dark uppercase dark:text-na-gold">
            <CalendarClock size={13} /> Hoje às {hora(e.startsAt)} · {tipo(e.classGroup.tipo)}
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{e.classGroup.name}</span>
          <span className="flex flex-wrap items-center gap-x-3 text-[12px] text-gray-600 dark:text-gray-300">
            {e.classGroup.modalidade && <span>{MODALIDADES[e.classGroup.modalidade]}</span>}
            {e.classGroup.local && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {e.classGroup.local}
              </span>
            )}
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {e.classGroup.linkOnline && (
              <a
                href={e.classGroup.linkOnline}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-9 items-center gap-1.5 rounded-lg bg-na-green px-3 text-[12px] font-semibold text-white hover:bg-na-green-dark"
              >
                <Video size={13} /> Entrar na videochamada
              </a>
            )}
            <Link
              href={`/grupos/${e.classGroup.id}?de=portal`}
              className="flex min-h-9 items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 text-[12px] font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            >
              Ver o grupo <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      ))}
      {perguntas.map((p) => (
        <div key={p.id} className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-700 dark:bg-gray-900">
          <span className="text-[12px] text-gray-500 capitalize dark:text-gray-400">
            {tipo(p.classGroup.tipo)} · {dia(p.startsAt)}
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{p.classGroup.name}</span>
          <PerguntaPresenca meetingId={p.id} atual={null} onSalvo={() => setTimeout(() => setRespondidas((r) => [...r, p.id]), 1500)} />
        </div>
      ))}
    </section>
  );
}
