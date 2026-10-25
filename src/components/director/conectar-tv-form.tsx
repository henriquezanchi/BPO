"use client";

import { conectarTv } from "@/lib/actions/telas-actions";
import { Check, Tv } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

/** Liga a TV que mostra o código a uma tela da filial (página /tv/conectar, aberta pelo QR). */
export function ConectarTvForm({ schoolId, telas, codigoInicial }: { schoolId: string; telas: { id: string; nome: string }[]; codigoInicial: string }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [telaId, setTelaId] = useState(telas.length === 1 ? telas[0].id : "");
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [pendente, iniciar] = useTransition();

  if (!telas.length)
    return (
      <p className="mt-6 rounded-2xl border border-gray-200 p-4 text-sm dark:border-gray-700">
        Nenhuma tela criada ainda nesta filial.{" "}
        <Link href="/voluntario/eventos?aba=telas" className="font-semibold text-na-green-dark underline dark:text-emerald-400">
          Criar uma tela
        </Link>
      </p>
    );

  if (pronto)
    return (
      <div className="mt-6 space-y-3 rounded-2xl border border-na-green bg-na-green-light p-4 text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
        <p className="flex items-center gap-2 font-bold">
          <Check size={18} aria-hidden /> TV conectada
        </p>
        <p className="text-sm">Em alguns segundos ela passa a mostrar “{telas.find((t) => t.id === telaId)?.nome}”.</p>
        <Link href="/voluntario/eventos?aba=telas" className="inline-block text-sm font-semibold underline">
          Ver as telas da filial
        </Link>
      </div>
    );

  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          setErro(null);
          const r = await conectarTv(schoolId, telaId, codigo);
          if (r.ok) setPronto(true);
          else setErro(r.error);
        });
      }}
    >
      <label className="block">
        <span className="text-sm font-semibold">Código que aparece na TV</span>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="000000"
          className="mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 text-center text-2xl font-black tracking-[0.3em] dark:border-gray-700 dark:bg-gray-900"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">O que esta TV vai mostrar</legend>
        {telas.map((t) => (
          <label
            key={t.id}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${telaId === t.id ? "border-na-green bg-na-green-light dark:bg-emerald-950/40" : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900"}`}
          >
            <input type="radio" name="tela" value={t.id} checked={telaId === t.id} onChange={() => setTelaId(t.id)} className="accent-na-green" />
            <Tv size={18} className="text-na-green dark:text-emerald-400" aria-hidden />
            <span className="font-semibold">{t.nome}</span>
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={pendente || codigo.length !== 6 || !telaId} className="w-full rounded-xl bg-na-green px-4 py-3 font-bold text-white disabled:opacity-50">
        {pendente ? "Conectando…" : "Conectar TV"}
      </button>
      {erro && <p className="text-sm text-na-danger-dark dark:text-na-danger-light">{erro}</p>}
    </form>
  );
}
