"use client";

import { abrirAntecedentes, criarOuTrocarSenha, fecharAntecedentes, salvarAntecedente } from "@/lib/actions/antecedentes-actions";
import type { AntecedenteView, Resultado } from "@/lib/antecedentes";
import { Lock, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * Antecedentes do Maat (lib/antecedentes.ts): só a direção, com a senha exclusiva; libera por 10 minutos. Os dados
 * só chegam ao navegador depois da senha (a página monta a lista no servidor apenas quando liberado).
 */
const RESULTADOS: Record<Resultado, string> = { nada_consta: "Nada consta", em_analise: "Em análise", restricao: "Com restrição" };
const campo = "min-h-9 min-w-0 rounded-lg border border-gray-300 bg-white px-2.5 text-sm dark:border-gray-700 dark:bg-gray-950";
const botao = "min-h-9 rounded-lg px-3 text-sm font-semibold disabled:opacity-60";

export function AntecedentesPanel({ temSenha, lista }: { temSenha: boolean; lista: AntecedenteView[] | null }) {
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const [senha, setSenha] = useState("");
  const [nova, setNova] = useState({ atual: "", nova: "", repetir: "" });
  const [trocando, setTrocando] = useState(false);
  const rodar = (fn: () => Promise<{ ok: boolean; error?: string }>, depois?: () => void) =>
    iniciar(async () => {
      const r = await fn();
      if (r.ok) {
        setErro("");
        depois?.();
      } else setErro(r.error ?? "Não deu certo.");
    });

  const formSenha = (criando: boolean) => (
    <form
      className="grid max-w-sm gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (nova.nova !== nova.repetir) return setErro("As duas senhas não são iguais.");
        rodar(() => criarOuTrocarSenha(nova.nova, nova.atual), () => {
          setNova({ atual: "", nova: "", repetir: "" });
          setTrocando(false);
        });
      }}
    >
      {!criando && <input type="password" autoComplete="current-password" value={nova.atual} onChange={(e) => setNova({ ...nova, atual: e.target.value })} placeholder="Senha exclusiva atual" aria-label="Senha exclusiva atual" className={campo} />}
      <input type="password" autoComplete="new-password" value={nova.nova} onChange={(e) => setNova({ ...nova, nova: e.target.value })} placeholder="Nova senha (8+ caracteres, letras e números)" aria-label="Nova senha" className={campo} />
      <input type="password" autoComplete="new-password" value={nova.repetir} onChange={(e) => setNova({ ...nova, repetir: e.target.value })} placeholder="Repita a nova senha" aria-label="Repita a nova senha" className={campo} />
      <button type="submit" disabled={pendente} className={`${botao} bg-na-green text-white`}>{criando ? "Criar senha exclusiva" : "Trocar senha"}</button>
      <p className="text-xs text-gray-500">Use uma senha diferente da do Portal. Ninguém, nem a administração, consegue recuperá-la; se esquecer, peça ao administrador do Portal para apagá-la e crie outra.</p>
    </form>
  );

  return (
    <div className="grid gap-3">
      <p className="flex gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        Registro sigiloso da pesquisa de antecedentes do Instituto Maat. Só a direção vê, com a senha exclusiva, e cada consulta fica registrada. Os
        secretários do programa não veem esta parte.
      </p>
      {!temSenha ? (
        formSenha(true)
      ) : lista === null ? (
        <form
          className="flex max-w-sm gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            rodar(() => abrirAntecedentes(senha), () => setSenha(""));
          }}
        >
          <input type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha exclusiva" aria-label="Senha exclusiva" className={`${campo} flex-1`} />
          <button type="submit" disabled={pendente || !senha} className={`${botao} bg-na-green text-white`}>Abrir</button>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck size={16} aria-hidden /> Aberto por 10 minutos
            </span>
            <button type="button" onClick={() => rodar(() => fecharAntecedentes())} className={`${botao} border border-gray-300 dark:border-gray-700`}>Fechar agora</button>
            <button type="button" onClick={() => setTrocando((t) => !t)} className="text-xs text-gray-500 underline">Trocar senha</button>
          </div>
          {trocando && formSenha(false)}
          {!lista.length ? (
            <p className="text-sm text-gray-500">Nenhum voluntário dos programas marcado nas suas filiais. Marque-os na lista de voluntários acima.</p>
          ) : (
            <ul className="grid gap-2">
              {lista.map((v) => (
                <Linha key={v.memberId} v={v} />
              ))}
            </ul>
          )}
        </>
      )}
      {erro && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{erro}</p>}
    </div>
  );
}

function Linha({ v }: { v: AntecedenteView }) {
  const [editando, setEditando] = useState(false);
  const [d, setD] = useState({ resultado: v.registro?.resultado ?? ("em_analise" as Resultado), pesquisadoEm: v.registro?.pesquisadoEm ?? "", validade: v.registro?.validade ?? "", obs: v.registro?.obs ?? "" });
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  const cor = !v.registro ? "text-gray-500" : v.registro.resultado === "nada_consta" ? "text-emerald-700 dark:text-emerald-400" : v.registro.resultado === "restricao" ? "text-red-700 dark:text-red-400" : "text-amber-800 dark:text-amber-300";
  const vencido = v.registro?.validade && v.registro.validade < new Date().toISOString().slice(0, 10);
  return (
    <li className="grid gap-2 rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <b>{v.nome}</b> <span className="text-xs text-gray-500">· {v.programa}{v.matricula ? ` · ${v.matricula}` : ""}</span>
        </span>
        <span className={`font-semibold ${cor}`}>
          {v.registro ? RESULTADOS[v.registro.resultado] : "Sem registro"}
          {v.registro?.validade && <span className={`ml-1 text-xs font-normal ${vencido ? "text-red-700 dark:text-red-400" : "text-gray-500"}`}>{vencido ? "· vencida em " : "· válida até "}{v.registro.validade.split("-").reverse().join("/")}</span>}
        </span>
      </div>
      {v.registro?.obs && !editando && <p className="text-[13px] text-gray-600 dark:text-gray-400">{v.registro.obs}</p>}
      {editando ? (
        <form
          className="grid gap-2 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await salvarAntecedente({ memberId: v.memberId, ...d });
              if (r.ok) setEditando(false);
              else setErro(r.error);
            });
          }}
        >
          <select value={d.resultado} onChange={(e) => setD({ ...d, resultado: e.target.value as Resultado })} aria-label="Resultado" className={campo}>
            {Object.entries(RESULTADOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
          <label className="grid text-xs text-gray-500">Pesquisa em<input type="date" value={d.pesquisadoEm} onChange={(e) => setD({ ...d, pesquisadoEm: e.target.value })} className={campo} /></label>
          <label className="grid text-xs text-gray-500">Válida até<input type="date" value={d.validade} onChange={(e) => setD({ ...d, validade: e.target.value })} className={campo} /></label>
          <textarea value={d.obs} onChange={(e) => setD({ ...d, obs: e.target.value })} rows={2} maxLength={1000} placeholder="Observação (opcional, sigilosa)" aria-label="Observação" className={`${campo} py-2 sm:col-span-3`} />
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={pendente} className={`${botao} bg-na-green text-white`}>Salvar</button>
            <button type="button" onClick={() => setEditando(false)} className={`${botao} border border-gray-300 dark:border-gray-700`}>Cancelar</button>
          </div>
          {erro && <p role="alert" className="text-[13px] text-red-700 dark:text-red-400 sm:col-span-3">{erro}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setEditando(true)} className="w-fit text-[13px] font-semibold text-na-green underline dark:text-emerald-400">
          {v.registro ? "Atualizar registro" : "Registrar pesquisa"}
        </button>
      )}
    </li>
  );
}
