"use client";

import { getCalendarioMes, sugerirDatas, verificarConflitos } from "@/lib/actions/calendario-actions";
import { PUBLICOS, ROTULO_CAMADA, type Publico } from "@/lib/calendario-comum";
import type { Camada, Conflito, ItemCalendario, Sugestao } from "@/lib/calendario-filial";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ZONA = "America/Sao_Paulo";
const diaBR = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });

// Uma cor por camada (identidade), sempre acompanhada do nome na legenda e na lista do dia.
// Paleta validada (claro e escuro) com o validador de cores dos gráficos.
const COR: Record<Camada, string> = {
  aula: "bg-[#009485] dark:bg-[#16a090]",
  reuniao_grupo: "bg-[#9a6b00] dark:bg-[#b8862a]",
  evento_filial: "bg-[#2a78d6] dark:bg-[#3987e5]",
  evento_externo: "bg-[#d55181] dark:bg-[#d55181]",
  feriado: "bg-gray-400 dark:bg-gray-500",
};

function Gravidade({ c }: { c: Conflito }) {
  const Icone = c.gravidade === "alta" ? AlertTriangle : c.gravidade === "media" ? Info : Info;
  return (
    <li className="flex items-start gap-1.5 text-[12px] text-gray-700 dark:text-gray-300">
      <Icone size={13} className={`mt-0.5 shrink-0 ${c.gravidade === "alta" ? "text-na-danger" : c.gravidade === "media" ? "text-na-warning" : "text-gray-400"}`} />
      <span>
        <strong>{c.item.titulo}</strong>
        {c.item.diaInteiro ? "" : ` (${hora(c.item.inicio)})`} — {c.motivo}
      </span>
    </li>
  );
}

function SeletorPublico({ valor, onChange }: { valor: Publico[]; onChange: (p: Publico[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PUBLICOS.map((p) => {
        const ativo = valor.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(ativo ? valor.filter((x) => x !== p.id) : [...valor, p.id])}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              ativo ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400" : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400"
            }`}
          >
            {p.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** Planejar um evento: conferir um horário ou pedir sugestões de datas. */
function Planejador({ schoolId }: { schoolId: string }) {
  const [publicos, setPublicos] = useState<Publico[]>(["membros"]);
  const [duracao, setDuracao] = useState(120);
  const [data, setData] = useState("");
  const [inicio, setInicio] = useState("19:30");
  const [dias, setDias] = useState<number[]>([5, 6, 0]);
  const [horarios, setHorarios] = useState("09:00, 15:00, 19:30");
  const [semanas, setSemanas] = useState(8);
  const [conflitos, setConflitos] = useState<Conflito[] | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const campo = "rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-800";

  function conferir() {
    if (!data || !inicio) return;
    const ini = new Date(`${data}T${inicio}:00-03:00`);
    const fim = new Date(ini.getTime() + duracao * 60000);
    setSugestoes(null);
    startTransition(async () => setConflitos(await verificarConflitos(schoolId, ini.toISOString(), fim.toISOString(), publicos)));
  }

  function sugerir() {
    setConflitos(null);
    startTransition(async () =>
      setSugestoes(await sugerirDatas(schoolId, { publicos, duracaoMin: duracao, semanas, dias, horarios: horarios.split(/[,\s]+/).filter(Boolean) })),
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Planejar um evento</h3>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">Escolha o público e veja os conflitos de um horário, ou peça as melhores datas.</p>
      </div>
      <SeletorPublico valor={publicos} onChange={setPublicos} />
      <label className="flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300">
        Duração
        <select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} className={campo}>
          {[60, 90, 120, 180, 240, 480].map((m) => (
            <option key={m} value={m}>
              {m < 60 ? `${m} min` : `${m / 60} h`}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
          <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">Conferir um horário</p>
          <div className="flex gap-2">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data" className={`${campo} flex-1`} />
            <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} aria-label="Início" className={campo} />
          </div>
          <button onClick={conferir} disabled={isPending || !data} className="rounded-lg bg-na-green px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-60">
            Ver conflitos
          </button>
        </div>
        <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
          <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">Sugerir datas</p>
          <div className="flex flex-wrap gap-1">
            {SEMANA.map((s, i) => (
              <button
                key={s}
                type="button"
                aria-pressed={dias.includes(i)}
                onClick={() => setDias((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}
                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${dias.includes(i) ? "border-na-green bg-na-green/10 text-na-green-dark dark:text-emerald-400" : "border-gray-300 text-gray-500 dark:border-gray-700 dark:text-gray-400"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={horarios} onChange={(e) => setHorarios(e.target.value)} aria-label="Horários de início" placeholder="09:00, 15:00, 19:30" className={`${campo} flex-1`} />
            <select value={semanas} onChange={(e) => setSemanas(Number(e.target.value))} aria-label="Semanas à frente" className={campo}>
              {[4, 8, 12, 16].map((s) => (
                <option key={s} value={s}>
                  {s} semanas
                </option>
              ))}
            </select>
          </div>
          <button onClick={sugerir} disabled={isPending || !dias.length} className="flex items-center justify-center gap-1.5 rounded-lg bg-na-green px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-60">
            <Sparkles size={13} /> Sugerir as melhores datas
          </button>
        </div>
      </div>

      {isPending && (
        <p className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Analisando o calendário…
        </p>
      )}
      {conflitos &&
        (conflitos.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-na-success-dark dark:text-emerald-300">
            <CheckCircle2 size={14} /> Nenhum conflito para esse público nesse horário.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">{conflitos.map((c) => <Gravidade key={c.item.id} c={c} />)}</ul>
        ))}
      {sugestoes && (
        <ol className="flex flex-col gap-2">
          {sugestoes.map((s, i) => (
            <li key={s.inicio} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                {i + 1}. {new Date(s.inicio).toLocaleDateString("pt-BR", { timeZone: ZONA, weekday: "long", day: "2-digit", month: "2-digit" })}, {hora(s.inicio)}–{hora(s.fim)}
              </p>
              {s.conflitos.length === 0 ? (
                <p className="text-[12px] text-na-success-dark dark:text-emerald-300">{s.motivo}</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-0.5">{s.conflitos.map((c) => <Gravidade key={c.item.id} c={c} />)}</ul>
              )}
            </li>
          ))}
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Escolhida a data, cadastre o evento em Gestão de Eventos — o formulário avisa de novo se algo mudou.</p>
        </ol>
      )}
    </section>
  );
}

/** Calendário inteligente do chefe: camadas + planejador (pedido do usuário 2026-10-19). */
export function CalendarioTab({ schoolId }: { schoolId: string }) {
  const hojeISO = useMemo(() => new Date().toLocaleDateString("en-CA", { timeZone: ZONA }), []);
  const [ano, setAno] = useState(Number(hojeISO.slice(0, 4)));
  const [mes, setMes] = useState(Number(hojeISO.slice(5, 7)));
  const [itens, setItens] = useState<ItemCalendario[] | null>(null);
  const [camadas, setCamadas] = useState<Set<Camada>>(new Set(Object.keys(ROTULO_CAMADA) as Camada[]));
  const [diaSel, setDiaSel] = useState(hojeISO);

  useEffect(() => {
    let vivo = true;
    getCalendarioMes(schoolId, ano, mes).then((r) => vivo && setItens(r));
    return () => {
      vivo = false;
    };
  }, [schoolId, ano, mes]);

  const porDia = useMemo(() => {
    const m = new Map<string, ItemCalendario[]>();
    for (const i of itens ?? []) if (camadas.has(i.camada)) m.set(diaBR(i.inicio), [...(m.get(diaBR(i.inicio)) ?? []), i]);
    return m;
  }, [itens, camadas]);

  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const celulas = [...Array(primeiro).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => `${ano}-${String(mes).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)];
  const mudar = (d: number) => {
    const n = new Date(Date.UTC(ano, mes - 1 + d, 1));
    setItens(null);
    setAno(n.getUTCFullYear());
    setMes(n.getUTCMonth() + 1);
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <button onClick={() => mudar(-1)} aria-label="Mês anterior" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {MESES[mes - 1]} {ano}
          </span>
          <button onClick={() => mudar(1)} aria-label="Próximo mês" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ROTULO_CAMADA) as Camada[]).map((c) => (
            <button
              key={c}
              aria-pressed={camadas.has(c)}
              onClick={() =>
                setCamadas((s) => {
                  const n = new Set(s);
                  if (n.has(c)) n.delete(c);
                  else n.add(c);
                  return n;
                })
              }
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                camadas.has(c) ? "border-gray-300 text-gray-800 dark:border-gray-600 dark:text-gray-200" : "border-dashed border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-500"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${camadas.has(c) ? COR[c] : "bg-transparent"}`} /> {ROTULO_CAMADA[c]}
            </button>
          ))}
        </div>

        {!itens ? (
          <p className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <Loader2 size={13} className="animate-spin" /> Montando o calendário…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              {SEMANA.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {celulas.map((dia, i) => {
                if (!dia) return <div key={`v-${i}`} />;
                const lista = porDia.get(dia) ?? [];
                const tipos = [...new Set(lista.map((x) => x.camada))];
                const sel = dia === diaSel;
                return (
                  <button
                    key={dia}
                    onClick={() => setDiaSel(dia)}
                    className={`flex min-h-14 flex-col items-center gap-1 rounded-lg p-1 text-[12px] transition ${
                      sel ? "bg-na-green/15 ring-1 ring-na-green" : dia === hojeISO ? "ring-1 ring-gray-300 dark:ring-gray-600" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{Number(dia.slice(8))}</span>
                    <span className="flex flex-wrap justify-center gap-0.5">
                      {tipos.map((t) => (
                        <span key={t} className={`h-1.5 w-1.5 rounded-full ${COR[t]}`} />
                      ))}
                    </span>
                    {lista.length > 0 && <span className="text-[9px] text-gray-500 dark:text-gray-400">{lista.length}</span>}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-2 text-[12px] font-semibold text-gray-800 dark:text-gray-200">
                {new Date(`${diaSel}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </p>
              {(porDia.get(diaSel) ?? []).length === 0 ? (
                <p className="text-[12px] text-gray-500 dark:text-gray-400">Nada neste dia.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {(porDia.get(diaSel) ?? []).map((x) => (
                    <li key={x.id} className="flex items-start gap-2 text-[12px] text-gray-700 dark:text-gray-300">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${COR[x.camada]}`} />
                      <span>
                        <strong>{x.diaInteiro ? "Dia todo" : `${hora(x.inicio)}${x.fim ? `–${hora(x.fim)}` : ""}`}</strong> · {x.titulo}
                        {x.detalhe ? <span className="text-gray-500 dark:text-gray-400"> · {x.detalhe}</span> : null}
                        <span className="text-gray-400 dark:text-gray-500"> · {ROTULO_CAMADA[x.camada]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Aulas: dia e horário de cada turma no Mercúrio (duração estimada de 2 h). Eventos nacionais e regionais ainda não dizem a quem se destinam; por isso contam como conflito para todos.
        </p>
      </section>

      <Planejador schoolId={schoolId} />
    </div>
  );
}
