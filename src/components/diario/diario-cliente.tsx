"use client";

import { arquivarPratica, criarPratica, marcarPratica, salvarEpilogo, salvarPrologo } from "@/lib/actions/diario-actions";
import { DIAS_DA_SEMANA, RECORRENCIAS, type Recorrencia } from "@/lib/diario";
import { VIRTUDES } from "@/lib/diario-conteudo";
import type { DiarioDaPessoa } from "@/lib/diario-dados";
import { Check, Dices, Flame, Loader2, Lock, Moon, Pencil, Plus, Sunrise, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const GRUPOS = [...new Set(VIRTUDES.map((v) => v.grupo))];
const CAMPO = "w-full rounded-xl border border-gray-300 bg-white p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
const BOTAO = "flex items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60";
const CARTAO = "flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900";

const rotuloData = (data: string, hoje: string) => {
  if (data === hoje) return "Hoje";
  const d = new Date(`${data}T12:00:00Z`);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
};

/** Diário filosófico no Portal (2026-10-29): Prólogo, práticas do dia, Epílogo e o Fogo Interno. Só a pessoa vê. */
export function DiarioCliente({ d }: { d: DiarioDaPessoa }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) => {
    setErro(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) return setErro(r.error ?? "Não foi possível salvar.");
      depois?.();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Dia do diário" className="flex gap-1.5 overflow-x-auto pb-1">
        {d.datas.map((x) => (
          <Link
            key={x.data}
            href={x.data === d.hoje ? "/diario" : `/diario?dia=${x.data}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold capitalize ${
              x.data === d.data ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"
            }`}
          >
            {rotuloData(x.data, d.hoje)}
            {x.epilogo ? <Check size={12} /> : x.prologo ? <Sunrise size={12} /> : null}
          </Link>
        ))}
      </nav>

      <FogoInterno fogo={d.fogo} />

      <Prologo key={`p-${d.data}`} d={d} pendente={pendente} rodar={rodar} />
      <Praticas key={`pr-${d.data}`} d={d} pendente={pendente} rodar={rodar} />
      <Epilogo key={`e-${d.data}`} d={d} pendente={pendente} rodar={rodar} />

      {erro && <p role="alert" className="rounded-xl bg-na-danger-light p-3 text-[12px] text-na-danger-dark dark:bg-red-950/30 dark:text-red-300">{erro}</p>}
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        <Lock size={11} /> Só você vê o seu diário. Nem a coordenação nem a escola têm acesso.
      </p>
    </div>
  );
}

type Rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) => void;

function FogoInterno({ fogo }: { fogo: DiarioDaPessoa["fogo"] }) {
  return (
    <section className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-sm">
      <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/20">
        <Flame size={20} />
        <span className="text-lg leading-none font-black">{fogo.atual}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold tracking-wide uppercase opacity-85">Fogo Interno</span>
        <span className="block text-[16px] leading-tight font-black">{fogo.grau.titulo}</span>
        <span className="block text-[12px] opacity-90">{fogo.grau.descricao}</span>
        <span className="mt-1 block text-[11px] opacity-85">
          {fogo.proximo ? `Faltam ${fogo.faltam} ${fogo.faltam === 1 ? "dia" : "dias"} para ${fogo.proximo.titulo}` : "Grau máximo"} · Recorde {fogo.recorde} · {fogo.total} {fogo.total === 1 ? "dia registrado" : "dias registrados"}
        </span>
      </span>
    </section>
  );
}

function Prologo({ d, pendente, rodar }: { d: DiarioDaPessoa; pendente: boolean; rodar: Rodar }) {
  const feito = !!d.dia?.prologoFeito;
  const [editando, setEditando] = useState(!feito);
  const conhecida = VIRTUDES.some((v) => v.nome === d.dia?.virtude);
  const [virtude, setVirtude] = useState(d.dia?.virtude ?? "");
  const [propria, setPropria] = useState(!!d.dia?.virtude && !conhecida);
  const [compromisso, setCompromisso] = useState(d.dia?.compromisso ?? "");
  const escolhida = VIRTUDES.find((v) => v.nome === virtude);

  return (
    <section className={CARTAO}>
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-gray-100">
        <Sunrise size={17} className="text-amber-500" /> Prólogo
        {feito && !editando && (
          <button onClick={() => setEditando(true)} className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">
            <Pencil size={12} /> Editar
          </button>
        )}
      </h2>
      {!editando ? (
        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-gray-700 dark:text-gray-300">
            Virtude do dia: <strong className="text-gray-900 dark:text-gray-100">{d.dia?.virtude}</strong>
          </p>
          {d.dia?.compromisso && <p className="text-[13px] whitespace-pre-line text-gray-600 dark:text-gray-400">{d.dia.compromisso}</p>}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">Virtude do dia</label>
            {propria ? (
              <input value={virtude} onChange={(e) => setVirtude(e.target.value)} placeholder="Digite sua virtude..." maxLength={120} className={CAMPO} />
            ) : (
              <select value={virtude} onChange={(e) => setVirtude(e.target.value)} className={CAMPO}>
                <option value="">Selecione uma virtude...</option>
                {GRUPOS.map((g) => (
                  <optgroup key={g} label={g}>
                    {VIRTUDES.filter((v) => v.grupo === g).map((v) => (
                      <option key={v.nome} value={v.nome}>
                        {v.nome} — {v.resumo}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            <div className="flex flex-wrap gap-2">
              {!propria && (
                <button type="button" onClick={() => setVirtude(VIRTUDES[Math.floor(Math.random() * VIRTUDES.length)].nome)} className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12px] font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
                  <Dices size={13} /> Sortear virtude
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPropria(!propria);
                  setVirtude("");
                }}
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12px] font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300"
              >
                {propria ? "Escolher da lista" : "Escrever a minha"}
              </button>
            </div>
          </div>
          {escolhida && (
            <div className="rounded-xl bg-gray-50 p-3 text-[12px] text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
              <p>{escolhida.descricao}</p>
              <ul className="mt-2 list-disc pl-4">
                {escolhida.praticas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="mt-2 italic">
                “{escolhida.frase}” — {escolhida.autor}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">Meu compromisso para hoje</label>
            <textarea value={compromisso} onChange={(e) => setCompromisso(e.target.value)} rows={3} placeholder="Como vou praticar esta virtude hoje?" className={CAMPO} />
          </div>
          <button disabled={pendente || !virtude.trim()} onClick={() => rodar(() => salvarPrologo(d.data, { virtude, compromisso }), () => setEditando(false))} className={BOTAO}>
            {pendente && <Loader2 size={14} className="animate-spin" />} Salvar Prólogo
          </button>
        </>
      )}
    </section>
  );
}

function Praticas({ d, pendente, rodar }: { d: DiarioDaPessoa; pendente: boolean; rodar: Rodar }) {
  const [gerir, setGerir] = useState(false);
  const [nome, setNome] = useState("");
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("diaria");
  const [dias, setDias] = useState<number[]>([]);
  const [diaMes, setDiaMes] = useState<number>(Number(d.hoje.slice(8)));
  const doDia = d.praticas.filter((p) => p.doDia);

  return (
    <section className={CARTAO}>
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-gray-100">
        <Check size={17} className="text-na-green" /> Práticas do dia
        <button onClick={() => setGerir(!gerir)} className="ml-auto text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">
          {gerir ? "Fechar" : "Minhas práticas"}
        </button>
      </h2>
      {doDia.length ? (
        <ul className="flex flex-col gap-1.5">
          {doDia.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700">
                <input type="checkbox" checked={p.feita} disabled={pendente} onChange={() => rodar(() => marcarPratica(d.data, p.id, !p.feita))} className="size-5 accent-na-green" />
                <span className={`text-[13px] ${p.feita ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100"}`}>{p.nome}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">{d.praticas.length ? "Nenhuma prática para este dia." : "Você ainda não tem práticas. Toque em “Minhas práticas” para criar."}</p>
      )}
      {gerir && (
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          {d.praticas.length > 0 && (
            <ul className="flex flex-col gap-1">
              {d.praticas.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300">
                  <span className="min-w-0 flex-1 truncate">
                    {p.nome} <span className="text-gray-400">· {p.recorrencia === "semanal" ? p.diasSemana.map((x) => DIAS_DA_SEMANA[x]).join(", ") : p.recorrencia === "mensal" ? `todo dia ${p.diaMes}` : RECORRENCIAS[p.recorrencia as Recorrencia]}</span>
                  </span>
                  <button aria-label={`Remover ${p.nome}`} disabled={pendente} onClick={() => rodar(() => arquivarPratica(p.id))} className="text-na-danger-dark dark:text-red-300">
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da prática..." maxLength={120} className={CAMPO} />
          <select value={recorrencia} onChange={(e) => setRecorrencia(e.target.value as Recorrencia)} className={CAMPO}>
            {(Object.keys(RECORRENCIAS) as Recorrencia[]).map((r) => (
              <option key={r} value={r}>
                {RECORRENCIAS[r]}
              </option>
            ))}
          </select>
          {recorrencia === "semanal" && (
            <div className="flex flex-wrap gap-1.5">
              {DIAS_DA_SEMANA.map((rotulo, i) => (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => setDias((a) => (a.includes(i) ? a.filter((x) => x !== i) : [...a, i]))}
                  className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${dias.includes(i) ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"}`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          )}
          {recorrencia === "mensal" && (
            <label className="flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300">
              Todo dia <input type="number" min={1} max={31} value={diaMes} onChange={(e) => setDiaMes(Number(e.target.value))} className={`${CAMPO} w-20`} /> do mês
            </label>
          )}
          <button
            disabled={pendente || !nome.trim()}
            onClick={() =>
              rodar(() => criarPratica({ nome, recorrencia, diasSemana: dias, diaMes }), () => {
                setNome("");
                setDias([]);
              })
            }
            className={BOTAO}
          >
            <Plus size={14} /> Adicionar prática
          </button>
        </div>
      )}
    </section>
  );
}

function Epilogo({ d, pendente, rodar }: { d: DiarioDaPessoa; pendente: boolean; rodar: Rodar }) {
  const feito = !!d.dia?.epilogoFeito;
  const [editando, setEditando] = useState(!feito);
  const [semPrologo, setSemPrologo] = useState(!!d.dia?.semPrologo);
  const [falhei, setFalhei] = useState(d.dia?.falhei ?? "");
  const [fizBem, setFizBem] = useState(d.dia?.fizBem ?? "");
  const [deixei, setDeixei] = useState(d.dia?.deixeiDeFazer ?? "");
  const [livre, setLivre] = useState(d.dia?.reflexaoLivre ?? "");
  const perguntas = [
    { rotulo: "1. Em que falhei hoje?", dica: "Onde não agi conforme meus princípios?", valor: falhei, mudar: setFalhei },
    { rotulo: "2. O que fiz bem?", dica: "Quais virtudes pratiquei?", valor: fizBem, mudar: setFizBem },
    { rotulo: "3. O que deixei de fazer?", dica: "O que poderia ter feito melhor?", valor: deixei, mudar: setDeixei },
  ];

  return (
    <section className={CARTAO}>
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-gray-900 dark:text-gray-100">
        <Moon size={17} className="text-indigo-500 dark:text-indigo-300" /> Epílogo
        {feito && !editando && (
          <button onClick={() => setEditando(true)} className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">
            <Pencil size={12} /> Editar
          </button>
        )}
      </h2>
      {!editando ? (
        <div className="flex flex-col gap-2 text-[13px] text-gray-700 dark:text-gray-300">
          {perguntas.map((p) => p.valor && (
            <p key={p.rotulo}>
              <strong className="block text-[12px] text-gray-500 dark:text-gray-400">{p.rotulo}</strong>
              <span className="whitespace-pre-line">{p.valor}</span>
            </p>
          ))}
          {livre && <p className="whitespace-pre-line">{livre}</p>}
        </div>
      ) : (
        <>
          {!d.dia?.prologoFeito && (
            <label className="flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={semPrologo} onChange={(e) => setSemPrologo(e.target.checked)} className="size-4 accent-na-green" /> Não fiz o Prólogo hoje
            </label>
          )}
          {perguntas.map((p) => (
            <div key={p.rotulo} className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">{p.rotulo}</label>
              <textarea value={p.valor} onChange={(e) => p.mudar(e.target.value)} rows={2} placeholder={p.dica} className={CAMPO} />
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">Reflexão livre (opcional)</label>
            <textarea value={livre} onChange={(e) => setLivre(e.target.value)} rows={3} placeholder="Se preferir, escreva livremente sobre o seu dia aqui..." className={CAMPO} />
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Responda às três perguntas ou escreva a reflexão livre.</p>
          <button disabled={pendente} onClick={() => rodar(() => salvarEpilogo(d.data, { semPrologo, falhei, fizBem, deixeiDeFazer: deixei, reflexaoLivre: livre }), () => setEditando(false))} className={BOTAO}>
            {pendente && <Loader2 size={14} className="animate-spin" />} Salvar Epílogo
          </button>
        </>
      )}
    </section>
  );
}
