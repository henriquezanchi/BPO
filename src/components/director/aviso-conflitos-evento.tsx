"use client";

import { verificarConflitos } from "@/lib/actions/calendario-actions";
import { publicosDeAudiencia } from "@/lib/calendario-comum";
import type { Conflito } from "@/lib/calendario-filial";
import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/**
 * Aviso de conflito dentro do formulário de evento (Gestão de Eventos):
 * observa os campos startsAt/endsAt/audience do próprio <form> em que está
 * e consulta o calendário da filial. Não bloqueia o cadastro.
 */
export function AvisoConflitosEvento({ schoolId }: { schoolId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [conflitos, setConflitos] = useState<Conflito[] | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let espera: ReturnType<typeof setTimeout>;
    const conferir = () => {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        const dados = new FormData(form);
        const ini = String(dados.get("startsAt") ?? "");
        const fim = String(dados.get("endsAt") ?? "");
        if (!ini || !fim) return setConflitos(null);
        // datetime-local vem sem fuso: é horário de Brasília.
        const inicio = new Date(`${ini}:00-03:00`);
        const termino = new Date(`${fim}:00-03:00`);
        if (!(termino > inicio)) return setConflitos(null);
        setCarregando(true);
        try {
          setConflitos(await verificarConflitos(schoolId, inicio.toISOString(), termino.toISOString(), publicosDeAudiencia(String(dados.get("audience") ?? "todos_ativos"))));
        } catch {
          setConflitos(null);
        } finally {
          setCarregando(false);
        }
      }, 500);
    };
    form.addEventListener("input", conferir);
    form.addEventListener("change", conferir);
    conferir();
    return () => {
      clearTimeout(espera);
      form.removeEventListener("input", conferir);
      form.removeEventListener("change", conferir);
    };
  }, [schoolId]);

  return (
    <div ref={ref} aria-live="polite">
      {carregando && (
        <p className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <Loader2 size={12} className="animate-spin" /> Conferindo o calendário da filial…
        </p>
      )}
      {!carregando && conflitos && conflitos.length === 0 && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-na-success-dark dark:text-emerald-300">
          <CheckCircle2 size={12} /> Sem conflitos para esse público nesse horário.
        </p>
      )}
      {!carregando && conflitos && conflitos.length > 0 && (
        <div className="rounded-lg border border-na-warning/40 bg-na-warning-light p-2.5 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="mb-1 text-[11px] font-semibold text-na-warning-dark dark:text-amber-300">Atenção a possíveis conflitos (o evento pode ser salvo mesmo assim):</p>
          <ul className="flex flex-col gap-0.5">
            {conflitos.slice(0, 8).map((c) => (
              <li key={c.item.id} className="flex items-start gap-1.5 text-[11px] text-gray-700 dark:text-gray-300">
                {c.gravidade === "alta" ? <AlertTriangle size={11} className="mt-0.5 shrink-0 text-na-danger" /> : <Info size={11} className="mt-0.5 shrink-0 text-gray-400" />}
                <span>
                  <strong>{c.item.titulo}</strong>
                  {c.item.diaInteiro ? "" : ` (${hora(c.item.inicio)})`} — {c.motivo}
                </span>
              </li>
            ))}
            {conflitos.length > 8 && <li className="text-[11px] text-gray-500 dark:text-gray-400">e mais {conflitos.length - 8}. Veja tudo na aba Calendário.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
