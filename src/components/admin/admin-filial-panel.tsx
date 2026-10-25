"use client";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

import { alterarRecursoFilial, designarAdministrador, removerAdministrador } from "@/lib/actions/admin-filial-actions";
import type { ChaveRecurso } from "@/lib/recursos-filial";
import { Loader2, Search, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

interface Recurso {
  chave: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function AdminFilialPanel({
  schoolId,
  recursos,
  admins,
  podeEscolherAdmins,
  pessoas,
}: {
  schoolId: string;
  recursos: Recurso[];
  admins: { memberId: string; nome: string }[];
  podeEscolherAdmins: boolean;
  pessoas: { id: string; name: string }[];
}) {
  const [estado, setEstado] = useState(() => Object.fromEntries(recursos.map((r) => [r.chave, r.ativo])));
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [, startTransition] = useTransition();

  const sugestoes = useMemo(() => {
    const q = normalizar(busca.trim());
    if (q.length < 2) return [];
    const jaAdmins = new Set(admins.map((a) => a.memberId));
    return pessoas.filter((p) => !jaAdmins.has(p.id) && normalizar(p.name).includes(q)).slice(0, 8);
  }, [busca, pessoas, admins]);

  function alternar(chave: string) {
    const novo = !estado[chave];
    setErro(null);
    setEmAndamento(chave);
    startTransition(async () => {
      const r = await alterarRecursoFilial(schoolId, chave as ChaveRecurso, novo);
      setEmAndamento(null);
      if (r.ok) setEstado((e) => ({ ...e, [chave]: novo }));
      else setErro(r.error);
    });
  }

  function executar(id: string, acao: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setErro(null);
    setEmAndamento(id);
    startTransition(async () => {
      const r = await acao();
      setEmAndamento(null);
      if (!r.ok) setErro(r.error);
      else setBusca("");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <CollapsibleSection title={<h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Recursos do Portal do Aluno</h2>}>
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
          {recursos.map((r) => {
            const ligado = estado[r.chave];
            return (
              <li key={r.chave} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.nome}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{r.descricao}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={ligado}
                  aria-label={`${ligado ? "Desligar" : "Ligar"} ${r.nome}`}
                  onClick={() => alternar(r.chave)}
                  disabled={emAndamento === r.chave}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${ligado ? "bg-na-green" : "bg-gray-300 dark:bg-gray-700"}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${ligado ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </CollapsibleSection></section>

      <section className="flex flex-col gap-2">
        <CollapsibleSection title={<h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Administradores da filial</h2>}>
        <p className="-mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          O Chefe e o Sub-Chefe já administram. {podeEscolherAdmins ? "Você pode incluir outras pessoas." : "Só eles incluem ou removem outras pessoas."}
        </p>
        {admins.length > 0 ? (
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
            {admins.map((a) => (
              <li key={a.memberId} className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">
                {a.nome}
                {podeEscolherAdmins && (
                  <button
                    aria-label={`Remover ${a.nome}`}
                    disabled={emAndamento === a.memberId}
                    onClick={() => executar(a.memberId, () => removerAdministrador(schoolId, a.memberId))}
                    className="text-gray-400 hover:text-na-danger-dark"
                  >
                    {emAndamento === a.memberId ? <Loader2 size={14} className="animate-spin" /> : <X size={15} />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhum administrador além da direção.</p>
        )}
        {podeEscolherAdmins && (
          <div className="relative">
            <label className="flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 dark:border-gray-700">
              <Search size={14} className="text-gray-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Incluir administrador: digite o nome" className="w-full bg-transparent text-sm outline-none" />
            </label>
            {sugestoes.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                {sugestoes.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => executar(p.id, () => designarAdministrador(schoolId, p.id))}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      {p.name}
                      {emAndamento === p.id && <Loader2 size={13} className="animate-spin" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CollapsibleSection></section>
      {erro && <p className="text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
    </div>
  );
}
