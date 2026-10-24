"use client";

import { atualizarTela, criarTela, excluirTela, trocarLinkTela } from "@/lib/actions/telas-actions";
import { PUBLICOS_TELA, type PublicoTela } from "@/lib/telas-publicos";
import { Check, Copy, ExternalLink, Pencil, RefreshCw, Trash2, Tv } from "lucide-react";
import { useState, useTransition } from "react";

export type TelaResumo = { id: string; nome: string; publicos: string[]; token: string };

const OPCOES = Object.entries(PUBLICOS_TELA) as [PublicoTela, string][];

function SeletorPublicos({ valor, onChange }: { valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Públicos exibidos">
      {OPCOES.map(([chave, rotulo]) => {
        const marcado = valor.includes(chave);
        return (
          <button
            key={chave}
            type="button"
            aria-pressed={marcado}
            onClick={() => onChange(marcado ? valor.filter((p) => p !== chave) : [...valor, chave])}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-na-green ${
              marcado ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 hover:border-na-green hover:text-na-green-dark dark:border-gray-600 dark:text-gray-200"
            }`}
          >
            {marcado && <Check size={14} aria-hidden />}
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}

function CartaoTela({ schoolId, tela, origem }: { schoolId: string; tela: TelaResumo; origem: string }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(tela.nome);
  const [publicos, setPublicos] = useState(tela.publicos);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const link = `${origem}/tv/${tela.token}`;

  const rodar = (acao: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) =>
    iniciar(async () => {
      setErro(null);
      const r = await acao();
      if (!r.ok) setErro(r.error ?? "Não foi possível concluir.");
      else depois?.();
    });

  return (
    <li className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
      {editando ? (
        <div className="space-y-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} aria-label="Nome da tela" className="w-full rounded-lg border border-gray-300 bg-transparent p-2 text-sm dark:border-gray-700" />
          <SeletorPublicos valor={publicos} onChange={setPublicos} />
          <div className="flex gap-2">
            <button type="button" disabled={pendente} onClick={() => rodar(() => atualizarTela(schoolId, tela.id, nome, publicos), () => setEditando(false))} className="rounded-lg bg-na-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Salvar
            </button>
            <button type="button" onClick={() => (setEditando(false), setNome(tela.nome), setPublicos(tela.publicos))} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-bold">
              <Tv size={18} className="text-na-green dark:text-emerald-400" aria-hidden /> {tela.nome}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{tela.publicos.map((p) => PUBLICOS_TELA[p as PublicoTela] ?? p).join(" · ")}</p>
          </div>
          <button type="button" onClick={() => setEditando(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-na-green-dark hover:bg-na-green-light dark:text-emerald-400 dark:hover:bg-emerald-950/40">
            <Pencil size={14} aria-hidden /> Editar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-na-bg px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">{link}</code>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(link).then(() => (setCopiado(true), setTimeout(() => setCopiado(false), 2000)))}
          className="inline-flex items-center gap-1 rounded-lg bg-na-green px-3 py-1.5 text-sm font-semibold text-white"
        >
          {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copiado ? "Copiado" : "Copiar link"}
        </button>
        <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold dark:border-gray-600">
          <ExternalLink size={14} aria-hidden /> Ver tela
        </a>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <button
          type="button"
          disabled={pendente}
          onClick={() => confirm("Trocar o link? A TV com o link atual para de mostrar os eventos até receber o novo.") && rodar(() => trocarLinkTela(schoolId, tela.id))}
          className="inline-flex items-center gap-1 font-semibold text-gray-600 hover:text-na-green-dark disabled:opacity-50 dark:text-gray-300"
        >
          <RefreshCw size={13} aria-hidden /> Trocar link
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => confirm(`Excluir a tela "${tela.nome}"?`) && rodar(() => excluirTela(schoolId, tela.id))}
          className="inline-flex items-center gap-1 font-semibold text-na-danger-dark hover:underline disabled:opacity-50 dark:text-na-danger-light"
        >
          <Trash2 size={13} aria-hidden /> Excluir
        </button>
      </div>
      {erro && <p className="text-sm text-na-danger-dark dark:text-na-danger-light">{erro}</p>}
    </li>
  );
}

/** Telas de TV da filial (pedido do usuário 2026-10-24): um link por TV, com os públicos escolhidos. */
export function TelasTab({ schoolId, telas, origem }: { schoolId: string; telas: TelaResumo[]; origem: string }) {
  const [nome, setNome] = useState("");
  const [publicos, setPublicos] = useState<string[]>(["aberto_publico", "todos_ativos"]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Cada TV recebe um link próprio que mostra os eventos dos próximos 30 dias, trocando a cada 10 segundos. Abra o link no navegador da TV e deixe em tela cheia. A tela se atualiza sozinha.
      </p>

      <form
        className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700"
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            setErro(null);
            const r = await criarTela(schoolId, nome, publicos);
            if (!r.ok) setErro(r.error);
            else setNome("");
          });
        }}
      >
        <h2 className="font-bold">Nova tela</h2>
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="Nome da tela (ex.: TV da recepção)" className="w-full rounded-lg border border-gray-300 bg-transparent p-2 text-sm dark:border-gray-700" />
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Eventos que aparecem nesta TV</p>
          <SeletorPublicos valor={publicos} onChange={setPublicos} />
        </div>
        <button type="submit" disabled={pendente} className="rounded-lg bg-na-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pendente ? "Criando…" : "Criar tela"}
        </button>
        {erro && <p className="text-sm text-na-danger-dark dark:text-na-danger-light">{erro}</p>}
      </form>

      {telas.length > 0 ? (
        <ul className="space-y-3">
          {telas.map((t) => (
            <CartaoTela key={`${t.id}-${t.token}`} schoolId={schoolId} tela={t} origem={origem} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Nenhuma tela criada ainda.</p>
      )}
    </div>
  );
}
