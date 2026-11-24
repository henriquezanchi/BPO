"use client";

import { SeletorPessoas, type PessoaOpcao } from "@/components/grupos/seletor-pessoas";
import { buscarArtistas, listarRepertorio, removerRepertorio, salvarRepertorio, type ItemRepertorio } from "@/lib/actions/repertorio-actions";
import { REQUISITOS_REPERTORIO, TIPOS_REPERTORIO, rotuloRequisito, rotuloTipo } from "@/lib/repertorio";
import { Loader2, Music, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

/**
 * Repertório da Secretaria de Artes (pedido do usuário 24/11/2026): quem apresentou o quê, o que a apresentação
 * precisa tecnicamente (microfone, pedestal, som, luzes…) e um formato simplificado. Agrupado por artista; a direção
 * vê as sugestões no cadastro de eventos.
 */
const CAMPO = "min-h-10 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-[13px] text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100";
const ROTULO = "flex flex-col gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-300";
const dataBR = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : null);

type Form = { id?: string; artista: PessoaOpcao | null; artistaNome: string; titulo: string; tipo: string; duracaoMin: string; observacoes: string; requisitos: Set<string>; requisitosOutros: string; formatoSimplificado: string; apresentadoEm: string; evento: string };
const vazio = (): Form => ({ artista: null, artistaNome: "", titulo: "", tipo: "musica", duracaoMin: "", observacoes: "", requisitos: new Set(), requisitosOutros: "", formatoSimplificado: "", apresentadoEm: "", evento: "" });

export function RepertorioArtes({ grupoId, podeEditar }: { grupoId: string; podeEditar: boolean }) {
  const [itens, setItens] = useState<ItemRepertorio[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const carregar = () => listarRepertorio(grupoId).then((r) => setItens(r.ok ? r.itens : []));
  useEffect(() => {
    listarRepertorio(grupoId).then((r) => setItens(r.ok ? r.itens : []));
  }, [grupoId]);

  const porArtista = new Map<string, ItemRepertorio[]>();
  for (const i of itens ?? []) porArtista.set(i.artistaNome, [...(porArtista.get(i.artistaNome) ?? []), i]);

  const editar = (i: ItemRepertorio) =>
    setForm({ id: i.id, artista: i.artistaId ? { id: i.artistaId, name: i.artistaNome } : null, artistaNome: i.artistaNome, titulo: i.titulo, tipo: i.tipo, duracaoMin: i.duracaoMin ? String(i.duracaoMin) : "", observacoes: i.observacoes ?? "", requisitos: new Set(i.requisitos), requisitosOutros: i.requisitosOutros ?? "", formatoSimplificado: i.formatoSimplificado ?? "", apresentadoEm: i.apresentadoEm ?? "", evento: i.evento ?? "" });
  const salvar = () => {
    if (!form) return;
    setMsg(null);
    iniciar(async () => {
      const r = await salvarRepertorio(grupoId, {
        id: form.id,
        artistaId: form.artista?.id ?? null,
        artistaNome: form.artista ? form.artista.name.replace(/\s*\(.*\)$/, "") : form.artistaNome,
        titulo: form.titulo,
        tipo: form.tipo,
        duracaoMin: form.duracaoMin ? Number(form.duracaoMin) : null,
        observacoes: form.observacoes,
        requisitos: [...form.requisitos],
        requisitosOutros: form.requisitosOutros,
        formatoSimplificado: form.formatoSimplificado,
        apresentadoEm: form.apresentadoEm || undefined,
        evento: form.evento,
      });
      if (!r.ok) return setMsg(r.error);
      setForm(null);
      await carregar();
    });
  };
  const remover = (id: string) => iniciar(async () => { const r = await removerRepertorio(grupoId, id); if (!r.ok) setMsg(r.error); else await carregar(); });

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300"><Music size={14} /> Repertório</h2>
        {podeEditar && !form && (
          <button onClick={() => setForm(vazio())} className="flex items-center gap-1 rounded-lg bg-na-green px-3 py-1.5 text-[12px] font-semibold text-white"><Plus size={13} /> Registrar apresentação</button>
        )}
      </div>
      <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">Quem apresenta o quê, o que precisa no local e se há um formato mais simples. A direção vê isto como sugestão ao programar eventos.</p>

      {form && (
        <div className="mt-3 grid gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-950/40">
          <SeletorPessoas rotulo="Artista (voluntário da filial)" ajuda="Procure pelo nome. Se não for da filial, deixe vazio e escreva o nome abaixo." buscar={(t) => buscarArtistas(grupoId, t)} selecionados={form.artista ? [form.artista] : []} onChange={(p) => setForm({ ...form, artista: p[p.length - 1] ?? null })} />
          {!form.artista && (
            <label className={ROTULO}>Nome do artista (se não estiver na lista)<input value={form.artistaNome} onChange={(e) => setForm({ ...form, artistaNome: e.target.value })} className={CAMPO} maxLength={120} /></label>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <label className={ROTULO}>Apresentação<input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Canção “Trem-bala”, violão e voz" className={CAMPO} maxLength={160} /></label>
            <label className={ROTULO}>Tipo<select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={CAMPO}>{TIPOS_REPERTORIO.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={ROTULO}>Duração (min)<input type="number" min={1} max={600} value={form.duracaoMin} onChange={(e) => setForm({ ...form, duracaoMin: e.target.value })} className={CAMPO} /></label>
            <label className={ROTULO}>Última apresentação<input type="date" value={form.apresentadoEm} onChange={(e) => setForm({ ...form, apresentadoEm: e.target.value })} className={CAMPO} /></label>
            <label className={ROTULO}>Em qual evento<input value={form.evento} onChange={(e) => setForm({ ...form, evento: e.target.value })} placeholder="Ex.: Sarau de outubro" className={CAMPO} maxLength={160} /></label>
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">O que precisa no local</legend>
            <div className="flex flex-wrap gap-1.5">
              {REQUISITOS_REPERTORIO.map(([k, r]) => {
                const on = form.requisitos.has(k);
                return (
                  <label key={k} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${on ? "border-na-green bg-na-success-light text-na-success-dark dark:bg-emerald-950/30 dark:text-emerald-300" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}>
                    <input type="checkbox" checked={on} onChange={() => setForm({ ...form, requisitos: (() => { const n = new Set(form.requisitos); if (n.has(k)) n.delete(k); else n.add(k); return n; })() })} className="accent-na-green" /> {r}
                  </label>
                );
              })}
            </div>
            <input value={form.requisitosOutros} onChange={(e) => setForm({ ...form, requisitosOutros: e.target.value })} placeholder="Outros (ex.: 2 cadeiras, tomada perto do palco)" className={CAMPO} maxLength={300} />
          </fieldset>
          <label className={ROTULO}>Formato simplificado (se houver)<input value={form.formatoSimplificado} onChange={(e) => setForm({ ...form, formatoSimplificado: e.target.value })} placeholder="Ex.: só voz e violão, sem som, 5 min" className={CAMPO} maxLength={500} /></label>
          <label className={ROTULO}>Observações<textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className={`${CAMPO} py-2`} maxLength={1000} /></label>
          <div className="flex gap-2">
            <button disabled={pendente} onClick={salvar} className="flex items-center gap-1.5 rounded-lg bg-na-green px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">{pendente && <Loader2 size={13} className="animate-spin" />} Salvar</button>
            <button onClick={() => setForm(null)} className="px-2 text-[13px] font-semibold text-gray-500">Cancelar</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-[12px] font-semibold text-na-danger-dark dark:text-red-300">{msg}</p>}

      {itens === null ? (
        <p className="mt-3 text-[12px] text-gray-500">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">Nenhuma apresentação registrada ainda.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {[...porArtista.entries()].map(([artista, lista]) => (
            <div key={artista} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
              <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{artista}</p>
              <ul className="mt-1 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {lista.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-[13px]">
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-800 dark:text-gray-200"><b>{i.titulo}</b> <span className="text-gray-500">· {rotuloTipo(i.tipo)}{i.duracaoMin ? ` · ${i.duracaoMin} min` : ""}{i.apresentadoEm ? ` · ${dataBR(i.apresentadoEm)}` : ""}{i.evento ? ` · ${i.evento}` : ""}</span></p>
                      {(i.requisitos.length > 0 || i.requisitosOutros) && <p className="text-[12px] text-gray-600 dark:text-gray-300">Precisa: {[...i.requisitos.map(rotuloRequisito), i.requisitosOutros].filter(Boolean).join(", ")}</p>}
                      {i.formatoSimplificado && <p className="text-[12px] text-na-green-dark dark:text-emerald-400">Formato simples: {i.formatoSimplificado}</p>}
                      {i.observacoes && <p className="text-[12px] text-gray-500 dark:text-gray-400">{i.observacoes}</p>}
                    </div>
                    {podeEditar && (
                      <span className="flex items-center gap-3 text-[12px] font-semibold">
                        <button onClick={() => editar(i)} className="flex min-h-9 items-center gap-1 text-gray-600 hover:underline dark:text-gray-300"><Pencil size={12} /> Editar</button>
                        <button disabled={pendente} onClick={() => remover(i.id)} className="flex min-h-9 items-center gap-1 text-gray-500 hover:text-na-danger-dark"><Trash2 size={12} /> Remover</button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
