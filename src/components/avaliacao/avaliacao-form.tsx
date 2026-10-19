"use client";

import { responderAvaliacao } from "@/lib/actions/avaliacao-actions";
import type { Pergunta } from "@/lib/avaliacao-comum";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CampoPergunta } from "./campo-pergunta";

interface Instrutor {
  alvo: string;
  instrutorNome: string;
  turmaNome: string;
  materias: string[];
}

export function AvaliacaoForm({
  campanhaId,
  titulo,
  introducao,
  perguntas,
  instrutores,
  geralPendente,
}: {
  campanhaId: string;
  titulo: string;
  introducao: string;
  perguntas: Pergunta[];
  instrutores: Instrutor[];
  geralPendente: boolean;
}) {
  const doInstrutor = perguntas.filter((p) => p.parte === "instrutor");
  const gerais = perguntas.filter((p) => p.parte === "geral");
  const [porInstrutor, setPorInstrutor] = useState<Record<string, Record<string, string | number>>>({});
  const [naoTeveAula, setNaoTeveAula] = useState<Record<string, boolean>>({});
  const [geral, setGeral] = useState<Record<string, string | number>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [isPending, startTransition] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const r = await responderAvaliacao(campanhaId, {
        instrutores: instrutores.map((i) => ({ alvo: i.alvo, naoTeveAula: !!naoTeveAula[i.alvo], respostas: porInstrutor[i.alvo] ?? {} })),
        geral: geralPendente && gerais.length ? geral : null,
      });
      if (r.ok) setEnviado(true);
      else setErro(r.error);
    });
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-na-success/40 bg-na-success-light p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
        <CheckCircle2 size={28} className="text-na-success-dark dark:text-emerald-300" />
        <p className="text-sm font-semibold text-na-success-dark dark:text-emerald-300">Obrigado! Suas respostas foram registradas de forma anônima.</p>
        <Link href="/portal" className="text-[12px] font-semibold text-na-green underline dark:text-emerald-400">
          Voltar ao Portal
        </Link>
      </div>
    );
  }

  const secoesGerais = [...new Set(gerais.map((p) => p.secao))];

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">{titulo}</h1>
        <p className="mt-2 text-[13px] whitespace-pre-line text-gray-600 dark:text-gray-300">{introducao}</p>
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-gray-50 p-2.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <Lock size={13} className="mt-0.5 shrink-0" />
          As respostas são gravadas sem o seu nome, sem matrícula e sem horário. Ninguém da escola consegue ver quem respondeu o quê. Os resultados só aparecem quando há pelo menos 3 respostas.
        </p>
      </div>

      {instrutores.length > 0 && doInstrutor.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{doInstrutor[0].secao}</h2>
          {instrutores.map((i) => {
            const pulou = !!naoTeveAula[i.alvo];
            return (
              <div key={i.alvo} className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                <div>
                  <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">{i.instrutorNome}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {i.turmaNome} · {i.materias.join(", ")}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-400">
                  <input type="checkbox" checked={pulou} onChange={(e) => setNaoTeveAula((a) => ({ ...a, [i.alvo]: e.target.checked }))} className="h-4 w-4 accent-na-green" />
                  Não tive aula com este(a) instrutor(a)
                </label>
                {!pulou &&
                  doInstrutor.map((p) => (
                    <CampoPergunta
                      key={p.id}
                      p={p}
                      nome={`${i.alvo}-${p.id}`}
                      valor={porInstrutor[i.alvo]?.[p.id]}
                      onChange={(v) => setPorInstrutor((a) => ({ ...a, [i.alvo]: { ...a[i.alvo], [p.id]: v } }))}
                    />
                  ))}
              </div>
            );
          })}
        </section>
      )}

      {geralPendente &&
        secoesGerais.map((secao) => (
          <section key={secao} className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{secao}</h2>
            {gerais
              .filter((p) => p.secao === secao)
              .map((p) => (
                <CampoPergunta key={p.id} p={p} nome={`geral-${p.id}`} valor={geral[p.id]} onChange={(v) => setGeral((a) => ({ ...a, [p.id]: v }))} />
              ))}
          </section>
        ))}

      {erro && <p className="text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
      >
        {isPending && <Loader2 size={15} className="animate-spin" />} Enviar respostas
      </button>
    </form>
  );
}
