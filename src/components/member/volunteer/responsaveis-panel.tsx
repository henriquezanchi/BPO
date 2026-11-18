"use client";

import { adicionarResponsavelExterno, adicionarResponsavelMembro, decidir, procurarAdultos, sugerirResponsaveis } from "@/lib/actions/responsaveis-actions";
import { NOME_NIVEL } from "@/lib/criancas-comum";
import type { CriancaView } from "@/lib/responsaveis";
import { Check, Search, UserPlus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

/** Responsáveis das crianças do Merlin e do Janos (lib/responsaveis.ts): sugestões, confirmação e cadastro à mão. */
type Filtro = "todas" | "sem" | "sugestoes";
const campo = "min-h-9 min-w-0 rounded-lg border border-gray-300 bg-white px-2.5 text-sm dark:border-gray-700 dark:bg-gray-900";
const botao = "min-h-9 rounded-lg border border-gray-300 px-3 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800";

export function ResponsaveisPanel({ criancas }: { criancas: CriancaView[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const semConfirmado = criancas.filter((c) => !c.vinculos.some((v) => v.status === "confirmado")).length;
  const comSugestao = criancas.filter((c) => c.vinculos.some((v) => v.status === "sugerido")).length;
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return criancas.filter((c) => {
      if (filtro === "sem" && c.vinculos.some((v) => v.status === "confirmado")) return false;
      if (filtro === "sugestoes" && !c.vinculos.some((v) => v.status === "sugerido")) return false;
      return !q || c.nome.toLowerCase().includes(q) || (c.matricula ?? "").includes(q) || c.vinculos.some((v) => v.responsavel.nome.toLowerCase().includes(q));
    });
  }, [criancas, filtro, busca]);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Crianças e adolescentes não têm login próprio: agenda, contribuição e eventos passam para o responsável. O Mercúrio não guarda quem é o responsável,
        então o Portal sugere pelo e-mail ou celular iguais aos de um adulto da filial, e vocês confirmam.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await sugerirResponsaveis();
              setMsg(r.ok ? (r.novas ? `${r.novas} sugestão(ões) nova(s) para conferir.` : "Nenhuma sugestão nova.") : r.error);
            })
          }
          className={`${botao} bg-na-green text-white hover:bg-na-green-dark`}
        >
          Buscar sugestões automáticas
        </button>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar criança ou responsável" aria-label="Buscar" className={`${campo} flex-1 basis-48`} />
        {(
          [
            ["todas", `Todas (${criancas.length})`],
            ["sem", `Sem responsável confirmado (${semConfirmado})`],
            ["sugestoes", `Com sugestão (${comSugestao})`],
          ] as const
        ).map(([f, r]) => (
          <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)} className={`min-h-9 rounded-full border px-3 text-[13px] font-semibold ${filtro === f ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900" : "border-gray-300 dark:border-gray-700"}`}>
            {r}
          </button>
        ))}
      </div>
      {msg && <p role="status" className="text-sm text-gray-700 dark:text-gray-300">{msg}</p>}
      {!lista.length && <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">Nenhuma criança com esse filtro.</p>}
      <ul className="grid gap-2">
        {lista.slice(0, 200).map((c) => (
          <Crianca key={c.id} c={c} />
        ))}
      </ul>
      {lista.length > 200 && <p className="text-xs text-gray-500">Mostrando 200 de {lista.length}. Use a busca.</p>}
    </div>
  );
}

function Crianca({ c }: { c: CriancaView }) {
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const rodar = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      const r = await fn();
      setErro(r.ok ? "" : (r.error ?? "Não deu certo."));
    });
  const confirmados = c.vinculos.filter((v) => v.status === "confirmado");
  return (
    <li className="grid gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          {c.nome} <span className="text-xs font-normal text-gray-500">· {NOME_NIVEL[c.nivel] ?? c.nivel}{c.matricula ? ` · matrícula ${c.matricula}` : ""}</span>
        </p>
        {!confirmados.length && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-300">Sem responsável confirmado</span>}
      </div>
      {c.vinculos.length > 0 && (
        <ul className="grid gap-1">
          {c.vinculos.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0">
                <b>{v.responsavel.nome}</b>
                {v.parentesco && ` (${v.parentesco})`}
                <span className="text-gray-500"> · {v.responsavel.membro ? "membro" : "não é membro"}{v.responsavel.email ? ` · ${v.responsavel.email}` : ""}</span>
                {v.status === "sugerido" && <span className="ml-1 text-amber-800 dark:text-amber-300">— sugerido pelo {v.origem === "email" ? "e-mail" : "celular"}</span>}
              </span>
              {v.status === "sugerido" ? (
                <span className="flex gap-1">
                  <button type="button" disabled={pendente} onClick={() => rodar(() => decidir(v.id, true))} className={`${botao} flex items-center gap-1`}>
                    <Check size={14} aria-hidden /> Confirmar
                  </button>
                  <button type="button" disabled={pendente} onClick={() => rodar(() => decidir(v.id, false))} className={`${botao} flex items-center gap-1`}>
                    <X size={14} aria-hidden /> Não é
                  </button>
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Confirmado</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {adicionando ? <Adicionar criancaId={c.id} fechar={() => setAdicionando(false)} /> : (
        <button type="button" onClick={() => setAdicionando(true)} className="flex w-fit items-center gap-1 text-[13px] font-semibold text-na-green dark:text-emerald-400">
          <UserPlus size={14} aria-hidden /> Adicionar responsável
        </button>
      )}
      {erro && <p role="alert" className="text-[13px] text-red-700 dark:text-red-400">{erro}</p>}
    </li>
  );
}

function Adicionar({ criancaId, fechar }: { criancaId: string; fechar: () => void }) {
  const [modo, setModo] = useState<"membro" | "externo">("membro");
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<{ id: string; name: string; mercurioId: string | null }[]>([]);
  const [parentesco, setParentesco] = useState("");
  const [d, setD] = useState({ nome: "", email: "", celular: "", cpf: "" });
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const fim = (r: { ok: boolean; error?: string }) => (r.ok ? fechar() : setErro(r.error ?? "Não deu certo."));
  return (
    <div className="grid gap-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800/60">
      <div className="flex flex-wrap gap-2">
        {(["membro", "externo"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)} className={`min-h-8 rounded-full border px-3 text-xs font-semibold ${modo === m ? "border-na-green bg-na-green text-white" : "border-gray-300 dark:border-gray-700"}`}>
            {m === "membro" ? "É membro da escola" : "Não é membro"}
          </button>
        ))}
        <input value={parentesco} onChange={(e) => setParentesco(e.target.value)} placeholder="Parentesco (mãe, pai, avó…)" aria-label="Parentesco" className={`${campo} flex-1 basis-40`} />
      </div>
      {modo === "membro" ? (
        <>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              iniciar(async () => setAchados(await procurarAdultos(criancaId, termo)));
            }}
          >
            <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome ou matrícula do responsável" aria-label="Buscar responsável" className={`${campo} flex-1`} />
            <button type="submit" disabled={pendente} className={`${botao} flex items-center gap-1`}>
              <Search size={14} aria-hidden /> Buscar
            </button>
          </form>
          <ul className="grid gap-1">
            {achados.map((a) => (
              <li key={a.id}>
                <button type="button" disabled={pendente} onClick={() => iniciar(async () => fim(await adicionarResponsavelMembro(criancaId, a.id, parentesco)))} className="text-left text-[13px] font-semibold text-na-green underline dark:text-emerald-400">
                  {a.name} {a.mercurioId && `(${a.mercurioId})`}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => fim(await adicionarResponsavelExterno(criancaId, { ...d, parentesco })));
          }}
        >
          <input required value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder="Nome completo" aria-label="Nome" className={campo} />
          <input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} placeholder="E-mail" aria-label="E-mail" className={campo} />
          <input value={d.celular} onChange={(e) => setD({ ...d, celular: e.target.value })} placeholder="Celular com DDD" aria-label="Celular" className={campo} />
          <input value={d.cpf} onChange={(e) => setD({ ...d, cpf: e.target.value })} placeholder="CPF (opcional)" aria-label="CPF" inputMode="numeric" className={campo} />
          <button type="submit" disabled={pendente} className={`${botao} bg-na-green text-white sm:col-span-2`}>Salvar responsável</button>
        </form>
      )}
      {erro && <p role="alert" className="text-[13px] text-red-700 dark:text-red-400">{erro}</p>}
      <button type="button" onClick={fechar} className="w-fit text-xs text-gray-500 underline">Cancelar</button>
    </div>
  );
}
