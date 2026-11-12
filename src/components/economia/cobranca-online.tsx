import { ContatoAtendido } from "@/components/economia/contato-atendido";
import { LancadoAMao } from "@/components/economia/lancado-a-mao";
import { pedidosDeContato } from "@/lib/whatsapp/conversa";
import { RepasseCartao } from "@/components/economia/repasse-cartao";
import { SaqueEscola } from "@/components/economia/saque-escola";
import { conferirSaques, saldoDaConta, type Saque } from "@/lib/asaas/saque";
import { asaasGetCreditCardFeeStatus } from "@/lib/asaas/client";
import { pixAutomaticoLiberado } from "@/lib/asaas/conta-escola";
import { db } from "@/lib/db";
import { GUIA_MENSAGENS, type Problema, problemasDePagamento } from "@/lib/problemas-pagamento";
import { cartaoRepassaTaxa, chavePixDaEscola, configCobranca, contarEscopo, demonstrativoDoMes, spreadDoMes } from "@/lib/spread";
import { FAIXAS_SPREAD, FIXO_MENSAL, faixaDoSpread, pct } from "@/lib/spread-comum";
import { CircleCheck, CircleX, Wrench } from "lucide-react";

/**
 * Economia → Cobrança on-line (12/11/2026): taxa do cartão (repassar ou absorver), faixa do spread e situação da conta
 * Asaas da filial, e os problemas de pagamento que a Economia resolve (os de sistema ficam com o dono). A Economia vê a própria filial; o dono do sistema escolhe qualquer uma (página /economia?aba=cobranca).
 */
const EXEMPLO = 120;
const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (aaaamm: string) => `${MES[Number(aaaamm.slice(5, 7)) - 1]} de ${aaaamm.slice(0, 4)}`;
const num = (n: number) => n.toLocaleString("pt-BR");
const STATUS_SAQUE: Record<Saque["status"], string> = { solicitado: "Pedido", aprovado: "Aprovado", enviado: "Em andamento", concluido: "Concluído", falhou: "Não realizado", cancelado: "Cancelado" };

export async function CobrancaOnline({ schoolId, dono }: { schoolId: string; dono: boolean }) {
  const escola = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, mercurioUnidade: true, asaasSubaccountApiKey: true } });
  const config = await configCobranca();
  const chaveApi = escola.asaasSubaccountApiKey;
  const [repassa, vigente, previa, problemas, saldo, saques, chavePix, contatos] = await Promise.all([
    cartaoRepassaTaxa(schoolId),
    spreadDoMes().catch(() => null),
    contarEscopo(config.escopo).catch(() => null),
    problemasDePagamento(schoolId),
    chaveApi ? saldoDaConta(chaveApi).catch(() => null) : Promise.resolve(null),
    chaveApi ? conferirSaques(schoolId, chaveApi).catch(() => [] as Saque[]) : Promise.resolve([] as Saque[]),
    chavePixDaEscola(schoolId),
    pedidosDeContato(schoolId).catch(() => []),
  ]);
  const sistemaQtd = problemas.sistema.reduce((n, p) => n + p.pessoas.length, 0) + (escola.asaasSubaccountApiKey ? 0 : 1);
  const naEscala = !!escola.mercurioUnidade && config.escopo.includes(escola.mercurioUnidade);

  let exemplo: { base: number; comTaxa: number; taxa: number } | null = null;
  if (escola.asaasSubaccountApiKey) {
    const fee = await asaasGetCreditCardFeeStatus({ apiKey: escola.asaasSubaccountApiKey }).catch(() => null);
    if (fee) {
      const comTaxa = Math.round(((EXEMPLO + fee.fixo) / (1 - fee.percentual / 100)) * 100) / 100;
      exemplo = { base: EXEMPLO, comTaxa, taxa: Math.round((EXEMPLO * fee.percentual) / 100 + fee.fixo) };
    }
  }
  const proxima = previa ? faixaDoSpread(previa.total) : null;
  const card = "grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900";
  const h2 = "text-base font-black text-gray-900 dark:text-gray-100";

  return (
    <div className="grid max-w-3xl gap-4">
      <section className={card} aria-labelledby="problemas-h">
        <h2 id="problemas-h" className={h2}>Problemas no pagamento</h2>
        {contatos.length > 0 && (
          <details open className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/30">
            <summary className="cursor-pointer text-sm font-bold text-gray-900 dark:text-gray-100">
              Pediram para falar com a Economia pelo WhatsApp <span className="tabular-nums text-amber-800 dark:text-amber-300">({contatos.length})</span>
            </summary>
            <p className="mt-1 text-[13px] text-gray-700 dark:text-gray-300">Ligue ou mande mensagem do telefone da secretaria. Depois, marque como atendido.</p>
            <ul className="mt-2 grid gap-1.5">
              {contatos.map((c) => (
                <li key={c.memberId} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-amber-200/70 pt-1.5 text-[13px] dark:border-amber-900/60">
                  <span className="min-w-0">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{c.nome}</span>
                    {c.matricula && <span className="text-gray-500"> · matrícula {c.matricula}</span>}
                    <span className="block text-gray-600 dark:text-gray-400">
                      WhatsApp +{c.telefone} · pedido em {new Date(c.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  <ContatoAtendido schoolId={schoolId} memberId={c.memberId} />
                </li>
              ))}
            </ul>
          </details>
        )}
        {problemas.voluntario.length === 0 && contatos.length === 0 ? (
          <p className="flex gap-2 text-[13px] text-gray-600 dark:text-gray-400">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Nenhum problema que dependa da Economia agora.
          </p>
        ) : (
          problemas.voluntario.map((p) => <ListaProblema key={p.id} p={p} />)
        )}
        {sistemaQtd > 0 && (
          <div className="grid gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
            <p className="flex gap-2">
              <Wrench className="mt-0.5 size-4 shrink-0 text-gray-500" aria-hidden />
              {dono
                ? "De sistema (com você):"
                : `${sistemaQtd} ${sistemaQtd === 1 ? "problema é" : "problemas são"} de sistema e já ${sistemaQtd === 1 ? "está" : "estão"} com o administrador do Portal. A Economia não precisa fazer nada.`}
            </p>
            {dono && !escola.asaasSubaccountApiKey && <p>Conta Asaas da filial não ligada: o pagamento on-line está fechado.</p>}
            {dono && problemas.sistema.map((p) => <ListaProblema key={p.id} p={p} />)}
          </div>
        )}
        <details className="text-[13px]">
          <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-200">Mensagens que o aluno pode ver ao pagar, e quem resolve</summary>
          <ul className="mt-2 grid gap-2">
            {GUIA_MENSAGENS.map((g) => (
              <li key={g.mensagem} className="grid gap-0.5 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                <span className="font-semibold text-gray-900 dark:text-gray-100">“{g.mensagem}”</span>
                <span className="text-gray-600 dark:text-gray-400">
                  <b className={g.quem === "voluntario" ? "text-na-green-dark dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"}>
                    {g.quem === "voluntario" ? "Economia resolve: " : "Sistema: "}
                  </b>
                  {g.oQueFazer}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      {chaveApi && (
        <section className={card} aria-labelledby="saque-h">
          <h2 id="saque-h" className={h2}>Saldo e saque</h2>
          <p className="text-[13px] text-gray-600 dark:text-gray-400">
            O dinheiro das contribuições pagas pelo Portal fica na conta Asaas da escola. Daqui a Economia transfere o saldo para a conta bancária da escola,
            pela chave Pix cadastrada.
          </p>
          <SaqueEscola schoolId={schoolId} saldo={saldo} chave={chavePix} dono={dono} />
          {saques.length > 0 && (
            <ul className="grid gap-1 text-[13px]">
              {saques.slice(-8).reverse().map((q) => (
                <li key={q.id} className="flex flex-wrap justify-between gap-x-3 border-t border-gray-100 pt-1 dark:border-gray-800">
                  <span className="tabular-nums">
                    {new Date(q.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} ·{" "}
                    <b>{q.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b> · {q.pedidoPor.replace(/\s*\(.*\)$/, "")}
                  </span>
                  <span className={q.status === "concluido" ? "text-emerald-700 dark:text-emerald-400" : q.status === "falhou" || q.status === "cancelado" ? "text-red-700 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}>
                    {STATUS_SAQUE[q.status]}
                    {q.erro && ` — ${q.erro}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={card} aria-labelledby="cartao-h">
        <h2 id="cartao-h" className={h2}>Taxa do cartão de crédito</h2>
        <p className="text-[13px] text-gray-600 dark:text-gray-400">
          Vale para os pagamentos de contribuição no cartão pelo Portal. No Pix, a taxa sai sempre da parte da escola.
          {exemplo && ` Exemplo com uma contribuição de R$ ${EXEMPLO}:`}
        </p>
        <RepasseCartao schoolId={schoolId} repassa={repassa} exemplo={exemplo} />
      </section>

      <section className={card} aria-labelledby="spread-h">
        <h2 id="spread-h" className={h2}>Spread do Portal</h2>
        <p className="text-[13px] text-gray-600 dark:text-gray-400">
          Remuneração do Portal, descontada só do que passa por ele, na divisão automática do pagamento (o dinheiro da escola não passa pela conta da
          prestadora). A taxa é uma só para todas as escolas e depende do total de membros ativos das escolas participantes: a faixa atingida num mês vale no
          mês seguinte. A escola paga só o spread: o fixo nacional de R$ {num(FIXO_MENSAL)} por mês é da Secretaria Nacional de Economia, que paga apenas o que faltar depois do spread do mês.
        </p>
        {!naEscala && <p className="rounded-lg bg-gray-100 px-3 py-2 text-[13px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">Esta filial ainda não está entre as escolas participantes.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-na-green-light/60 px-4 py-3 dark:bg-emerald-950/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Em vigor{vigente ? ` em ${nomeMes(vigente.mes)}` : ""}</p>
            <p className="text-3xl font-black tabular-nums text-na-green-dark dark:text-emerald-400">{vigente ? pct(vigente.percentual) : "—"}</p>
            {vigente && <p className="text-[12.5px] text-gray-600 dark:text-gray-400">{num(vigente.total)} membros contados no início do mês</p>}
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Prévia do mês seguinte</p>
            <p className="text-3xl font-black tabular-nums text-gray-900 dark:text-gray-100">{proxima ? pct(proxima.percentual) : "—"}</p>
            {previa && <p className="text-[12.5px] text-gray-600 dark:text-gray-400">{num(previa.total)} membros ativos hoje</p>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Faixas do spread</caption>
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wider text-gray-500 dark:border-gray-800">
                <th className="py-1.5 pr-3 font-semibold">Membros ativos nas escolas participantes</th>
                <th className="py-1.5 font-semibold">Spread</th>
              </tr>
            </thead>
            <tbody>
              {FAIXAS_SPREAD.map((f) => {
                const atual = vigente && faixaDoSpread(vigente.total) === f;
                return (
                  <tr key={f.de} className={`border-b border-gray-100 last:border-0 dark:border-gray-800 ${atual ? "font-bold text-na-green-dark dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"}`}>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {f.ate === Infinity ? `Acima de ${num(f.de - 1)}` : f.de === 1 ? `Até ${num(f.ate)}` : `De ${num(f.de)} a ${num(f.ate)}`}
                      {atual && " · em vigor"}
                    </td>
                    <td className="py-1.5 tabular-nums">{pct(f.percentual)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {dono && previa && (
          <details className="text-[13px] text-gray-600 dark:text-gray-400">
            <summary className="cursor-pointer font-semibold text-gray-800 dark:text-gray-200">Escolas participantes e ativos (só você vê)</summary>
            <ul className="mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {Object.entries(previa.porUnidade)
                .sort((x, y) => y[1] - x[1])
                .map(([u, n]) => (
                  <li key={u} className="flex justify-between tabular-nums">
                    <span>{u}</span>
                    <span>{num(n)}</span>
                  </li>
                ))}
            </ul>
            <p className="mt-2">Contagem: {previa.fonte === "mercurio" ? "ativos no Mercúrio, na hora" : "ativos importados no Portal (o Mercúrio não respondeu)"}.</p>
          </details>
        )}
      </section>

      {dono && <Demonstrativo />}

      <section className={card} aria-labelledby="conta-h">
        <h2 id="conta-h" className={h2}>Conta Asaas da filial</h2>
        <ul className="grid gap-1.5 text-[13px]">
          <Item ok={!!escola.asaasSubaccountApiKey} sim="Conta ligada ao Portal: as cobranças saem no nome da escola." nao="Conta ainda não ligada: o pagamento on-line desta filial não está liberado." />
          <Item ok={pixAutomaticoLiberado(escola.mercurioUnidade)} sim="Débito automático por Pix liberado." nao="Débito automático por Pix ainda não liberado." />
        </ul>
      </section>
    </div>
  );
}

function Item({ ok, sim, nao }: { ok: boolean; sim: string; nao: string }) {
  const Icone = ok ? CircleCheck : CircleX;
  return (
    <li className="flex gap-2">
      <Icone className={`mt-0.5 size-4 shrink-0 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`} aria-hidden />
      <span className="text-gray-700 dark:text-gray-300">{ok ? sim : nao}</span>
    </li>
  );
}

function ListaProblema({ p }: { p: Problema }) {
  return (
    <details className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/30" open={p.pessoas.length <= 5}>
      <summary className="cursor-pointer text-sm font-bold text-gray-900 dark:text-gray-100">
        {p.titulo} <span className="font-semibold tabular-nums text-amber-800 dark:text-amber-300">({p.pessoas.length})</span>
      </summary>
      <p className="mt-1 text-[13px] text-gray-700 dark:text-gray-300">{p.oQueFazer}</p>
      <ul className="mt-2 grid gap-1.5">
        {p.pessoas.map((x, i) => (
          <li key={x.tarefaId ?? `${x.matricula}-${i}`} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-amber-200/70 pt-1.5 text-[13px] dark:border-amber-900/60">
            <span className="min-w-0">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{x.nome}</span>
              {x.matricula && <span className="text-gray-500"> · matrícula {x.matricula}</span>}
              <span className="block text-gray-600 dark:text-gray-400">{x.detalhe}</span>
            </span>
            {x.tarefaId && p.id === "lancamento" && <LancadoAMao tarefaId={x.tarefaId} />}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Só o dono do sistema: spread do mês por escola e quanto a Secretaria Nacional de Economia completa. */
async function Demonstrativo() {
  const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const meses = [
    { ano: agora.getFullYear(), mes: agora.getMonth() + 1 },
    agora.getMonth() === 0 ? { ano: agora.getFullYear() - 1, mes: 12 } : { ano: agora.getFullYear(), mes: agora.getMonth() },
  ];
  const dados = await Promise.all(meses.map((m) => demonstrativoDoMes(m.ano, m.mes).then((d) => ({ ...m, ...d })).catch(() => null)));
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900" aria-labelledby="demo-h">
      <h2 id="demo-h" className="text-base font-black text-gray-900 dark:text-gray-100">Demonstrativo do spread (só você vê)</h2>
      <p className="text-[13px] text-gray-600 dark:text-gray-400">
        Contribuições pagas pelo Portal nas escolas participantes. A Secretaria Nacional de Economia completa o que faltar para R$ {num(FIXO_MENSAL)}. Ainda não
        inclui inscrições em eventos nem matrículas.
      </p>
      {dados.map((d) =>
        !d ? null : (
          <div key={`${d.ano}-${d.mes}`} className="grid gap-1.5">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {MES[d.mes - 1]} de {d.ano} · taxa {pct(d.percentual)}
              {d.estimado && <span className="font-normal text-gray-500"> (faixa estimada pela contagem de hoje)</span>}
            </p>
            {d.linhas.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wider text-gray-500 dark:border-gray-800">
                      <th className="py-1 pr-3 font-semibold">Escola</th>
                      <th className="py-1 pr-3 text-right font-semibold">Pagamentos</th>
                      <th className="py-1 pr-3 text-right font-semibold">Volume</th>
                      <th className="py-1 text-right font-semibold">Spread</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.linhas.map((l) => (
                      <tr key={l.unidade} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-1 pr-3">{l.escola}</td>
                        <td className="py-1 pr-3 text-right tabular-nums">{l.pagamentos}</td>
                        <td className="py-1 pr-3 text-right tabular-nums">{brl(l.volume)}</td>
                        <td className="py-1 text-right tabular-nums">{brl(l.spread)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-gray-500">Nenhuma contribuição paga pelo Portal neste mês.</p>
            )}
            <p className="text-[13px] tabular-nums text-gray-700 dark:text-gray-300">
              Spread das escolas: <b>{brl(d.spread)}</b> · Secretaria Nacional paga: <b>{brl(d.sne)}</b> · total: {brl(d.spread + d.sne)}
            </p>
          </div>
        ),
      )}
    </section>
  );
}
