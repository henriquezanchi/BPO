"use client";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

import { FormGrupo } from "@/components/grupos/form-grupo";
import { criarSecretariasSugeridas, getSugestoesSecretarias, type SugestaoComPessoas } from "@/lib/actions/grupos-actions";
import type { ResumoGrupo } from "@/lib/grupos-dados";
import { MODALIDADES } from "@/lib/grupos-comum";
import { SECRETARIAS_PADRAO } from "@/lib/secretarias";
import { CalendarClock, ChevronRight, Database, ListChecks, Loader2, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function CartaoGrupo({ g, de, etiqueta }: { g: ResumoGrupo; de: "admin" | "voluntario" | "portal"; etiqueta?: string }) {
  return (
    <Link
      href={`/grupos/${g.id}${de === "voluntario" ? "" : `?de=${de}`}`}
      className="group flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-na-green/50 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[14px] font-bold text-gray-900 dark:text-gray-100">
          {g.nome}
          {etiqueta && <span className="ml-2 align-middle text-[10px] font-semibold text-gray-400">{etiqueta}</span>}
        </h3>
        <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-300 transition group-hover:text-na-green" />
      </div>
      <p className="text-[12px] text-gray-600 dark:text-gray-400">{g.responsaveis.length ? g.responsaveis.join(", ") : <span className="text-na-warning-dark dark:text-amber-300">Sem responsável</span>}</p>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Users size={12} /> {g.integrantes}
        </span>
        <span className="flex items-center gap-1">
          <ListChecks size={12} /> {g.atividades} atividade{g.atividades === 1 ? "" : "s"}
        </span>
        {g.modalidade && <span>{MODALIDADES[g.modalidade]}</span>}
        <span className="flex items-center gap-1">
          <CalendarClock size={12} /> {g.proximoEncontro ? quando(g.proximoEncontro).replace(/^./, (c) => c.toUpperCase()) : "Sem encontro marcado"}
        </span>
      </div>
    </Link>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-[13px] text-gray-500 dark:border-gray-700 dark:text-gray-400">{texto}</p>;
}

/** Secretarias da filial: lista, criação e sugestões do Mercúrio. */
export function SecretariasAdmin({ schoolId, grupos }: { schoolId: string; grupos: ResumoGrupo[] }) {
  const router = useRouter();
  const [criando, setCriando] = useState<string | null>(null); // nome sugerido ("" = livre)
  const [sugestoes, setSugestoes] = useState<SugestaoComPessoas[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const existentes = new Set(grupos.map((g) => g.nome.toLocaleLowerCase("pt-BR")));

  async function abrirSugestoes() {
    setCarregando(true);
    setAviso(null);
    try {
      const s = await getSugestoesSecretarias(schoolId);
      setSugestoes(s);
      setEscolhidas(s.filter((x) => !x.jaExiste && (x.nome === "Abertura de Turma" || x.responsaveis.some((r) => r.memberId))).map((x) => x.nome));
    } catch {
      setAviso("Não foi possível consultar o Mercúrio agora.");
    } finally {
      setCarregando(false);
    }
  }

  function criarEscolhidas() {
    iniciar(async () => {
      const r = await criarSecretariasSugeridas(schoolId, escolhidas);
      if (!r.ok) return setAviso(r.error);
      setAviso(`${r.criadas} secretaria(s) criada(s) com os responsáveis e a equipe do Mercúrio.`);
      setSugestoes(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setCriando(criando === null ? "" : null)} className="flex min-h-10 items-center gap-1.5 rounded-lg bg-na-green px-3.5 text-[13px] font-semibold text-white hover:bg-na-green-dark">
          {criando === null ? <Plus size={15} /> : <X size={15} />} {criando === null ? "Nova secretaria" : "Fechar"}
        </button>
        <button
          onClick={sugestoes ? () => setSugestoes(null) : abrirSugestoes}
          disabled={carregando}
          className="flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        >
          {carregando ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />} {sugestoes ? "Fechar sugestões" : "Sugestões do Mercúrio"}
        </button>
      </div>
      {aviso && (
        <p role="status" className="rounded-lg bg-na-green-light px-3 py-2 text-[12px] text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
          {aviso}
        </p>
      )}

      {criando !== null && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 lg:p-5 dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-2 text-[12px] text-gray-500 dark:text-gray-400">Comece por um nome comum ou escreva outro:</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {SECRETARIAS_PADRAO.filter((n) => !existentes.has(n.toLocaleLowerCase("pt-BR"))).map((n) => (
              <button
                key={n}
                onClick={() => setCriando(n)}
                className={`rounded-full border px-2.5 py-1 text-[12px] ${criando === n ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 hover:border-na-green dark:border-gray-600 dark:text-gray-300"}`}
              >
                {n}
              </button>
            ))}
          </div>
          <FormGrupo key={criando} tipo="SEC" schoolId={schoolId} sugestaoNome={criando} onSalvo={(id) => router.push(`/grupos/${id}?de=admin`)} onCancelar={() => setCriando(null)} />
        </section>
      )}

      {sugestoes && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 lg:p-5 dark:border-gray-700 dark:bg-gray-900">
          <CollapsibleSection title={<h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Sugestões a partir das funções no Mercúrio</h3>}>
          <p className="mt-1 mb-3 text-[12px] text-gray-500 dark:text-gray-400">
            Lidas das funções de dirigente atuais da filial. Responsável = secretário, pró-secretário ou coordenador; equipe = colaboradores e assistentes. Marque as que quer criar; depois dá para ajustar cada uma.
          </p>
          {sugestoes.length === 0 ? (
            <p className="text-[12px] text-gray-500">Nenhuma função de secretaria registrada no Mercúrio para esta filial.</p>
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {sugestoes.map((s) => {
                const marcada = escolhidas.includes(s.nome);
                return (
                  <li key={s.nome} className={`rounded-xl border p-3 ${s.jaExiste ? "border-gray-100 opacity-60 dark:border-gray-800" : "border-gray-200 dark:border-gray-700"}`}>
                    <label className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        disabled={s.jaExiste}
                        checked={marcada}
                        onChange={() => setEscolhidas(marcada ? escolhidas.filter((n) => n !== s.nome) : [...escolhidas, s.nome])}
                        className="mt-1 h-4 w-4 accent-na-green"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-gray-900 dark:text-gray-100">
                          {s.nome} {s.jaExiste && <span className="text-[11px] font-normal text-gray-500">(já existe)</span>}
                        </span>
                        <span className="block text-[12px] text-gray-600 dark:text-gray-400">
                          {s.responsaveis.length ? `Responsável: ${s.responsaveis.map((r) => r.nome).join(", ")}` : "Sem responsável no Mercúrio"}
                        </span>
                        {s.equipe.length > 0 && <span className="block text-[11px] text-gray-500 dark:text-gray-400">Equipe: {s.equipe.map((r) => r.nome).join(", ")}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {escolhidas.length > 0 && (
            <button onClick={criarEscolhidas} disabled={pendente} className="mt-4 flex min-h-10 items-center gap-1.5 rounded-lg bg-na-green px-4 text-[13px] font-semibold text-white disabled:opacity-60">
              {pendente && <Loader2 size={14} className="animate-spin" />} Criar {escolhidas.length} secretaria{escolhidas.length === 1 ? "" : "s"}
            </button>
          )}
        </CollapsibleSection></section>
      )}

      {grupos.length === 0 ? (
        <Vazio texto="Nenhuma secretaria cadastrada. Use as sugestões do Mercúrio para começar com quem já tem função registrada." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grupos.map((g) => (
            <CartaoGrupo key={g.id} g={g} de="admin" />
          ))}
        </div>
      )}
    </div>
  );
}

/** GAFs da filial: lista, criação e pedidos de participação feitos pelo Portal. */
export function GafAdmin({ schoolId, grupos, pedidos }: { schoolId: string; grupos: ResumoGrupo[]; pedidos: { nome: string; em: string; nivelMembro: boolean; gaf: string | null }[] }) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <div className="flex flex-col gap-5">
        <button onClick={() => setCriando(!criando)} className="flex min-h-10 w-fit items-center gap-1.5 rounded-lg bg-na-green px-3.5 text-[13px] font-semibold text-white hover:bg-na-green-dark">
          {criando ? <X size={15} /> : <Plus size={15} />} {criando ? "Fechar" : "Novo GAF"}
        </button>
        {criando && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 lg:p-5 dark:border-gray-700 dark:bg-gray-900">
            <FormGrupo tipo="GAF" schoolId={schoolId} onSalvo={(id) => router.push(`/grupos/${id}?de=admin`)} onCancelar={() => setCriando(false)} />
          </section>
        )}
        {grupos.length === 0 ? (
          <Vazio texto="Nenhum GAF criado. Cada GAF tem coordenação, participantes, encontros (presenciais, online ou mistos) e o programa de estudos." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {grupos.map((g) => (
              <CartaoGrupo key={g.id} g={g} de="admin" />
            ))}
          </div>
        )}
      </div>
      <aside className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <CollapsibleSection title={<h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Pedidos para participar</h3>}>
        <p className="mt-0.5 mb-3 text-[11px] text-gray-500 dark:text-gray-400">Feitos pelo Portal do Aluno. Os pedidos para um GAF aparecem também na página dele (aba Pessoas), para aceitar ou recusar; os sem GAF escolhido, adicione a pessoa no GAF.</p>
        {pedidos.length === 0 ? (
          <p className="text-[12px] text-gray-500">Nenhum pedido.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {pedidos.map((p) => (
              <li key={p.nome + p.em} className="flex items-center justify-between gap-2 text-[12px] text-gray-700 dark:text-gray-300">
                <span className="truncate">
                  {p.nome} {!p.nivelMembro && <span className="text-[10px] text-gray-400">aluno</span>}
                  <span className="block text-[10px] text-gray-400">{p.gaf ?? "Sem GAF escolhido"}</span>
                </span>
                <span className="shrink-0 text-[11px] text-gray-400">{new Date(p.em).toLocaleDateString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection></aside>
    </div>
  );
}

/** Grupos de estudo e leituras comentadas da filial: lista e criação (instrutores, direção, administração, Escolástica). */
export function EstudosAdmin({ schoolId, grupos }: { schoolId: string; grupos: ResumoGrupo[] }) {
  const router = useRouter();
  const [criando, setCriando] = useState<"ESTUDO" | "LEITURA" | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {(["ESTUDO", "LEITURA"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setCriando(criando === t ? null : t)}
            className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold ${criando === t ? "border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200" : "bg-na-green text-white hover:bg-na-green-dark"}`}
          >
            {criando === t ? <X size={15} /> : <Plus size={15} />} {t === "ESTUDO" ? "Novo grupo de estudo" : "Nova leitura comentada"}
          </button>
        ))}
      </div>
      {criando && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 lg:p-5 dark:border-gray-700 dark:bg-gray-900">
          <FormGrupo key={criando} tipo={criando} schoolId={schoolId} onSalvo={(id) => router.push(`/grupos/${id}`)} onCancelar={() => setCriando(null)} />
        </section>
      )}
      {grupos.length === 0 ? (
        <Vazio texto="Nenhum grupo de estudo ou leitura comentada. Os alunos veem os abertos no Portal do Aluno e entram com “Quero participar”." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grupos.map((g) => (
            <CartaoGrupo key={g.id} g={g} de="voluntario" />
          ))}
        </div>
      )}
    </div>
  );
}
