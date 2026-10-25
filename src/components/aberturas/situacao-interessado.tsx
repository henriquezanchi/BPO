"use client";

import { registrarAbertura } from "@/lib/actions/aberturas-actions";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Abertura } from "./types";

type Sinal = { tipo: string; valor: string | boolean; natureza: "declarado" | "observado"; rotulo: string };

const INTERESSE: Sinal[] = [
  { tipo: "interesse_declarado", valor: "conhecer", natureza: "declarado", rotulo: "Quer conhecer" },
  { tipo: "interesse_declarado", valor: "participar", natureza: "declarado", rotulo: "Quer participar" },
  { tipo: "interesse_declarado", valor: "inscrever", natureza: "declarado", rotulo: "Vai se inscrever" },
  { tipo: "interesse_declarado", valor: "depois", natureza: "declarado", rotulo: "Prefere depois" },
  { tipo: "interesse_declarado", valor: "nao", natureza: "declarado", rotulo: "Sem interesse" },
];
const FATOS: Sinal[] = [
  { tipo: "presenca_palestra", valor: true, natureza: "observado", rotulo: "Foi à palestra" },
  { tipo: "pedido_matricula", valor: true, natureza: "declarado", rotulo: "Pediu matrícula" },
  { tipo: "nao_contatar", valor: true, natureza: "declarado", rotulo: "Não quer contato" },
];
const rotuloDe = (tipo: string, valor: unknown) => [...INTERESSE, ...FATOS].find((s) => s.tipo === tipo && s.valor === valor)?.rotulo;

/**
 * Atualizar a situação do interessado com um toque (pedido do usuário 2026-10-25: "não consigo interagir nos
 * interessados"). Cada toque grava um sinal datado (origem "Portal") — a mesma regra do formulário completo.
 */
export function SituacaoInteressado({ schoolId, abertura, leadId }: { schoolId: string; abertura: Abertura; leadId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  // Últimos sinais deste interessado nesta abertura (o painel recarrega depois de cada registro).
  const sinais = abertura.registros
    .filter((r) => r.tipo === "sinal" && String((r.dados as { leadId?: unknown } | null)?.leadId ?? "") === leadId)
    .map((r) => ({ ...(r.dados as { tipo?: string; valor?: unknown; occurredAt?: string }), em: String((r as { createdAt?: unknown }).createdAt ?? "") }));
  const ultimoInteresse = [...sinais].reverse().find((s) => s.tipo === "interesse_declarado");
  const fatos = new Set(sinais.filter((s) => s.valor === true).map((s) => s.tipo));

  function registrar(s: Sinal) {
    const chave = `${s.tipo}:${String(s.valor)}`;
    setErro(null);
    setEnviando(chave);
    const f = new FormData();
    f.set("schoolId", schoolId);
    f.set("aberturaId", abertura.id);
    f.set("tipo", "sinal");
    f.set("dados", JSON.stringify({ leadId, tipo: s.tipo, valor: s.valor, occurredAt: new Date().toISOString(), origem: "Portal", natureza: s.natureza }));
    iniciar(async () => {
      const r = (await registrarAbertura(f)) as { ok: boolean; error?: string };
      setEnviando(null);
      if (!r.ok) return setErro(r.error ?? "Não foi possível registrar.");
      router.refresh();
    });
  }

  const botao = (s: Sinal, marcado: boolean) => {
    const chave = `${s.tipo}:${String(s.valor)}`;
    return (
      <button
        key={chave}
        type="button"
        disabled={!!enviando}
        onClick={() => registrar(s)}
        aria-pressed={marcado}
        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition disabled:opacity-60 ${
          marcado ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 hover:border-na-green dark:border-gray-700 dark:text-gray-200"
        }`}
      >
        {enviando === chave ? <Loader2 size={12} className="animate-spin" /> : marcado ? <Check size={12} /> : null}
        {s.rotulo}
      </button>
    );
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg bg-white p-3 dark:bg-gray-900">
      <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
        Atualizar situação
        {ultimoInteresse && (
          <span className="font-normal text-gray-500 dark:text-gray-400">
            {" "}
            · última: {rotuloDe("interesse_declarado", ultimoInteresse.valor) ?? String(ultimoInteresse.valor)}
            {ultimoInteresse.occurredAt ? ` em ${new Date(ultimoInteresse.occurredAt).toLocaleDateString("pt-BR")}` : ""}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {INTERESSE.map((s) => botao(s, ultimoInteresse?.valor === s.valor))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FATOS.map((s) => botao(s, fatos.has(s.tipo)))}
      </div>
      {erro && <p className="text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
    </div>
  );
}
