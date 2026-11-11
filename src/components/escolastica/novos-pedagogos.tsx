"use client";

import { BOTAO_CONTORNO, BOTAO_PEQUENO, BOTAO_PRINCIPAL } from "@/components/ui/botoes";
import { alterarIndicadoPedagogos, atenderSolicitacaoPedagogo, cancelarSolicitacaoPedagogo, solicitarPedagogo } from "@/lib/actions/solicitacao-pedagogo-actions";
import type { SolicitacaoParaVer } from "@/lib/solicitacoes-pedagogo";
import { FORMACOES_PEDAGOGO, MOTIVO_MAX, ROTULO_STATUS, type StatusSolicitacaoPedagogo } from "@/lib/solicitacoes-pedagogo-comum";
import { Check, GraduationCap, Loader2, Search, UserCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Candidato = { id: string; name: string; mercurioId: string | null };

const CAMPO =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[14px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

const COR_STATUS: Record<StatusSolicitacaoPedagogo, string> = {
  pendente: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  incluida: "bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300",
  recusada: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  cancelada: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Formulário do Chefe/Sub-Chefe: quem, em que formação e por quê. */
function NovoPedido({ schoolId, candidatos }: { schoolId: string; candidatos: Candidato[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<Candidato | null>(null);
  const [formacao, setFormacao] = useState<string>(FORMACOES_PEDAGOGO[0][0]);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const achados = useMemo(() => {
    const q = semAcento(busca.trim());
    if (q.length < 2) return [];
    return candidatos.filter((c) => semAcento(c.name).includes(q) || c.mercurioId === q).slice(0, 8);
  }, [busca, candidatos]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!escolhido) return setErro("Escolha a pessoa.");
    setErro(null);
    iniciar(async () => {
      const r = await solicitarPedagogo({ schoolId, memberId: escolhido.id, formacao, motivo });
      if (!r.ok) return setErro(r.error);
      setEnviado(escolhido.name);
      setEscolhido(null);
      setBusca("");
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
          <GraduationCap size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Pedir inclusão de pedagogo</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">O responsável nacional pelos pedagogos faz a inclusão no Mercúrio. O pedido fica registrado com o seu nome.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Pessoa</span>
        {escolhido ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-na-green bg-na-green-light/60 px-3 py-2 dark:bg-emerald-950/30">
            <span className="min-w-0 text-[14px] font-semibold text-gray-900 dark:text-gray-100">
              {escolhido.name} <span className="font-normal text-gray-500 dark:text-gray-400">· matr. {escolhido.mercurioId}</span>
            </span>
            <button type="button" onClick={() => setEscolhido(null)} className={BOTAO_PEQUENO}>
              Trocar
            </button>
          </div>
        ) : (
          <>
            <label className="relative">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome ou matrícula"
                aria-label="Buscar pessoa pelo nome ou matrícula"
                className={`${CAMPO} pl-9`}
              />
            </label>
            {busca.trim().length >= 2 && (
              <ul className="flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                {achados.length === 0 ? (
                  <li className="px-3 py-2.5 text-[13px] text-gray-500 dark:text-gray-400">Ninguém encontrado entre os membros ativos que ainda não são pedagogos.</li>
                ) : (
                  achados.map((c) => (
                    <li key={c.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => {
                          setEscolhido(c);
                          setEnviado(null);
                        }}
                        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-[14px] text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
                      >
                        <span className="min-w-0 truncate">{c.name}</span>
                        <span className="shrink-0 text-[12px] text-gray-500 tabular-nums dark:text-gray-400">{c.mercurioId}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </>
        )}
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold text-gray-800 dark:text-gray-200">Formação</legend>
        <div className="flex flex-wrap gap-2">
          {FORMACOES_PEDAGOGO.map(([valor, rotulo]) => (
            <label
              key={valor}
              className={`flex min-h-10 cursor-pointer items-center rounded-full border px-4 text-[13px] font-semibold transition ${
                formacao === valor ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <input type="radio" name="formacao" value={valor} checked={formacao === valor} onChange={() => setFormacao(valor)} className="sr-only" />
              {rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Motivo</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          maxLength={MOTIVO_MAX}
          placeholder="Ex.: concluiu o N1, está na turma de pedagogos desde agosto e vai acompanhar a próxima abertura."
          className={CAMPO}
        />
      </label>

      {erro && <p className="text-[13px] text-na-danger-dark dark:text-red-400">{erro}</p>}
      {enviado && !erro && (
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-na-green-dark dark:text-emerald-300">
          <Check size={15} /> Pedido de {enviado} enviado ao responsável nacional.
        </p>
      )}
      <button type="submit" disabled={enviando} className={`${BOTAO_PRINCIPAL} self-start`}>
        {enviando && <Loader2 size={15} className="animate-spin" />} Enviar pedido
      </button>
    </form>
  );
}

/** Botões de quem atende (responsável nacional e indicados) e de quem pediu (cancelar). */
function AcoesDoPedido({ s, nacional, podeCancelar }: { s: SolicitacaoParaVer; nacional: boolean; podeCancelar: boolean }) {
  const router = useRouter();
  const [recusando, setRecusando] = useState(false);
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const rodar = (acao: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    iniciar(async () => {
      setErro(null);
      const r = await acao();
      if (!r.ok) return setErro(r.error);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      {recusando ? (
        <div className="flex flex-col gap-2">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Por que não foi incluída? A filial vai ler." className={CAMPO} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pendente} onClick={() => rodar(() => atenderSolicitacaoPedagogo(s.id, "recusada", obs))} className={BOTAO_CONTORNO}>
              {pendente && <Loader2 size={15} className="animate-spin" />} Confirmar
            </button>
            <button type="button" onClick={() => setRecusando(false)} className={BOTAO_PEQUENO}>
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {nacional && (
            <>
              <button type="button" disabled={pendente} onClick={() => rodar(() => atenderSolicitacaoPedagogo(s.id, "incluida", ""))} className={BOTAO_PRINCIPAL}>
                {pendente ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Incluído no Mercúrio
              </button>
              <button type="button" onClick={() => setRecusando(true)} className={BOTAO_CONTORNO}>
                Não incluir
              </button>
            </>
          )}
          {podeCancelar && (
            <button type="button" disabled={pendente} onClick={() => rodar(() => cancelarSolicitacaoPedagogo(s.id))} className={BOTAO_PEQUENO}>
              <X size={13} /> Cancelar pedido
            </button>
          )}
        </div>
      )}
      {erro && <p className="text-[13px] text-na-danger-dark dark:text-red-400">{erro}</p>}
    </div>
  );
}

function CartaoPedido({ s, nacional, podeCancelar, mostrarFilial }: { s: SolicitacaoParaVer; nacional: boolean; podeCancelar: boolean; mostrarFilial: boolean }) {
  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{s.pessoa.nome}</p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            {mostrarFilial && `${s.filial} · `}matr. {s.pessoa.matricula ?? "—"} · {s.formacao}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${COR_STATUS[s.status]}`}>{ROTULO_STATUS[s.status]}</span>
      </div>
      <p className="text-[14px] whitespace-pre-line text-gray-700 dark:text-gray-300">{s.motivo}</p>
      <p className="text-[12px] text-gray-500 dark:text-gray-400">
        Pedido por <span className="font-semibold text-gray-700 dark:text-gray-300">{s.solicitadoPor.nome}</span>
        {s.solicitadoPor.matricula && ` (matr. ${s.solicitadoPor.matricula})`} em {data(s.criadaEm)}
        {s.atendidaEm && s.status !== "pendente" && (
          <>
            {" · "}
            {s.status === "cancelada" ? "cancelado" : "atendido"} em {data(s.atendidaEm)}
            {s.atendidaPor ? ` por ${s.atendidaPor}` : s.status === "incluida" ? " pela importação do Mercúrio" : ""}
          </>
        )}
      </p>
      {s.observacao && <p className="rounded-xl bg-gray-50 px-3 py-2 text-[13px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">{s.observacao}</p>}
      {s.status === "pendente" && (nacional || podeCancelar) && <AcoesDoPedido s={s} nacional={nacional} podeCancelar={podeCancelar} />}
    </li>
  );
}

type PessoaEquipe = { matricula: string; nome: string; filial: string };

/** Quem atende os pedidos; o responsável nacional indica e retira pessoas pela matrícula. */
function EquipeQueAtende({ equipe, gere }: { equipe: { responsavel: PessoaEquipe; indicados: PessoaEquipe[] }; gere: boolean }) {
  const router = useRouter();
  const [matricula, setMatricula] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [emAndamento, iniciar] = useTransition();

  const alterar = (matr: string, incluir: boolean) =>
    iniciar(async () => {
      setErro(null);
      const r = await alterarIndicadoPedagogos(matr, incluir);
      if (!r.ok) return setErro(r.error);
      if (incluir) setMatricula("");
      router.refresh();
    });

  const linha = (p: PessoaEquipe, papel: string, remover: boolean) => (
    <li key={p.matricula} className="flex min-h-11 items-center justify-between gap-3 border-b border-gray-100 py-1.5 last:border-0 dark:border-gray-800">
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">{p.nome}</span>
        <span className="block text-[12px] text-gray-500 dark:text-gray-400">
          {papel} · matr. {p.matricula}
          {p.filial && ` · ${p.filial}`}
        </span>
      </span>
      {remover && (
        <button type="button" disabled={emAndamento} onClick={() => alterar(p.matricula, false)} className={BOTAO_PEQUENO}>
          Retirar
        </button>
      )}
    </li>
  );

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
          <UserCheck size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Quem atende os pedidos</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Recebem o aviso de cada pedido novo e marcam a inclusão no Mercúrio.</p>
        </div>
      </div>
      <ul className="flex flex-col">
        {linha(equipe.responsavel, "Responsável nacional", false)}
        {equipe.indicados.map((p) => linha(p, "Indicado", gere))}
      </ul>
      {gere && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alterar(matricula, true);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            inputMode="numeric"
            placeholder="Matrícula de quem vai atender"
            aria-label="Matrícula de quem vai atender"
            className={`${CAMPO} max-w-64`}
          />
          <button type="submit" disabled={emAndamento || !matricula.trim()} className={BOTAO_CONTORNO}>
            {emAndamento && <Loader2 size={15} className="animate-spin" />} Indicar
          </button>
        </form>
      )}
      {erro && <p className="text-[13px] text-na-danger-dark dark:text-red-400">{erro}</p>}
    </section>
  );
}

export function NovosPedagogos({
  schoolId,
  podePedir,
  nacional,
  candidatos,
  solicitacoes,
  escolasQuePede,
  variasFiliais,
  equipe,
  gereIndicados,
}: {
  schoolId: string;
  podePedir: boolean;
  nacional: boolean;
  candidatos: Candidato[];
  solicitacoes: SolicitacaoParaVer[];
  escolasQuePede: string[];
  variasFiliais: boolean;
  equipe: { responsavel: PessoaEquipe; indicados: PessoaEquipe[] };
  gereIndicados: boolean;
}) {
  const pendentes = solicitacoes.filter((s) => s.status === "pendente");
  const historico = solicitacoes.filter((s) => s.status !== "pendente");
  const podeCancelar = (s: SolicitacaoParaVer) => escolasQuePede.includes(s.schoolId);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {podePedir && <NovoPedido key={schoolId} schoolId={schoolId} candidatos={candidatos} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Aguardando inclusão {pendentes.length > 0 && <span className="text-gray-900 dark:text-gray-100">· {pendentes.length}</span>}
        </h2>
        {pendentes.length === 0 ? (
          <p className="text-[14px] text-gray-500 dark:text-gray-400">Nenhum pedido aguardando.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendentes.map((s) => (
              <CartaoPedido key={s.id} s={s} nacional={nacional} podeCancelar={podeCancelar(s)} mostrarFilial={variasFiliais} />
            ))}
          </ul>
        )}
      </section>

      {historico.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">Histórico</h2>
          <ul className="flex flex-col gap-3">
            {historico.map((s) => (
              <CartaoPedido key={s.id} s={s} nacional={false} podeCancelar={false} mostrarFilial={variasFiliais} />
            ))}
          </ul>
        </section>
      )}

      <EquipeQueAtende equipe={equipe} gere={gereIndicados} />
    </div>
  );
}
