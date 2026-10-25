"use client";

import { sugerirDataAbertura } from "@/lib/actions/aberturas-actions";
import { Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { hora } from "./utils";

type Sugestao = { data: string; diaSemana: number; inicioMinuto: number; situacao: string; docentes: number; ocupacao: number | null; frequentam: number; motivos: string[] };
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/**
 * "Sugerir a melhor data" no planejamento de uma abertura (pedido do usuário 2026-10-25): lê sala, capacidade e
 * professores já escolhidos no formulário e mostra as 3 melhores combinações de dia e horário, com o porquê.
 */
export function SugestaoData({ schoolId, onUsar }: { schoolId: string; onUsar: (data: string, inicio: string) => void }) {
  const ancora = useRef<HTMLDivElement>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<{ sugestoes: Sugestao[]; semDisponibilidade: boolean } | null>(null);

  async function sugerir() {
    const form = ancora.current?.closest("form");
    const f = new FormData(form ?? undefined);
    f.set("schoolId", schoolId);
    setErro(null);
    setCarregando(true);
    try {
      const r = (await sugerirDataAbertura(f)) as { ok: boolean; error?: string; sugestoes?: Sugestao[]; semDisponibilidade?: boolean };
      if (!r.ok) setErro(r.error ?? "Não foi possível analisar agora.");
      else setRes({ sugestoes: r.sugestoes ?? [], semDisponibilidade: !!r.semDisponibilidade });
    } catch {
      setErro("Não foi possível analisar agora.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div ref={ancora} className="flex flex-col gap-2 sm:col-span-2">
      <button
        type="button"
        onClick={sugerir}
        disabled={carregando}
        className="flex w-fit items-center gap-1.5 rounded-lg border border-na-green/50 px-3 py-1.5 text-[13px] font-semibold text-na-green-dark hover:bg-na-green-light disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
      >
        {carregando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {carregando ? "Analisando professores, salas e agenda…" : "Sugerir a melhor data"}
      </button>
      {erro && <p className="text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
      {res && (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          {res.semDisponibilidade && (
            <p className="text-[12px] text-na-warning-dark dark:text-amber-300">
              Sem a disponibilidade dos professores cadastrada (aba Equipe e horários), a sugestão não sabe quem pode dar aula; conta só agenda, salas e movimento da escola.
            </p>
          )}
          {res.sugestoes.length === 0 ? (
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhuma data livre nas próximas 10 semanas.</p>
          ) : (
            res.sugestoes.map((s, i) => (
              <div key={`${s.diaSemana}-${s.inicioMinuto}`} className="flex flex-wrap items-start justify-between gap-2 border-t border-gray-100 pt-2 first:border-0 first:pt-0 dark:border-gray-800">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">
                    {i + 1}. {new Date(`${s.data}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" })} ({DIAS[s.diaSemana]}) às {hora(s.inicioMinuto)}
                    <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${s.situacao === "viavel" ? "bg-na-success-light text-na-success-dark" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                      {s.situacao === "viavel" ? "Tudo certo" : s.situacao === "pendente" ? "Com pendências" : "Com impedimentos"}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {s.docentes} professor(es) livre(s) · {s.frequentam} pessoas já vêm à escola nesse dia{s.ocupacao !== null ? ` · sala ${s.ocupacao}% ocupada` : ""}
                  </p>
                  {s.motivos.length > 0 && <p className="text-[11px] text-gray-500 dark:text-gray-400">{s.motivos.join(" · ")}</p>}
                </div>
                <button type="button" onClick={() => onUsar(s.data, hora(s.inicioMinuto))} className="rounded-lg bg-na-green px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-na-green-dark">
                  Usar
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
