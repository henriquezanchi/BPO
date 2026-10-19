"use client";

import { voltarSenhaInicial } from "@/lib/actions/senha-actions";
import { KeyRound, Loader2, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Quem esqueceu a senha: a administração volta para a inicial (6 primeiros
 * números do CPF). Funciona mesmo sem envio de e-mail configurado.
 */
export function SenhasAdmin({ pessoas }: { pessoas: { id: string; name: string }[] }) {
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const achados = useMemo(() => {
    const q = normalizar(busca.trim());
    return q.length < 2 ? [] : pessoas.filter((p) => normalizar(p.name).includes(q)).slice(0, 8);
  }, [busca, pessoas]);

  function redefinir(p: { id: string; name: string }) {
    if (!confirm(`Voltar a senha de ${p.name} para a inicial (6 primeiros números do CPF)?`)) return;
    setEmAndamento(p.id);
    setAviso(null);
    iniciar(async () => {
      const r = await voltarSenhaInicial(p.id);
      setEmAndamento(null);
      setAviso(r.ok ? { ok: true, texto: `Pronto: a senha de ${p.name} voltou a ser os 6 primeiros números do CPF. Avise a pessoa.` } : { ok: false, texto: r.error });
      if (r.ok) setBusca("");
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
          <KeyRound size={15} /> Esqueceu a senha?
        </h2>
        <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">Volte a senha da pessoa para a inicial: os 6 primeiros números do CPF dela no Mercúrio.</p>
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 dark:border-gray-700">
        <Search size={14} className="text-gray-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite o nome da pessoa" className="w-full bg-transparent text-sm outline-none" aria-label="Buscar pessoa" />
      </label>
      {achados.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
          {achados.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
              {p.name}
              <button
                disabled={emAndamento === p.id}
                onClick={() => redefinir(p)}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {emAndamento === p.id && <Loader2 size={12} className="animate-spin" />} Voltar para a inicial
              </button>
            </li>
          ))}
        </ul>
      )}
      {aviso && (
        <p role="status" className={`rounded-lg px-3 py-2 text-[12px] ${aviso.ok ? "bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-na-danger-light text-na-danger-dark dark:bg-red-950/30 dark:text-red-300"}`}>
          {aviso.texto}
        </p>
      )}
    </section>
  );
}
