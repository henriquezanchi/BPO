"use client";

import { sugerirDatas } from "@/lib/actions/calendario-actions";
import { publicosDeAudiencia } from "@/lib/calendario-comum";
import type { Sugestao } from "@/lib/calendario-filial";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const FORMATOS = {
  livre: { label: "Outro / livre", dias: [0, 1, 2, 3, 4, 5, 6], horarios: ["09:00", "15:00", "19:30"] },
  palestra: { label: "Palestra", dias: [1, 2, 3, 4, 5, 6], horarios: ["19:30", "15:00"] },
  oficina: { label: "Oficina", dias: [0, 6], horarios: ["09:00", "15:00"] },
  convivencia: { label: "Confraternização", dias: [0, 5, 6], horarios: ["12:00", "19:30"] },
};
const campo = "min-w-0 rounded-lg border border-gray-300 bg-transparent p-2 text-xs dark:border-gray-700";
const dataLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** Reads the actual event form: the audience and dates have one source of truth. */
export function EventDateSuggestions({ schoolId }: { schoolId: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const request = useRef(0);
  const [aberto, setAberto] = useState(false);
  const [publicoKey, setPublicoKey] = useState("");
  const [formato, setFormato] = useState<keyof typeof FORMATOS>("livre");
  const [duracao, setDuracao] = useState(120);
  const [semanas, setSemanas] = useState(8);
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  function invalidar() {
    request.current++;
    setSugestoes(null);
    setCarregando(false);
    setMensagem("");
  }

  useEffect(() => {
    const form = ref.current?.closest("form");
    const alterar = (event: Event) => {
      const input = event.target as HTMLInputElement;
      if (!["startsAt", "endsAt", "publicos"].includes(input.name)) return;
      request.current++;
      setSugestoes(null);
      setCarregando(false);
      setMensagem("");
      const data = new FormData(form!);
      if (input.name === "publicos") setPublicoKey(data.getAll("publicos").map(String).sort().join(","));
      const inicio = new Date(String(data.get("startsAt"))).getTime();
      const fim = new Date(String(data.get("endsAt"))).getTime();
      const minutos = (fim - inicio) / 60000;
      if (minutos >= 30 && minutos <= 720) setDuracao(minutos);
    };
    form?.addEventListener("input", alterar);
    form?.addEventListener("change", alterar);
    return () => {
      // Invalidate outstanding promises when this helper unmounts.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      request.current++;
      form?.removeEventListener("input", alterar);
      form?.removeEventListener("change", alterar);
    };
  }, []);

  const buscar = useCallback(async () => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const publicos = new FormData(form).getAll("publicos").map(String);
    if (!publicos.length) { setMensagem("Escolha o público do evento acima para buscar datas."); return; }
    if (!Number.isFinite(duracao) || duracao < 30 || duracao > 720) { setMensagem("Informe uma duração entre 30 e 720 minutos."); return; }
    const id = ++request.current;
    setCarregando(true);
    setMensagem("");
    setSugestoes(null);
    try {
      const result = await sugerirDatas(schoolId, { publicos: publicosDeAudiencia(publicos), duracaoMin: duracao, semanas, ...FORMATOS[formato] });
      if (request.current === id) setSugestoes(result);
    } catch {
      if (request.current === id) setMensagem("Não foi possível buscar datas. Tente novamente.");
    } finally {
      if (request.current === id) setCarregando(false);
    }
  }, [duracao, semanas, formato, schoolId]);

  useEffect(() => {
    if (!aberto) return;
    const timer = setTimeout(() => { void buscar(); }, 500);
    return () => clearTimeout(timer);
  }, [aberto, buscar, publicoKey]);

  function aplicar(sugestao: Sugestao) {
    const form = ref.current?.closest("form");
    if (!form) return;
    for (const [name, iso] of [["startsAt", sugestao.inicio], ["endsAt", sugestao.fim]]) {
      const input = form.elements.namedItem(name) as HTMLInputElement | null;
      if (input) {
        input.value = dataLocal(iso);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    setMensagem("Data preenchida. Confira os detalhes antes de publicar.");
  }

  return <details ref={ref} className="rounded-xl border border-gray-200 dark:border-gray-700" onToggle={event => {
    setAberto(event.currentTarget.open);
    if (!event.currentTarget.open) { invalidar(); return; }
    const form = event.currentTarget.closest("form");
    if (!form) return;
    const data = new FormData(form);
    const minutos = (new Date(String(data.get("endsAt"))).getTime() - new Date(String(data.get("startsAt"))).getTime()) / 60000;
    if (minutos >= 30 && minutos <= 720) setDuracao(minutos);
  }}>
    <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-na-green-dark focus-visible:outline-2 focus-visible:outline-na-green dark:text-emerald-400"><Sparkles size={12} className="mr-1.5 inline" />Encontrar uma data</summary>
    <div className="space-y-3 border-t border-gray-100 p-3 dark:border-gray-800">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">Sugestões para o público escolhido, considerando o calendário da filial.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">Formato para planejar<select value={formato} onChange={e => { setFormato(e.target.value as keyof typeof FORMATOS); invalidar(); }} className={campo}>{Object.entries(FORMATOS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs">Duração (min)<input type="text" inputMode="numeric" value={duracao || ""} onChange={e => { setDuracao(Number(e.target.value)); invalidar(); }} className={campo} /></label>
        <label className="flex flex-col gap-1 text-xs">Buscar nas próximas<select value={semanas} onChange={e => { setSemanas(Number(e.target.value)); invalidar(); }} className={campo}>{[4, 8, 12, 16].map(n => <option key={n} value={n}>{n} semanas</option>)}</select></label>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">O formato orienta os dias e horários da busca; não é salvo no evento. A busca considera horários de Brasília e converte a data escolhida para o fuso do seu dispositivo.</p>
      <button type="button" disabled={carregando} onClick={buscar} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-na-green-dark hover:bg-na-green/10 disabled:opacity-50 dark:text-emerald-400">{carregando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}{carregando ? "Consultando calendário…" : "Sugerir datas"}</button>
      <div aria-live="polite">
        {mensagem && <p className="text-xs text-gray-600 dark:text-gray-300">{mensagem}</p>}
        {sugestoes?.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">Nenhuma data encontrada. Experimente outro formato ou período.</p>}
        {!!sugestoes?.length && <ul className="divide-y divide-gray-100 dark:divide-gray-800">{sugestoes.map(s => <li key={s.inicio} className="flex flex-wrap items-start justify-between gap-2 py-3">
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{new Date(s.inicio).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}–{new Date(s.fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p><p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{s.conflitos.length ? `${s.conflitos.length} possível(is) conflito(s): ${s.conflitos.map(c => c.motivo).join("; ")}` : "Sem conflitos no calendário consultado."}</p></div>
          <button type="button" onClick={() => aplicar(s)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-na-green-dark dark:border-gray-700 dark:text-emerald-400">Usar data</button>
        </li>)}</ul>}
      </div>
    </div>
  </details>;
}
