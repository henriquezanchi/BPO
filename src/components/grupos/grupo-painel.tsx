"use client";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

import { FormGrupo } from "@/components/grupos/form-grupo";
import { SeletorPessoas, type PessoaOpcao } from "@/components/grupos/seletor-pessoas";
import { MeetingManager } from "@/components/member/groups/meeting-manager";
import { PerguntaPresenca } from "@/components/grupos/pergunta-presenca";
import {
  adicionarPessoas,
  arquivarGrupo,
  buscarCandidatos,
  buscarResponsaveis,
  removerAtividade,
  removerPessoa,
  responderPedidoGaf,
  salvarAtividade,
} from "@/lib/actions/grupos-actions";
import type { DetalheGrupo } from "@/lib/grupos-dados";
import { FREQUENCIAS, MODALIDADES, TIPOS_GRUPO, ehDeAlunos, type TipoDoPortal } from "@/lib/grupos-comum";
import { CalendarClock, ExternalLink, ListChecks, Loader2, MapPin, Pencil, Plus, Trash2, Users, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactNode } from "react";

type D = NonNullable<DetalheGrupo>;
type Atividade = D["grupo"]["atividades"][number];

const CARTAO = "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 lg:p-5";
const TITULO = "mb-3 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100";
const CAMPO =
  "min-h-10 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-[13px] text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";
const BOTAO =
  "flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-na-green px-3.5 text-[13px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60";
const BOTAO_LEVE =
  "flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-na-green-dark hover:bg-na-green-light dark:text-emerald-300 dark:hover:bg-emerald-950/40";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const STATUS: Record<string, string> = { ativa: "Ativa", pausada: "Pausada", concluida: "Concluída" };

export type AbaGrupo = "escala" | "encontros" | "avisos" | "atividades" | "equipe" | "sobre" | "orientacoes";
type Aba = AbaGrupo;

/**
 * Página única de um grupo (GAF, GDVE, secretaria, Grupo Feminino/Masculino/de Segurança), pedido do
 * usuário 2026-10-25: abas (na URL, ?aba=) em qualquer tela. "Avisos e enquetes" (antes só em
 * Professor) e "Orientações" (secretarias) chegam prontos do servidor.
 */
export function GrupoPainel({ dados, abaInicial, avisos, orientacoes, escala }: { dados: D; abaInicial?: string; avisos?: ReactNode; orientacoes?: ReactNode; escala?: ReactNode }) {
  const { papel, grupo } = dados;
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const doPortal = TIPOS_GRUPO[grupo.tipo].doPortal;
  const recarregar = () => router.refresh();

  const abas = ([
    // Turma de pedagogos (2026-10-26): a escala de apresentações é a primeira aba.
    escala ? ["escala", "Escala de apresentações"] : null,
    ["encontros", "Encontros"],
    avisos ? ["avisos", "Avisos e enquetes"] : null,
    ["atividades", "Atividades"],
    ["equipe", grupo.tipo === "SEC" ? "Equipe" : "Pessoas"],
    ["sobre", "Sobre"],
    orientacoes ? ["orientacoes", "Orientações"] : null,
  ].filter(Boolean) as [Aba, string][]);
  const [aba, setAbaEstado] = useState<Aba>(() => abas.find(([a]) => a === abaInicial)?.[0] ?? abas[0][0]);
  // Troca na hora e guarda na URL (voltar/compartilhar abre na mesma aba).
  const setAba = (a: Aba) => {
    setAbaEstado(a);
    const url = new URL(window.location.href);
    url.searchParams.set("aba", a);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-na-gold/15 px-2.5 py-0.5 text-[11px] font-bold text-na-gold-dark dark:text-na-gold">
          {TIPOS_GRUPO[grupo.tipo].completo}
        </span>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">{grupo.name}</h1>
          {papel.podeGerir && doPortal && !editando && (
            <button onClick={() => setEditando(true)} className={BOTAO_LEVE}>
              <Pencil size={13} /> Editar
            </button>
          )}
        </div>
        <InfoEncontro grupo={grupo} />
      </header>

      {editando && (
        <section className={CARTAO}>
          <FormGrupo
            tipo={grupo.tipo as TipoDoPortal}
            schoolId={grupo.schoolId}
            grupoId={grupo.id}
            inicial={{
              nome: grupo.name,
              descricao: grupo.descricao,
              modalidade: grupo.modalidade,
              local: grupo.local,
              linkOnline: grupo.linkOnline,
              permiteAlunos: grupo.permiteAlunos,
              programa: grupo.programa,
            }}
            onSalvo={() => {
              setEditando(false);
              recarregar();
            }}
            onCancelar={() => setEditando(false)}
          />
        </section>
      )}

      {/* Mesmo visual das abas das áreas (AbasArea). */}
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 lg:mx-0 lg:px-0 dark:border-gray-800" aria-label="Seções do grupo">
        {abas.map(([a, r]) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            aria-current={aba === a ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2 text-[13px] font-semibold ${
              aba === a ? "border-na-green text-na-green-dark dark:text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            {r}
          </button>
        ))}
      </nav>

      <div className="flex max-w-3xl flex-col gap-4">
        {aba === "escala" && escala}
        {aba === "encontros" && <Encontros dados={dados} recarregar={recarregar} />}
        {aba === "avisos" && avisos}
        {aba === "atividades" && <Atividades dados={dados} recarregar={recarregar} />}
        {aba === "equipe" && <Equipe dados={dados} recarregar={recarregar} />}
        {aba === "sobre" && <Sobre dados={dados} recarregar={recarregar} />}
      </div>
      {aba === "orientacoes" && orientacoes}
    </div>
  );
}

function InfoEncontro({ grupo }: { grupo: D["grupo"] }) {
  const itens = [
    grupo.frequencia && { icone: <CalendarClock size={13} />, texto: FREQUENCIAS[grupo.frequencia] ?? `A cada ${grupo.frequencia} semanas` },
    grupo.modalidade && { icone: grupo.modalidade === "online" ? <Video size={13} /> : <Users size={13} />, texto: MODALIDADES[grupo.modalidade] },
    grupo.local && { icone: <MapPin size={13} />, texto: grupo.local },
  ].filter(Boolean) as { icone: React.ReactNode; texto: string }[];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-gray-600 dark:text-gray-300">
      {itens.map((i) => (
        <span key={i.texto} className="flex items-center gap-1.5">
          {i.icone} {i.texto}
        </span>
      ))}
      {grupo.slack && (
        <a href={grupo.slack} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-na-green-dark dark:text-emerald-400">
          Canal no Slack <ExternalLink size={12} />
        </a>
      )}
      {grupo.linkOnline && (
        <a
          href={grupo.linkOnline}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-semibold text-na-green-dark dark:text-emerald-400"
        >
          Entrar no encontro online <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

function Sobre({ dados, recarregar }: { dados: D; recarregar: () => void }) {
  const { grupo, papel } = dados;
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const podeEncerrar = papel.podeGerir && TIPOS_GRUPO[grupo.tipo].doPortal;
  return (
    <section className={CARTAO}>
      <CollapsibleSection defaultOpen title={<h2 className={TITULO}>Sobre</h2>}>
      {grupo.descricao ? (
        <p className="text-[13px] whitespace-pre-wrap text-gray-700 dark:text-gray-300">{grupo.descricao}</p>
      ) : (
        <p className="text-[12px] text-gray-500">Sem descrição.</p>
      )}
      {ehDeAlunos(grupo.tipo) && (
        <>
          <p className="mt-3 text-[12px] text-gray-600 dark:text-gray-400">
            {grupo.permiteAlunos ? "Aberto a membros e alunos." : "Só para membros (2º nível em diante)."}
          </p>
          {grupo.programa && (
            <details className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50" open>
              <summary className="cursor-pointer text-[12px] font-bold text-gray-800 dark:text-gray-200">Programa de estudos</summary>
              <p className="mt-2 text-[13px] whitespace-pre-wrap text-gray-700 dark:text-gray-300">{grupo.programa}</p>
            </details>
          )}
        </>
      )}
      {grupo.tipo === "GDVE" && <p className="mt-3 text-[12px] text-gray-600 dark:text-gray-400">Visível somente para FV.</p>}
      {podeEncerrar && (
        <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
          <button
            disabled={pendente}
            onClick={() => {
              if (!confirm("Encerrar este grupo? Ele sai das listas e da Agenda; o histórico fica guardado.")) return;
              iniciar(async () => {
                const r = await arquivarGrupo(grupo.id);
                if (!r.ok) return setErro(r.error);
                router.push(grupo.tipo === "GDVE" ? "/voluntario" : "/admin");
                recarregar();
              });
            }}
            className="text-[12px] font-semibold text-na-danger-dark hover:underline dark:text-red-400"
          >
            Encerrar grupo
          </button>
          {erro && <p className="mt-1 text-[11px] text-na-danger-dark">{erro}</p>}
        </div>
      )}
    </CollapsibleSection></section>
  );
}

function Equipe({ dados, recarregar }: { dados: D; recarregar: () => void }) {
  const { grupo, papel } = dados;
  const doPortal = TIPOS_GRUPO[grupo.tipo].doPortal;
  const gerir = papel.podeGerir && doPortal;
  const [adicionando, setAdicionando] = useState<"professor" | "aluno" | null>(null);
  const [escolhidos, setEscolhidos] = useState<PessoaOpcao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const buscar = useCallback(
    (t: string) => (adicionando === "professor" && grupo.tipo !== "GDVE" ? buscarResponsaveis(grupo.schoolId, t) : buscarCandidatos({ grupoId: grupo.id }, t)),
    [adicionando, grupo.id, grupo.schoolId, grupo.tipo],
  );
  const rotulos =
    grupo.tipo === "SEC"
      ? ["Responsáveis", "Equipe de voluntários"]
      : ehDeAlunos(grupo.tipo) || grupo.tipo === "GDVE"
        ? ["Coordenação", "Participantes"]
        : ["Responsáveis", "Integrantes"];

  function salvar() {
    if (!adicionando || !escolhidos.length) return;
    setErro(null);
    iniciar(async () => {
      const r = await adicionarPessoas(
        grupo.id,
        adicionando,
        escolhidos.map((p) => p.id),
      );
      if (!r.ok) return setErro(r.error);
      setEscolhidos([]);
      setAdicionando(null);
      recarregar();
    });
  }
  function tirar(role: "professor" | "aluno", id: string, nome: string) {
    if (!confirm(`Tirar ${nome} do grupo?`)) return;
    iniciar(async () => {
      const r = await removerPessoa(grupo.id, role, id);
      if (!r.ok) return setErro(r.error);
      recarregar();
    });
  }

  const lista = (role: "professor" | "aluno", pessoas: { id: string; name: string }[], rotulo: string) => (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[12px] font-bold text-gray-500 uppercase dark:text-gray-400">
          {rotulo} <span className="font-normal">({pessoas.length})</span>
        </h3>
        {gerir && (
          <button onClick={() => (setAdicionando(adicionando === role ? null : role), setEscolhidos([]))} className={BOTAO_LEVE}>
            {adicionando === role ? <X size={13} /> : <Plus size={13} />} {adicionando === role ? "Fechar" : "Adicionar"}
          </button>
        )}
      </div>
      {adicionando === role && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
          <SeletorPessoas rotulo="Quem entra" buscar={buscar} selecionados={escolhidos} onChange={setEscolhidos} bloqueados={pessoas.map((p) => p.id)} />
          <button disabled={pendente || !escolhidos.length} onClick={salvar} className={BOTAO}>
            {pendente && <Loader2 size={13} className="animate-spin" />} Adicionar {escolhidos.length || ""}
          </button>
        </div>
      )}
      {pessoas.length === 0 ? (
        <p className="text-[12px] text-gray-500">Ninguém ainda.</p>
      ) : (
        <ul className="flex flex-col">
          {pessoas.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between border-b border-gray-100 py-1.5 text-[13px] text-gray-800 last:border-0 dark:border-gray-800 dark:text-gray-200"
            >
              {p.name}
              {gerir && (
                <button
                  onClick={() => tirar(role, p.id, p.name)}
                  aria-label={`Tirar ${p.name}`}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-na-danger-dark dark:hover:bg-gray-800"
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className={CARTAO}>
      <CollapsibleSection defaultOpen title={<h2 className={TITULO}>
        <Users size={15} /> {grupo.tipo === "SEC" ? "Equipe" : "Pessoas"}
      </h2>}>
      <div className="flex flex-col gap-4">
        {gerir && dados.pedidos.length > 0 && <PedidosGaf pedidos={dados.pedidos} recarregar={recarregar} />}
        {lista("professor", grupo.responsaveis, rotulos[0])}
        {lista("aluno", grupo.integrantes, rotulos[1])}
      </div>
      {!doPortal && <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">A composição deste grupo vem do Mercúrio.</p>}
      {erro && <p className="mt-2 text-[12px] text-na-danger-dark dark:text-red-400">{erro}</p>}
    </CollapsibleSection></section>
  );
}

/** Pedidos para participar deste GAF, feitos pelo Portal do Aluno (2026-10-25). */
function PedidosGaf({ pedidos, recarregar }: { pedidos: D["pedidos"]; recarregar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  function responder(id: string, aceitar: boolean) {
    setErro(null);
    iniciar(async () => {
      const r = await responderPedidoGaf(id, aceitar);
      if (!r.ok) return setErro(r.error);
      recarregar();
    });
  }
  return (
    <div className="rounded-xl border border-na-gold/40 bg-na-gold/10 p-3 dark:border-amber-900 dark:bg-amber-950/20">
      <p className="mb-2 text-[12px] font-bold text-na-gold-dark dark:text-amber-300">Pedidos para participar ({pedidos.length})</p>
      <ul className="flex flex-col gap-1.5">
        {pedidos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-gray-800 dark:text-gray-200">
            <span className="min-w-0">
              {p.nome} {!p.membro && <span className="text-[11px] text-gray-500">· aluno</span>}
              <span className="block text-[11px] text-gray-500 dark:text-gray-400">Pediu em {new Date(p.em).toLocaleDateString("pt-BR")}</span>
            </span>
            <span className="flex gap-1.5">
              <button disabled={pendente} onClick={() => responder(p.id, true)} className="rounded-lg bg-na-green px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-60">
                Aceitar
              </button>
              <button disabled={pendente} onClick={() => responder(p.id, false)} className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-gray-600 disabled:opacity-60 dark:text-gray-300">
                Recusar
              </button>
            </span>
          </li>
        ))}
      </ul>
      {erro && <p className="mt-2 text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
    </div>
  );
}

function Atividades({ dados, recarregar }: { dados: D; recarregar: () => void }) {
  const { grupo, papel } = dados;
  const [editando, setEditando] = useState<Atividade | "nova" | null>(null);
  const ativas = grupo.atividades.filter((a) => a.status !== "concluida");
  const concluidas = grupo.atividades.filter((a) => a.status === "concluida");
  return (
    <section className={CARTAO}><CollapsibleSection defaultOpen title={<h2 className={`${TITULO} mb-0`}>
          <ListChecks size={15} /> Atividades
        </h2>}>
      <div className="mb-3 flex items-center justify-between">

        {papel.podeGerir && editando === null && (
          <button onClick={() => setEditando("nova")} className={BOTAO_LEVE}>
            <Plus size={13} /> Nova atividade
          </button>
        )}
      </div>
      {editando && <FormAtividade grupo={grupo} atividade={editando === "nova" ? null : editando} onFim={() => (setEditando(null), recarregar())} />}
      {grupo.atividades.length === 0 && !editando && (
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          {papel.podeGerir
            ? "Liste o que o grupo faz e quem responde por cada coisa: recepção, escala do café, organização do evento…"
            : "Nenhuma atividade cadastrada."}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {ativas.map((a) => (
          <ItemAtividade key={a.id} a={a} podeGerir={papel.podeGerir} onEditar={() => setEditando(a)} recarregar={recarregar} />
        ))}
      </ul>
      {concluidas.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] font-semibold text-gray-500">Concluídas ({concluidas.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {concluidas.map((a) => (
              <ItemAtividade key={a.id} a={a} podeGerir={papel.podeGerir} onEditar={() => setEditando(a)} recarregar={recarregar} />
            ))}
          </ul>
        </details>
      )}
    </CollapsibleSection></section>
  );
}

function ItemAtividade({ a, podeGerir, onEditar, recarregar }: { a: Atividade; podeGerir: boolean; onEditar: () => void; recarregar: () => void }) {
  const [pendente, iniciar] = useTransition();
  return (
    <li className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
            {a.titulo}
            {a.status !== "ativa" && (
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {STATUS[a.status]}
              </span>
            )}
          </p>
          {a.descricao && <p className="mt-0.5 text-[12px] whitespace-pre-wrap text-gray-600 dark:text-gray-400">{a.descricao}</p>}
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {a.nomesResponsaveis.length ? `Responsável: ${a.nomesResponsaveis.join(", ")}` : "Sem responsável definido"}
            {a.periodicidade ? ` · ${a.periodicidade}` : ""}
          </p>
        </div>
        {podeGerir && (
          <div className="flex shrink-0 gap-0.5">
            <button
              onClick={onEditar}
              aria-label={`Editar ${a.titulo}`}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
            >
              <Pencil size={13} />
            </button>
            <button
              disabled={pendente}
              onClick={() => confirm(`Apagar a atividade "${a.titulo}"?`) && iniciar(async () => (await removerAtividade(a.id), recarregar()))}
              aria-label={`Apagar ${a.titulo}`}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-na-danger-dark dark:hover:bg-gray-800"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function FormAtividade({ grupo, atividade, onFim }: { grupo: D["grupo"]; atividade: Atividade | null; onFim: () => void }) {
  const pessoas = [...grupo.responsaveis, ...grupo.integrantes].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
  const [resp, setResp] = useState<string[]>(atividade?.responsaveis ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    iniciar(async () => {
      const r = await salvarAtividade(grupo.id, {
        id: atividade?.id,
        titulo: String(f.get("titulo") ?? ""),
        descricao: String(f.get("descricao") ?? ""),
        periodicidade: String(f.get("periodicidade") ?? ""),
        status: String(f.get("status") ?? "ativa"),
        responsaveis: resp,
      });
      if (!r.ok) return setErro(r.error);
      onFim();
    });
  }
  return (
    <form onSubmit={enviar} className="mb-3 flex flex-col gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
      <div className="grid gap-3 md:grid-cols-[1fr_200px]">
        <input
          name="titulo"
          required
          maxLength={120}
          defaultValue={atividade?.titulo}
          placeholder="Atividade (ex.: escala do café)"
          className={CAMPO}
          aria-label="Atividade"
        />
        <input
          name="periodicidade"
          maxLength={80}
          defaultValue={atividade?.periodicidade ?? ""}
          placeholder="Quando (ex.: toda sexta)"
          className={CAMPO}
          aria-label="Quando"
        />
      </div>
      <textarea
        name="descricao"
        rows={2}
        maxLength={2000}
        defaultValue={atividade?.descricao ?? ""}
        placeholder="Detalhes (opcional)"
        className={CAMPO}
        aria-label="Detalhes"
      />
      <fieldset>
        <legend className="mb-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-300">Responsáveis pela atividade</legend>
        <div className="flex flex-wrap gap-1.5">
          {pessoas.map((p) => {
            const marcado = resp.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={marcado}
                onClick={() => setResp(marcado ? resp.filter((r) => r !== p.id) : [...resp, p.id])}
                className={`rounded-full border px-2.5 py-1 text-[12px] ${marcado ? "border-na-green bg-na-green text-white" : "border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"}`}
              >
                {p.name}
              </button>
            );
          })}
          {pessoas.length === 0 && <p className="text-[12px] text-gray-500">Adicione pessoas ao grupo para escolher responsáveis.</p>}
        </div>
      </fieldset>
      {atividade && (
        <select name="status" defaultValue={atividade.status} className={`${CAMPO} md:w-48`} aria-label="Situação">
          <option value="ativa">Ativa</option>
          <option value="pausada">Pausada</option>
          <option value="concluida">Concluída</option>
        </select>
      )}
      {erro && <p className="text-[12px] text-na-danger-dark">{erro}</p>}
      <div className="flex gap-2">
        <button disabled={pendente} className={BOTAO}>
          {pendente && <Loader2 size={13} className="animate-spin" />} Salvar
        </button>
        <button type="button" onClick={onFim} className="min-h-10 px-3 text-[13px] font-semibold text-gray-600 dark:text-gray-300">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Encontros({ dados, recarregar }: { dados: D; recarregar: () => void }) {
  const { papel, encontros, agora } = dados;
  const futuros = encontros.filter((e) => new Date(e.endsAt).getTime() >= agora && e.status !== "cancelada").slice(0, 6);
  const passados = encontros
    .filter((e) => new Date(e.startsAt).getTime() <= agora && e.status !== "cancelada")
    .reverse()
    .slice(0, 8);
  // Reuniões recolhidas por padrão em todos os grupos (pedido do usuário 2026-10-19) — só o próximo encontro à vista.
  const proximo = futuros[0];
  return (
    <details className={`${CARTAO} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
            <CalendarClock size={15} /> Reuniões
          </span>
          <span className="truncate text-[12px] text-gray-500 capitalize dark:text-gray-400">
            {proximo ? `Próxima: ${quando(proximo.startsAt)}` : "Nenhuma reunião marcada"}
          </span>
        </span>
        <span className="shrink-0 text-[12px] font-semibold text-na-green-dark group-open:hidden dark:text-emerald-400">
          {papel.podeGerir ? "Abrir e gerenciar" : "Ver reuniões"}
        </span>
        <span className="hidden shrink-0 text-[12px] font-semibold text-gray-500 group-open:inline">Fechar</span>
      </summary>
      <div className="mt-4">
        <ConteudoEncontros dados={dados} recarregar={recarregar} futuros={futuros} passados={passados} />
      </div>
    </details>
  );
}

function ConteudoEncontros({ dados, recarregar, futuros, passados }: { dados: D; recarregar: () => void; futuros: D["encontros"]; passados: D["encontros"] }) {
  const { grupo, papel } = dados;
  return (
    <>
      {papel.podeGerir ? (
        <MeetingManager groupId={grupo.id} mostrarTraje={["BF", "BM", "CS", "GDVE"].includes(grupo.tipo)} />
      ) : futuros.length === 0 ? (
        <p className="text-[12px] text-gray-500">Nenhum encontro marcado.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {futuros.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-[13px] dark:bg-gray-800/50">
              <span className="font-semibold text-gray-900 capitalize dark:text-gray-100">{quando(e.startsAt)}</span>
              <span className="truncate text-gray-600 dark:text-gray-400">{e.title}</span>
            </li>
          ))}
        </ul>
      )}
      {!papel.podeGerir && (papel.integrante || papel.responsavel) && passados.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
          <CollapsibleSection title={<h3 className="mb-2 text-[12px] font-bold text-gray-500 uppercase dark:text-gray-400">Encontros recentes</h3>}>
          <ul className="flex flex-col gap-2">
            {passados.map((e) => (
              <li key={e.id} className="flex flex-col gap-1.5 rounded-lg border border-gray-100 p-2.5 text-[13px] dark:border-gray-800">
                <span className="text-gray-800 capitalize dark:text-gray-200">{quando(e.startsAt)}</span>
                <PerguntaPresenca meetingId={e.id} atual={e.presencas[0] ?? null} onSalvo={recarregar} />
              </li>
            ))}
          </ul>
        </CollapsibleSection></div>
      )}
    </>
  );
}
