"use client";

import { atualizarFrase, criarFrase, excluirFrase, importarFrasesPadrao, type DadosFrase } from "@/lib/actions/telas-actions";
import { Download, Pencil, Plus, Quote, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

export type FraseResumo = { id: string; texto: string; autor: string; obra: string | null; ativa: boolean };

type Resultado = { ok: true } | { ok: false; error: string };

const CAMPO = "w-full rounded-lg border border-gray-300 bg-transparent p-2 text-sm dark:border-gray-700";
const BOTAO = "rounded-lg bg-na-green px-3 py-2 text-sm font-semibold text-white disabled:opacity-50";
const VAZIA: DadosFrase = { texto: "", autor: "", obra: "", ativa: true };

function useAcao() {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (acao: () => Promise<Resultado>, depois?: () => void) =>
    iniciar(async () => {
      setErro(null);
      const r = await acao();
      if (!r.ok) setErro(r.error);
      else depois?.();
    });
  return { erro, pendente, rodar };
}

function CamposFrase({ dados, onChange }: { dados: DadosFrase; onChange: (d: DadosFrase) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 sm:col-span-2">
        <span className="text-xs text-gray-500">Frase (até 220 letras)</span>
        <textarea value={dados.texto} onChange={(e) => onChange({ ...dados, texto: e.target.value })} maxLength={220} rows={2} className={CAMPO} />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-gray-500">Autor</span>
        <input value={dados.autor} onChange={(e) => onChange({ ...dados, autor: e.target.value })} maxLength={60} placeholder="Ex.: Jorge Ángel Livraga" className={CAMPO} />
      </label>
      <label className="space-y-1">
        <span className="text-xs text-gray-500">Obra ou fonte (opcional)</span>
        <input value={dados.obra} onChange={(e) => onChange({ ...dados, obra: e.target.value })} maxLength={90} placeholder="Ex.: A Voz do Silêncio" className={CAMPO} />
      </label>
    </div>
  );
}

function ItemFrase({ schoolId, f }: { schoolId: string; f: FraseResumo }) {
  const inicial: DadosFrase = { texto: f.texto, autor: f.autor, obra: f.obra ?? "", ativa: f.ativa };
  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState(inicial);
  const { erro, pendente, rodar } = useAcao();
  return (
    <li className={`space-y-3 rounded-xl border p-3 border-gray-200 dark:border-gray-700 ${f.ativa ? "" : "opacity-60"}`}>
      {editando ? (
        <>
          <CamposFrase dados={dados} onChange={setDados} />
          <div className="flex gap-2">
            <button type="button" disabled={pendente} onClick={() => rodar(() => atualizarFrase(schoolId, f.id, dados), () => setEditando(false))} className={BOTAO}>
              Salvar
            </button>
            <button type="button" onClick={() => (setEditando(false), setDados(inicial))} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm">“{f.texto}”</p>
            <p className="text-xs text-gray-500">
              {f.autor}
              {f.obra && ` · ${f.obra}`}
              {!f.ativa && " · desligada"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <label className="mr-1 inline-flex cursor-pointer items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={f.ativa} disabled={pendente} onChange={(e) => rodar(() => atualizarFrase(schoolId, f.id, { ...inicial, ativa: e.target.checked }))} className="accent-na-green" />
              Na TV
            </label>
            <button type="button" onClick={() => setEditando(true)} aria-label="Editar frase" className="rounded-lg p-1.5 text-na-green-dark hover:bg-na-green-light dark:text-emerald-400 dark:hover:bg-emerald-950/40">
              <Pencil size={15} aria-hidden />
            </button>
            <button type="button" disabled={pendente} onClick={() => confirm("Apagar esta frase?") && rodar(() => excluirFrase(schoolId, f.id))} aria-label="Apagar frase" className="rounded-lg p-1.5 text-na-danger-dark hover:bg-red-50 disabled:opacity-50 dark:text-na-danger-light dark:hover:bg-red-950/40">
              <Trash2 size={15} aria-hidden />
            </button>
          </div>
        </div>
      )}
      {erro && <p className="text-sm text-na-danger-dark dark:text-na-danger-light">{erro}</p>}
    </li>
  );
}

/**
 * Frases das TVs da filial (pedido do usuário 2026-10-25): a filial cadastra, edita, desliga e
 * apaga. Sem nenhuma ativa, as TVs usam a lista padrão (que pode ser importada e editada aqui).
 */
export function FrasesTela({ schoolId, frases, padrao }: { schoolId: string; frases: FraseResumo[]; padrao: { total: number } }) {
  const [abrindo, setAbrindo] = useState(false);
  const [nova, setNova] = useState(VAZIA);
  const { erro, pendente, rodar } = useAcao();
  const ativas = frases.filter((f) => f.ativa).length;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 font-bold">
          <Quote size={17} className="text-na-green dark:text-emerald-400" aria-hidden /> Frases
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          A cada volta da TV entra a próxima frase da lista, começando de um ponto sorteado.{" "}
          {ativas ? `A filial tem ${ativas} frase${ativas > 1 ? "s" : ""} ligada${ativas > 1 ? "s" : ""}.` : `Sem frases da filial ligadas, as TVs usam a lista padrão (${padrao.total} frases com fonte conferida).`}
        </p>
      </div>

      {frases.length > 0 && (
        <ul className="space-y-2">
          {frases.map((f) => (
            <ItemFrase key={f.id} schoolId={schoolId} f={f} />
          ))}
        </ul>
      )}

      {abrindo ? (
        <form
          className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
          onSubmit={(e) => {
            e.preventDefault();
            rodar(() => criarFrase(schoolId, nova), () => (setNova(VAZIA), setAbrindo(false)));
          }}
        >
          <CamposFrase dados={nova} onChange={setNova} />
          <div className="flex gap-2">
            <button type="submit" disabled={pendente} className={BOTAO}>
              {pendente ? "Salvando…" : "Salvar frase"}
            </button>
            <button type="button" onClick={() => setAbrindo(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAbrindo(true)} className="inline-flex items-center gap-1 rounded-lg border border-na-green px-3 py-2 text-sm font-semibold text-na-green-dark dark:text-emerald-400">
            <Plus size={15} aria-hidden /> Nova frase
          </button>
          <button
            type="button"
            disabled={pendente}
            onClick={() => rodar(() => importarFrasesPadrao(schoolId))}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:text-na-green-dark disabled:opacity-50 dark:text-gray-300"
          >
            <Download size={15} aria-hidden /> {frases.length ? "Trazer as frases padrão que faltam" : "Começar com a lista padrão"}
          </button>
        </div>
      )}
      {erro && <p className="text-sm text-na-danger-dark dark:text-na-danger-light">{erro}</p>}
    </section>
  );
}
