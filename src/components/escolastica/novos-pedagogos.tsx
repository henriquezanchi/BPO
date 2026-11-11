"use client";

import { BOTAO_CONTORNO, BOTAO_PEQUENO, BOTAO_PRINCIPAL } from "@/components/ui/botoes";
import { CartaoSecao } from "@/components/ui/cartao-secao";
import { alterarIndicadoPedagogos, cancelarSolicitacaoPedagogo, decidirPedagogos, solicitarPedagogos } from "@/lib/actions/solicitacao-pedagogo-actions";
import type { ItemDoPedido, PedidoParaVer } from "@/lib/solicitacoes-pedagogo";
import { FORMACOES_PEDAGOGO, MOTIVO_MAX, PESSOAS_POR_PEDIDO, ROTULO_STATUS, type StatusSolicitacaoPedagogo } from "@/lib/solicitacoes-pedagogo-comum";
import { Check, GraduationCap, Loader2, Search, UserCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Candidato = { id: string; name: string; mercurioId: string | null };
type Escolhido = Candidato & { formacao: string };
type Resultado = { ok: true } | { ok: false; error: string };

const CAMPO =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[14px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

const COR_STATUS: Record<StatusSolicitacaoPedagogo, string> = {
  pendente: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  autorizada: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  incluida: "bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300",
  recusada: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  cancelada: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const semAcento = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function useAcao() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (acao: () => Promise<Resultado>, depois?: () => void) =>
    iniciar(async () => {
      setErro(null);
      const r = await acao();
      if (!r.ok) return setErro(r.error);
      depois?.();
      router.refresh();
    });
  return { erro, pendente, rodar };
}

const Erro = ({ texto }: { texto: string | null }) => (texto ? <p className="text-[13px] text-na-danger-dark dark:text-red-400">{texto}</p> : null);

/** Formulário do Chefe/Sub-Chefe: uma ou mais pessoas, a formação de cada uma e um motivo para o pedido. */
function NovoPedido({ schoolId, candidatos }: { schoolId: string; candidatos: Candidato[] }) {
  const [busca, setBusca] = useState("");
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [motivo, setMotivo] = useState("");
  const [enviado, setEnviado] = useState<number | null>(null);
  const { erro, pendente, rodar } = useAcao();

  const achados = useMemo(() => {
    const q = semAcento(busca.trim());
    if (q.length < 2) return [];
    const ja = new Set(escolhidos.map((e) => e.id));
    return candidatos.filter((c) => !ja.has(c.id) && (semAcento(c.name).includes(q) || c.mercurioId === q)).slice(0, 8);
  }, [busca, candidatos, escolhidos]);

  const cheio = escolhidos.length >= PESSOAS_POR_PEDIDO;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const quantos = escolhidos.length;
    rodar(
      () => solicitarPedagogos({ schoolId, pessoas: escolhidos.map((p) => ({ memberId: p.id, formacao: p.formacao })), motivo }),
      () => {
        setEnviado(quantos);
        setEscolhidos([]);
        setMotivo("");
        setBusca("");
      },
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
          <GraduationCap size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Pedir inclusão de pedagogos</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">O responsável nacional autoriza. O pedido fica registrado com o seu nome.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
          Pessoas {escolhidos.length > 0 && <span className="font-normal text-gray-500 dark:text-gray-400">· {escolhidos.length}</span>}
        </span>
        {escolhidos.length > 0 && (
          <ul className="flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            {escolhidos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 last:border-0 dark:border-gray-800">
                <span className="min-w-0 text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                  {p.name} <span className="font-normal text-gray-500 tabular-nums dark:text-gray-400">· {p.mercurioId}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {FORMACOES_PEDAGOGO.map(([valor, rotulo]) => (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={p.formacao === valor}
                      onClick={() => setEscolhidos((l) => l.map((x) => (x.id === p.id ? { ...x, formacao: valor } : x)))}
                      className={`flex min-h-9 items-center rounded-full border px-3 text-[12px] font-semibold transition ${
                        p.formacao === valor ? "border-na-green bg-na-green text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEscolhidos((l) => l.filter((x) => x.id !== p.id))}
                    aria-label={`Tirar ${p.name} do pedido`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  >
                    <X size={15} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {!cheio && (
          <label className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={escolhidos.length ? "Acrescentar outra pessoa" : "Nome ou matrícula"}
              aria-label="Buscar pessoa pelo nome ou matrícula"
              className={`${CAMPO} pl-9`}
            />
          </label>
        )}
        {busca.trim().length >= 2 && !cheio && (
          <ul className="flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            {achados.length === 0 ? (
              <li className="px-3 py-2.5 text-[13px] text-gray-500 dark:text-gray-400">Ninguém encontrado entre os membros ativos que ainda não são pedagogos nem têm pedido aberto.</li>
            ) : (
              achados.map((c) => (
                <li key={c.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setEscolhidos((l) => [...l, { ...c, formacao: FORMACOES_PEDAGOGO[0][0] }]);
                      setBusca("");
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
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Motivo</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          maxLength={MOTIVO_MAX}
          placeholder="Ex.: concluíram o N1, estão na turma de pedagogos desde agosto e vão acompanhar a próxima abertura."
          className={CAMPO}
        />
      </label>

      <Erro texto={erro} />
      {enviado !== null && !erro && (
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-na-green-dark dark:text-emerald-300">
          <Check size={15} /> Pedido {enviado === 1 ? "de 1 pessoa enviado" : `de ${enviado} pessoas enviado`} ao responsável nacional.
        </p>
      )}
      <button type="submit" disabled={pendente || escolhidos.length === 0} className={`${BOTAO_PRINCIPAL} self-start`}>
        {pendente && <Loader2 size={15} className="animate-spin" />} {escolhidos.length > 1 ? `Enviar pedido (${escolhidos.length} pessoas)` : "Enviar pedido"}
      </button>
    </form>
  );
}

/** Uma pessoa do pedido: situação e, para quem decide ou pediu, os botões. */
function LinhaPessoa({ item, decide, podeCancelar }: { item: ItemDoPedido; decide: boolean; podeCancelar: boolean }) {
  const [recusando, setRecusando] = useState(false);
  const [obs, setObs] = useState("");
  const { erro, pendente, rodar } = useAcao();

  return (
    <li className="flex flex-col gap-2 border-b border-gray-100 py-3 first:pt-0 last:border-0 last:pb-0 dark:border-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{item.pessoa.nome}</p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            matr. {item.pessoa.matricula ?? "—"} · {item.formacao}
            {item.atendidaEm && item.status !== "pendente" && (
              <>
                {" · "}
                {data(item.atendidaEm)}
                {item.atendidaPor ? `, ${item.atendidaPor}` : item.status === "incluida" ? ", pela importação do Mercúrio" : ""}
              </>
            )}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${COR_STATUS[item.status]}`}>{ROTULO_STATUS[item.status]}</span>
      </div>
      {item.observacao && <p className="rounded-xl bg-gray-50 px-3 py-2 text-[13px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">{item.observacao}</p>}

      {recusando ? (
        <div className="flex flex-col gap-2">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Por que não foi autorizado? A filial vai ler." className={CAMPO} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pendente} onClick={() => rodar(() => decidirPedagogos([item.id], "recusada", obs))} className={BOTAO_CONTORNO}>
              {pendente && <Loader2 size={15} className="animate-spin" />} Confirmar
            </button>
            <button type="button" onClick={() => setRecusando(false)} className={BOTAO_PEQUENO}>
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 empty:hidden">
          {decide && item.status === "pendente" && (
            <>
              <button type="button" disabled={pendente} onClick={() => rodar(() => decidirPedagogos([item.id], "autorizada"))} className={BOTAO_PEQUENO}>
                <Check size={13} /> Autorizar
              </button>
              <button type="button" onClick={() => setRecusando(true)} className={BOTAO_PEQUENO}>
                Não autorizar
              </button>
            </>
          )}
          {decide && item.status === "autorizada" && (
            <button type="button" disabled={pendente} onClick={() => rodar(() => decidirPedagogos([item.id], "incluida"))} className={BOTAO_PEQUENO}>
              <Check size={13} /> Já incluído no Mercúrio
            </button>
          )}
          {podeCancelar && item.status === "pendente" && (
            <button type="button" disabled={pendente} onClick={() => rodar(() => cancelarSolicitacaoPedagogo(item.id))} className={BOTAO_PEQUENO}>
              <X size={13} /> Tirar do pedido
            </button>
          )}
        </div>
      )}
      <Erro texto={erro} />
    </li>
  );
}

function CartaoPedido({ p, decide, podeCancelar, mostrarFilial }: { p: PedidoParaVer; decide: boolean; podeCancelar: boolean; mostrarFilial: boolean }) {
  const { erro, pendente, rodar } = useAcao();
  const aguardando = p.itens.filter((i) => i.status === "pendente");
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
          {mostrarFilial && `${p.filial} · `}
          {p.itens.length === 1 ? "1 pessoa" : `${p.itens.length} pessoas`}
        </p>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          Pedido por <span className="font-semibold text-gray-700 dark:text-gray-300">{p.solicitadoPor.nome}</span>
          {p.solicitadoPor.matricula && ` (matr. ${p.solicitadoPor.matricula})`} em {data(p.criadoEm)}
        </p>
      </div>
      <p className="text-[14px] whitespace-pre-line text-gray-700 dark:text-gray-300">{p.motivo}</p>
      <ul className="flex flex-col rounded-xl border border-gray-100 px-3 py-3 dark:border-gray-800">
        {p.itens.map((i) => (
          <LinhaPessoa key={i.id} item={i} decide={decide} podeCancelar={podeCancelar} />
        ))}
      </ul>
      {decide && aguardando.length > 1 && (
        <button type="button" disabled={pendente} onClick={() => rodar(() => decidirPedagogos(aguardando.map((i) => i.id), "autorizada"))} className={`${BOTAO_PRINCIPAL} self-start`}>
          {pendente ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Autorizar todos ({aguardando.length})
        </button>
      )}
      <Erro texto={erro} />
    </li>
  );
}

type PessoaEquipe = { matricula: string; nome: string; filial: string };

/** Só o responsável nacional vê: a quem ele delega a decisão dos pedidos. */
function Delegacao({ indicados }: { indicados: PessoaEquipe[] }) {
  const [matricula, setMatricula] = useState("");
  const { erro, pendente, rodar } = useAcao();
  return (
    <CartaoSecao icone={UserCheck} titulo="Delegar" descricao="Quem também pode autorizar os pedidos e marcar a inclusão no Mercúrio. Só você vê esta parte.">
      {indicados.length === 0 ? (
        <p className="text-[13px] text-gray-500 dark:text-gray-400">Ninguém delegado. Só você decide os pedidos.</p>
      ) : (
        <ul className="flex flex-col">
          {indicados.map((p) => (
            <li key={p.matricula} className="flex min-h-11 items-center justify-between gap-3 border-b border-gray-100 py-1.5 last:border-0 dark:border-gray-800">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">{p.nome}</span>
                <span className="block text-[12px] text-gray-500 dark:text-gray-400">
                  matr. {p.matricula}
                  {p.filial && ` · ${p.filial}`}
                </span>
              </span>
              <button type="button" disabled={pendente} onClick={() => rodar(() => alterarIndicadoPedagogos(p.matricula, false))} className={BOTAO_PEQUENO}>
                Retirar
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          rodar(() => alterarIndicadoPedagogos(matricula, true), () => setMatricula(""));
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input value={matricula} onChange={(e) => setMatricula(e.target.value)} inputMode="numeric" placeholder="Matrícula" aria-label="Matrícula de quem vai ajudar a decidir" className={`${CAMPO} max-w-48`} />
        <button type="submit" disabled={pendente || !matricula.trim()} className={BOTAO_CONTORNO}>
          {pendente && <Loader2 size={15} className="animate-spin" />} Delegar
        </button>
      </form>
      <Erro texto={erro} />
    </CartaoSecao>
  );
}

export function NovosPedagogos({
  schoolId,
  podePedir,
  decide,
  candidatos,
  pedidos,
  escolasQuePede,
  variasFiliais,
  indicados,
  gereIndicados,
}: {
  schoolId: string;
  podePedir: boolean;
  decide: boolean;
  candidatos: Candidato[];
  pedidos: PedidoParaVer[];
  escolasQuePede: string[];
  variasFiliais: boolean;
  indicados: PessoaEquipe[];
  gereIndicados: boolean;
}) {
  const abertos = pedidos.filter((p) => p.aberto);
  const historico = pedidos.filter((p) => !p.aberto);
  const aguardando = abertos.reduce((n, p) => n + p.itens.filter((i) => i.status === "pendente").length, 0);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {podePedir && <NovoPedido key={schoolId} schoolId={schoolId} candidatos={candidatos} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Em andamento {aguardando > 0 && <span className="text-gray-900 dark:text-gray-100">· {aguardando} aguardando autorização</span>}
        </h2>
        {abertos.length === 0 ? (
          <p className="text-[14px] text-gray-500 dark:text-gray-400">Nenhum pedido em andamento.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {abertos.map((p) => (
              <CartaoPedido key={p.chave} p={p} decide={decide} podeCancelar={escolasQuePede.includes(p.schoolId)} mostrarFilial={variasFiliais} />
            ))}
          </ul>
        )}
      </section>

      {historico.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">Histórico</h2>
          <ul className="flex flex-col gap-3">
            {historico.map((p) => (
              <CartaoPedido key={p.chave} p={p} decide={false} podeCancelar={false} mostrarFilial={variasFiliais} />
            ))}
          </ul>
        </section>
      )}

      {gereIndicados && <Delegacao indicados={indicados} />}
    </div>
  );
}
