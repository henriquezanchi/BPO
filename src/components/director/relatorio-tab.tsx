"use client";

import { getRelatorioFilial, type RelatorioFilial } from "@/lib/actions/relatorio-filial-actions";
import { formatBRL } from "@/lib/format";
import { DIA_LIMITE_DESCONTO } from "@/lib/situacao-contribuicao";
import { AlertTriangle, Cake, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
// Validado com o validador de paleta (claro e escuro): entradas × saídas.
const COR_ENTRADA = "bg-[#009485] dark:bg-[#16a090]";
const COR_SAIDA = "bg-[#9a6b00] dark:bg-[#b8862a]";

function Kpi({ rotulo, valor, detalhe }: { rotulo: string; valor: string | number; detalhe?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{rotulo}</span>
      <span className="text-2xl font-black text-gray-900 tabular-nums dark:text-gray-100">{valor}</span>
      {detalhe && <span className="text-[11px] text-gray-500 dark:text-gray-400">{detalhe}</span>}
    </div>
  );
}

function Cartao({ titulo, children, aviso }: { titulo: string; children: React.ReactNode; aviso?: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{titulo}</h3>
      {children}
      {aviso && <p className="text-[11px] text-gray-500 dark:text-gray-400">{aviso}</p>}
    </section>
  );
}

/**
 * Relatório da filial (pedido do usuário 2026-10-19): visão rápida do
 * maior gestor — pessoas, movimento, aniversariantes, contribuição, turmas,
 * avaliação dos instrutores, pendências e próximos eventos.
 */
export function RelatorioTab({ schoolId }: { schoolId: string }) {
  const [rel, setRel] = useState<RelatorioFilial | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    getRelatorioFilial(schoolId)
      .then(setRel)
      .catch(() => setErro("Não foi possível carregar o relatório."));
  }, [schoolId]);

  if (erro) return <p className="text-sm text-na-danger-dark dark:text-red-300">{erro}</p>;
  if (!rel)
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 size={14} className="animate-spin" /> Carregando relatório…
      </p>
    );
  if (!rel.resumo)
    return <p className="text-sm text-gray-500 dark:text-gray-400">O relatório é gerado na sincronização diária com o Mercúrio (3h30). Volte amanhã.</p>;

  const d = rel.resumo.dados;
  const agora = rel.agora;
  const hojeDia = Number(new Date(agora).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(8, 10));
  const mesAtual = d.movimento.meses.at(-1)!;
  const maxMov = Math.max(1, ...d.movimento.meses.flatMap((m) => [m.entradas, m.saidas]));
  const c = d.contribuicao.mesAtual;
  // Regra do desconto (situacao-contribuicao.ts): até o dia 10 o mês está "a vencer"; depois, quem não pagou perdeu o desconto (amarelo).
  const passouDoDia10 = hojeDia > DIA_LIMITE_DESCONTO;
  const totalFichas = c.paga + c.emBranco + c.atrasada + c.isenta || 1;
  const adesao = d.pessoas.ativos ? Math.round((rel.portal.comLogin / d.pessoas.ativos) * 100) : 0;
  const [recAnt, recAtual] = d.receita;
  const formaturasProximas = d.turmas.lista.filter((t) => t.previsaoFormatura && new Date(t.previsaoFormatura).getTime() - agora < 90 * 864e5 && new Date(t.previsaoFormatura).getTime() > agora);
  const semInstrutor = d.turmas.lista.filter((t) => t.instrutores === 0);
  const pendenciasTotal = rel.portal.pedidosCadastro + rel.portal.pendencias + rel.portal.falhasMercurio;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Dados do Mercúrio de {d.atualizacaoMercurio ? new Date(d.atualizacaoMercurio.replace(" ", "T") + "-03:00").toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"} · somente pessoas ativas.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Ativos" valor={d.pessoas.ativos} detalhe={`${d.pessoas.membros} membros (2º nível+)`} />
        <Kpi rotulo="Saldo do mês" valor={`${mesAtual.entradas - mesAtual.saidas >= 0 ? "+" : ""}${mesAtual.entradas - mesAtual.saidas}`} detalhe={`${mesAtual.entradas} entradas · ${mesAtual.saidas} saídas`} />
        <Kpi rotulo="Com atraso no ano" valor={d.contribuicao.pessoasComAtraso} detalhe={`${d.contribuicao.mesesEmAtraso} meses em atraso somados`} />
        <Kpi rotulo="Recebido no mês" valor={formatBRL(recAtual?.valor ?? 0)} detalhe={recAnt ? `mês anterior: ${formatBRL(recAnt.valor)}` : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Cartao titulo="Pessoas por nível">
          <ul className="flex flex-col gap-1.5">
            {d.pessoas.porNivel.map((p) => (
              <li key={p.nivel} className="flex items-center gap-3 text-[12px] text-gray-700 dark:text-gray-300">
                <span className="w-44 shrink-0">{p.rotulo}</span>
                <span className="h-2.5 rounded-r bg-[#009485] dark:bg-[#16a090]" style={{ width: `${(p.total / Math.max(1, d.pessoas.ativos)) * 100}%`, minWidth: 3 }} />
                <span className="tabular-nums">{p.total}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-4 gap-2 border-t border-gray-100 pt-3 text-center dark:border-gray-800">
            {[
              ["FV (BRG)", d.pessoas.fv],
              ["Provacionistas", d.pessoas.provacionistas],
              ["HD", d.pessoas.hd],
              ["Dirigentes", d.pessoas.dirigentes],
            ].map(([r, v]) => (
              <div key={r as string}>
                <p className="text-lg font-black text-gray-900 tabular-nums dark:text-gray-100">{v}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{r}</p>
              </div>
            ))}
          </div>
        </Cartao>

        <Cartao titulo="Entradas e saídas — últimos 12 meses">
          <div className="flex items-center gap-4 text-[11px] text-gray-600 dark:text-gray-300">
            <span className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${COR_ENTRADA}`} /> Entradas
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${COR_SAIDA}`} /> Saídas
            </span>
          </div>
          <div className="flex h-32 items-end gap-1.5 border-b border-gray-200 dark:border-gray-700" role="img" aria-label="Entradas e saídas por mês">
            {d.movimento.meses.map((m) => (
              <div key={m.mes} className="group relative flex h-full flex-1 items-end justify-center gap-[2px]">
                <div className={`w-1/2 max-w-3 rounded-t ${COR_ENTRADA}`} style={{ height: `${(m.entradas / maxMov) * 100}%`, minHeight: m.entradas ? 2 : 0 }} />
                <div className={`w-1/2 max-w-3 rounded-t ${COR_SAIDA}`} style={{ height: `${(m.saidas / maxMov) * 100}%`, minHeight: m.saidas ? 2 : 0 }} />
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max rounded-lg bg-gray-900 px-2 py-1 text-[10px] text-white shadow group-hover:block dark:bg-gray-700">
                  {rotuloMes(m.mes)}: {m.entradas} entradas · {m.saidas} saídas · {m.segundoNivel} no 2º nível
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            {d.movimento.meses.map((m) => (
              <span key={m.mes} className="flex-1 text-center text-[9px] text-gray-500 dark:text-gray-400">
                {rotuloMes(m.mes).slice(0, 3)}
              </span>
            ))}
          </div>
          {d.movimento.motivosSaida.length > 0 && (
            <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">Motivos de saída (últimos 3 meses)</p>
              <ul className="flex flex-col gap-0.5 text-[12px] text-gray-600 dark:text-gray-400">
                {d.movimento.motivosSaida.map((m) => (
                  <li key={m.motivo} className="flex justify-between gap-3">
                    <span className="first-letter:uppercase">{m.motivo}</span>
                    <span className="tabular-nums">{m.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Cartao>

        <Cartao
          titulo={`Contribuição de ${rotuloMes(d.mesReferencia)}`}
          aviso={`Pago até o dia ${DIA_LIMITE_DESCONTO}: em dia, com desconto. Depois do dia ${DIA_LIMITE_DESCONTO} sem pagamento: perdeu o desconto, mas só fica em atraso quando o mês termina.`}
        >
          <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Situação das contribuições do mês">
            {[
              [c.paga, "bg-na-success"],
              [c.emBranco, passouDoDia10 ? "bg-na-warning" : "bg-gray-300 dark:bg-gray-600"],
              [c.isenta, "bg-gray-200 dark:bg-gray-700"],
            ].map(([v, cls], i) => ((v as number) > 0 ? <span key={i} className={cls as string} style={{ width: `${((v as number) / totalFichas) * 100}%` }} /> : null))}
          </div>
          <ul className="grid grid-cols-2 gap-1 text-[12px] text-gray-700 dark:text-gray-300">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-na-success" /> Paga: <strong className="tabular-nums">{c.paga}</strong>
            </li>
            <li className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${passouDoDia10 ? "bg-na-warning" : "bg-gray-300 dark:bg-gray-600"}`} />
              {passouDoDia10 ? "Sem desconto (ainda no prazo)" : `A vencer até dia ${DIA_LIMITE_DESCONTO}`}: <strong className="tabular-nums">{c.emBranco}</strong>
            </li>
            <li className="flex items-center gap-1.5">
              <AlertTriangle size={11} className="text-na-danger" /> Em atraso (meses encerrados): <strong className="tabular-nums">{d.contribuicao.pessoasComAtraso}</strong>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-gray-200 dark:bg-gray-700" /> Isenta: <strong className="tabular-nums">{c.isenta}</strong>
            </li>
          </ul>
        </Cartao>

        <Cartao titulo={`Aniversariantes de ${MESES[Number(d.mesReferencia.slice(5, 7)) - 1]} (${d.aniversariantes.length})`}>
          {d.aniversariantes.length === 0 ? (
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Ninguém neste mês.</p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {d.aniversariantes.map((a) => {
                const destaque = a.dia >= hojeDia && a.dia < hojeDia + 7;
                return (
                  <li
                    key={a.matricula}
                    className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-[12px] ${destaque ? "bg-na-gold/15 text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {a.dia === hojeDia && <Cake size={12} className="shrink-0 text-na-gold-dark dark:text-amber-300" />}
                      {a.nome}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">dia {a.dia}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        <Cartao titulo={`Turmas (${d.turmas.total})`}>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="text-[10px] text-gray-500 uppercase dark:text-gray-400">
                <tr>
                  <th className="py-1 pr-2 font-semibold">Turma</th>
                  <th className="py-1 pr-2 font-semibold">Nível</th>
                  <th className="py-1 pr-2 font-semibold">Dia</th>
                  <th className="py-1 pr-2 text-right font-semibold">Alunos</th>
                  <th className="py-1 text-right font-semibold">Instr.</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {d.turmas.lista.map((t) => (
                  <tr key={t.turma} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1 pr-2">{t.turma}</td>
                    <td className="py-1 pr-2">{t.nivel}</td>
                    <td className="py-1 pr-2 capitalize">
                      {t.dia} {t.horario}
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">{t.alunos}</td>
                    <td className={`py-1 text-right tabular-nums ${t.instrutores === 0 ? "font-semibold text-na-danger-dark dark:text-red-300" : ""}`}>{t.instrutores}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(semInstrutor.length > 0 || formaturasProximas.length > 0) && (
            <ul className="flex flex-col gap-1 border-t border-gray-100 pt-2 text-[11px] text-gray-600 dark:border-gray-800 dark:text-gray-400">
              {semInstrutor.length > 0 && <li>Sem instrutor no Mercúrio: {semInstrutor.map((t) => t.turma).join(", ")}</li>}
              {formaturasProximas.length > 0 && (
                <li>
                  Formatura prevista em até 90 dias:{" "}
                  {formaturasProximas.map((t) => `${t.turma} (${new Date(t.previsaoFormatura!).toLocaleDateString("pt-BR", { timeZone: "UTC" })})`).join(", ")}
                </li>
              )}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Portal e pendências">
          <ul className="flex flex-col gap-2 text-[12px] text-gray-700 dark:text-gray-300">
            <li className="flex justify-between gap-3">
              <span>Ativos com acesso ao Portal</span>
              <strong className="tabular-nums">
                {rel.portal.comLogin} ({adesao}%)
              </strong>
            </li>
            <li className="flex justify-between gap-3">
              <span>Pedidos de alteração de cadastro</span>
              <strong className="tabular-nums">{rel.portal.pedidosCadastro}</strong>
            </li>
            <li className="flex justify-between gap-3">
              <span>Pendências da Escolástica</span>
              <strong className="tabular-nums">{rel.portal.pendencias}</strong>
            </li>
            <li className="flex justify-between gap-3">
              <span>Envios ao Mercúrio com falha</span>
              <strong className={`tabular-nums ${rel.portal.falhasMercurio ? "text-na-danger-dark dark:text-red-300" : ""}`}>{rel.portal.falhasMercurio}</strong>
            </li>
          </ul>
          {pendenciasTotal === 0 && <p className="text-[11px] text-gray-500 dark:text-gray-400">Nada pendente.</p>}
        </Cartao>

        <Cartao titulo="Avaliação dos instrutores">
          {!rel.avaliacao ? (
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhuma rodada ainda. Abra em Portal do Voluntário → Avaliação dos instrutores.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-black text-gray-900 tabular-nums dark:text-gray-100">{rel.avaliacao.participantes}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">responderam</p>
              </div>
              <div>
                <p className="text-lg font-black text-gray-900 tabular-nums dark:text-gray-100">{rel.avaliacao.mediaInstrutores?.toFixed(1) ?? "—"}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">nota média dos instrutores</p>
              </div>
              <div>
                <p className="text-lg font-black text-gray-900 tabular-nums dark:text-gray-100">{rel.avaliacao.nps ?? "—"}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">índice de recomendação</p>
              </div>
              <p className="col-span-3 text-[11px] text-gray-500 dark:text-gray-400">
                {rel.avaliacao.titulo} · {rel.avaliacao.status === "aberta" ? "aberta" : "encerrada"} · resultados só com 3+ respostas
              </p>
            </div>
          )}
        </Cartao>

        <Cartao titulo="Próximos eventos (30 dias)">
          {rel.eventos.length === 0 ? (
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhum evento da filial marcado.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-[12px] text-gray-700 dark:text-gray-300">
              {rel.eventos.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {new Date(e.inicio).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })} · {e.titulo}
                    {e.status === "cancelado" ? " (cancelado)" : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {e.inscritos}
                    {e.vagas ? `/${e.vagas}` : ""} inscritos
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Presenças e faltas nas aulas ainda não aparecem: o banco de consulta do Mercúrio não traz a frequência das turmas.
      </p>
    </div>
  );
}
