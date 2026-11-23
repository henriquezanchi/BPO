"use client";

import { abrirPainelFinanceiro, criarPinFinanceiro, fecharPainelFinanceiro, solicitarRepasse } from "@/lib/actions/cobranca-online-actions";
import type { ResumoRepasse } from "@/lib/repasses";
import { Lock, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * Recebimentos pela conta provisória e repasse (23/11/2026; lib/repasses.ts). Só a direção da filial, com PIN de 6
 * números; libera por 10 minutos. Os valores só chegam ao navegador depois do PIN.
 */
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ORIGEM: Record<string, string> = { contribuicao: "Contribuição", evento: "Evento", fortuna: "Recarga Fortuna", ajuste_estorno: "Estorno (ajuste)", ajuste_tarifa: "Tarifa do repasse" };
const STATUS_COB: Record<string, string> = { pago: "Pago", pendente: "A receber", cancelado: "Cancelado", estornado: "Estornado" };
const STATUS_REP: Record<string, string> = { solicitado: "Pedido", enviado: "Em andamento", concluido: "Concluído", falhou: "Não realizado", cancelado: "Cancelado" };
const campo = "min-h-10 w-36 rounded-lg border border-gray-300 bg-white px-3 text-center text-lg tracking-[0.4em] tabular-nums dark:border-gray-700 dark:bg-gray-950";

export function RepassesPanel(p: { schoolId: string; temPin: boolean; resumo: ResumoRepasse | null; chaveOk: boolean }) {
  const [pin, setPin] = useState("");
  const [novo, setNovo] = useState({ atual: "", pin: "", repetir: "" });
  const [confirmar, setConfirmar] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, depois?: () => void) =>
    iniciar(async () => {
      const r = await fn();
      setMsg(r.ok ? (ok ? { ok: true, texto: ok } : null) : { ok: false, texto: r.error ?? "Não deu certo." });
      if (r.ok) depois?.();
    });

  if (!p.temPin)
    return (
      <form
        className="grid max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (novo.pin !== novo.repetir) return setMsg({ ok: false, texto: "Os dois PINs não são iguais." });
          rodar(() => criarPinFinanceiro(novo.pin, ""), "PIN criado. Agora digite-o para abrir.");
        }}
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">Crie o seu PIN do financeiro (6 números). Ele protege estes valores; só você o conhece.</p>
        <div className="flex flex-wrap gap-2">
          <input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={novo.pin} onChange={(e) => setNovo({ ...novo, pin: e.target.value.replace(/\D/g, "") })} placeholder="PIN" aria-label="Novo PIN" className={campo} />
          <input type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={novo.repetir} onChange={(e) => setNovo({ ...novo, repetir: e.target.value.replace(/\D/g, "") })} placeholder="Repita" aria-label="Repita o PIN" className={campo} />
        </div>
        <button type="submit" disabled={pendente || novo.pin.length !== 6} className="min-h-10 w-fit rounded-lg bg-na-green px-4 font-bold text-white disabled:opacity-50">Criar PIN</button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{msg.texto}</p>}
      </form>
    );

  if (!p.resumo)
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          rodar(() => abrirPainelFinanceiro(pin), "", () => setPin(""));
        }}
      >
        <Lock className="size-4 text-gray-500" aria-hidden />
        <input type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN" aria-label="PIN do financeiro" className={campo} />
        <button type="submit" disabled={pendente || pin.length !== 6} className="min-h-10 rounded-lg bg-na-green px-4 font-bold text-white disabled:opacity-50">Abrir</button>
        {msg && <p role="alert" className="basis-full text-sm text-red-700 dark:text-red-400">{msg.texto}</p>}
      </form>
    );

  const r = p.resumo;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
          <ShieldCheck size={16} aria-hidden /> Aberto por 10 minutos
        </span>
        <button type="button" onClick={() => rodar(() => fecharPainelFinanceiro(), "")} className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold dark:border-gray-700">Fechar agora</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Num rotulo="Disponível para repasse" valor={r.disponivel} destaque />
        <Num rotulo="A receber dos alunos" valor={r.aReceber} detalhe={`${r.aReceberQtd} cobrança(s) em aberto`} />
        <Num rotulo="Já repassado" valor={r.repassado} detalhe={r.emRepasse ? `${brl(r.emRepasse)} em andamento` : undefined} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-xl bg-gray-50 p-3 text-[13px] tabular-nums sm:grid-cols-5 dark:bg-gray-800/60">
        <Linha t="Recebido (bruto)" v={r.recebidoBruto} />
        <Linha t="Taxas do Asaas" v={-r.taxas} />
        <Linha t="Spread do Portal" v={-r.spread} />
        <Linha t="Ajustes" v={r.ajustes} />
        <Linha t="Líquido da escola" v={r.recebidoLiquido + r.ajustes} forte />
      </dl>
      {r.titular && <p className="text-xs text-gray-500">Recebido pela conta de {r.titular} em nome da escola, enquanto a conta própria não é aprovada.</p>}

      {!p.chaveOk ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Para receber, cadastre a chave Pix da escola logo abaixo (ela precisa estar liberada). Sem a chave, o repasse automático não acontece.</p>
      ) : r.disponivel >= 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          {!confirmar ? (
            <button type="button" onClick={() => setConfirmar(true)} className="min-h-11 rounded-xl bg-na-green px-4 font-bold text-white">
              Solicitar repasse de {brl(r.disponivel)}
            </button>
          ) : (
            <>
              <span className="text-sm">Transferir {brl(r.disponivel)} para a chave Pix da escola?</span>
              <button type="button" disabled={pendente} onClick={() => rodar(() => solicitarRepasse(p.schoolId), "Repasse pedido. Acompanhe a situação abaixo.", () => setConfirmar(false))} className="min-h-10 rounded-lg bg-amber-700 px-4 font-bold text-white disabled:opacity-60">
                {pendente ? "Pedindo…" : "Sim, transferir"}
              </button>
              <button type="button" onClick={() => setConfirmar(false)} className="min-h-10 rounded-lg px-3 text-sm font-semibold">Não</button>
            </>
          )}
          <span className="basis-full text-xs text-gray-500">O repasse também sai sozinho nos dias 11, 21 e no último dia do mês, a partir de R$ 10. A tarifa da transferência, quando houver, é descontada no repasse seguinte.</span>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Nada disponível para repasse agora.</p>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{msg.texto}</p>}

      {r.repasses.length > 0 && (
        <details open className="text-[13px]">
          <summary className="cursor-pointer font-semibold">Repasses</summary>
          <ul className="mt-1 grid gap-1">
            {r.repasses.map((x) => (
              <li key={x.id} className="flex flex-wrap justify-between gap-x-3 border-t border-gray-100 pt-1 tabular-nums dark:border-gray-800">
                <span>{new Date(x.data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · <b>{brl(x.valor)}</b>{x.tarifa ? ` (tarifa ${brl(x.tarifa)})` : ""}{x.automatico ? " · automático" : ""}</span>
                <span className={x.status === "concluido" ? "text-emerald-700 dark:text-emerald-400" : x.status === "falhou" ? "text-red-700 dark:text-red-400" : "text-gray-600"}>{STATUS_REP[x.status] ?? x.status}{x.erro ? ` — ${x.erro}` : ""}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="text-[13px]">
        <summary className="cursor-pointer font-semibold">Cobranças ({r.cobrancas.length})</summary>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full tabular-nums">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                <th className="py-1 pr-2">Data</th>
                <th className="py-1 pr-2">Pessoa</th>
                <th className="py-1 pr-2">Tipo</th>
                <th className="py-1 pr-2 text-right">Valor</th>
                <th className="py-1 pr-2 text-right">Líquido</th>
                <th className="py-1">Situação</th>
              </tr>
            </thead>
            <tbody>
              {r.cobrancas.map((c, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-1 pr-2">{new Date(c.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                  <td className="py-1 pr-2">{c.quem}</td>
                  <td className="py-1 pr-2">{ORIGEM[c.origem] ?? c.origem}</td>
                  <td className="py-1 pr-2 text-right">{brl(c.bruto)}</td>
                  <td className="py-1 pr-2 text-right">{c.liquido === null ? "—" : brl(c.liquido)}</td>
                  <td className="py-1">{STATUS_COB[c.status] ?? c.status}{c.repassado ? " · repassado" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Num({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: number; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${destaque ? "bg-na-green-light/60 dark:bg-emerald-950/40" : "bg-gray-50 dark:bg-gray-800/60"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">{rotulo}</p>
      <p className={`text-2xl font-black tabular-nums ${destaque ? "text-na-green-dark dark:text-emerald-400" : "text-gray-900 dark:text-gray-100"}`}>{brl(valor)}</p>
      {detalhe && <p className="text-xs text-gray-500">{detalhe}</p>}
    </div>
  );
}

function Linha({ t, v, forte }: { t: string; v: number; forte?: boolean }) {
  return (
    <div className={forte ? "font-bold" : ""}>
      <dt className="text-[11px] text-gray-500">{t}</dt>
      <dd>{brl(v)}</dd>
    </div>
  );
}
