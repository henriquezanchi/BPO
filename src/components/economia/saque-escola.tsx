"use client";

import { aprovarChavePix, cadastrarChavePix, solicitarSaque } from "@/lib/actions/cobranca-online-actions";
import { useState, useTransition } from "react";

/** Chave Pix da escola e pedido de saque (Economia → Cobrança on-line). Regras em lib/asaas/saque.ts. */
const TIPOS = { CNPJ: "CNPJ", EMAIL: "E-mail", PHONE: "Telefone", EVP: "Chave aleatória" } as const;
type Tipo = keyof typeof TIPOS;
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const campo = "min-h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-sm dark:border-gray-700 dark:bg-gray-950";

export function SaqueEscola(p: {
  schoolId: string;
  saldo: number | null;
  chave: { tipo: Tipo; chave: string; aprovada: boolean; cadastradaPor: string } | null;
  dono: boolean;
}) {
  const [editando, setEditando] = useState(!p.chave);
  const [tipo, setTipo] = useState<Tipo>(p.chave?.tipo ?? "CNPJ");
  const [chave, setChave] = useState("");
  const [valor, setValor] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const valorNum = Number(valor.replace(/\./g, "").replace(",", "."));

  const rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, depois?: () => void) =>
    iniciar(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, texto: ok } : { ok: false, texto: r.error ?? "Não deu certo." });
      if (r.ok) depois?.();
    });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Saldo disponível</p>
          <p className="text-3xl font-black tabular-nums text-gray-900 dark:text-gray-100">{p.saldo === null ? "—" : brl(p.saldo)}</p>
        </div>
        {p.saldo === null && <p className="text-[13px] text-gray-500">Não deu para consultar o saldo agora.</p>}
      </div>

      <div className="grid gap-2 rounded-xl bg-gray-50 p-3 text-[13px] dark:bg-gray-800/60">
        <p className="font-semibold text-gray-800 dark:text-gray-200">Chave Pix da escola (destino do saque)</p>
        {p.chave && !editando ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{TIPOS[p.chave.tipo]}: {p.chave.chave}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.chave.aprovada ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"}`}>
              {p.chave.aprovada ? "Liberada" : "Esperando aprovação"}
            </span>
            <button type="button" onClick={() => setEditando(true)} className="text-xs font-semibold text-na-green underline dark:text-emerald-400">Trocar</button>
            {p.dono && !p.chave.aprovada && (
              <button type="button" disabled={pendente} onClick={() => rodar(() => aprovarChavePix(p.schoolId), "Chave aprovada.")} className="rounded-md bg-na-green px-2 py-1 text-xs font-semibold text-white disabled:opacity-60">
                Aprovar chave (cadastrada por {p.chave.cadastradaPor})
              </button>
            )}
          </div>
        ) : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              rodar(() => cadastrarChavePix(p.schoolId, tipo, chave), "Chave cadastrada.", () => { setEditando(false); setChave(""); });
            }}
          >
            <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} aria-label="Tipo de chave" className={campo}>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={chave} onChange={(e) => setChave(e.target.value)} required placeholder="Chave Pix da conta bancária da escola" aria-label="Chave Pix" className={`${campo} min-w-0 flex-1 basis-56`} />
            <button type="submit" disabled={pendente} className="min-h-9 rounded-lg bg-na-green px-3 text-sm font-semibold text-white disabled:opacity-60">Salvar chave</button>
            {p.chave && <button type="button" onClick={() => setEditando(false)} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Cancelar</button>}
            <p className="basis-full text-xs text-gray-500">
              A chave CNPJ com o CNPJ da própria escola vale na hora. Outra chave só vale depois de aprovada pelo administrador do Portal, para evitar que o
              dinheiro vá para a conta de uma pessoa.
            </p>
          </form>
        )}
      </div>

      {p.chave?.aprovada && p.saldo !== null && p.saldo > 0 && (
        <form
          className="flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!confirmar) return setConfirmar(true);
            rodar(() => solicitarSaque(p.schoolId, valorNum), "Saque pedido. Acompanhe a situação na lista abaixo.", () => { setValor(""); setConfirmar(false); });
          }}
        >
          <label htmlFor="saque-valor" className="font-semibold text-gray-700 dark:text-gray-300">Sacar</label>
          <input id="saque-valor" inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setConfirmar(false); }} placeholder="0,00" required className={`${campo} w-32 tabular-nums`} />
          <button type="button" onClick={() => { setValor(p.saldo!.toFixed(2).replace(".", ",")); setConfirmar(false); }} className="text-xs font-semibold text-na-green underline dark:text-emerald-400">Tudo</button>
          <button type="submit" disabled={pendente || !(valorNum > 0)} className={`min-h-9 rounded-lg px-3 font-semibold text-white disabled:opacity-60 ${confirmar ? "bg-amber-700" : "bg-na-green"}`}>
            {pendente ? "Pedindo…" : confirmar ? `Confirmar saque de ${brl(valorNum)} para ${p.chave.chave}` : "Pedir saque"}
          </button>
        </form>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-[13px] ${msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{msg.texto}</p>}
    </div>
  );
}
