import { RepasseCartao } from "@/components/economia/repasse-cartao";
import { asaasGetCreditCardFeeStatus } from "@/lib/asaas/client";
import { pixAutomaticoLiberado } from "@/lib/asaas/conta-escola";
import { db } from "@/lib/db";
import { cartaoRepassaTaxa, configCobranca, contarEscopo, spreadDoMes } from "@/lib/spread";
import { FAIXAS_SPREAD, FIXO_MENSAL, faixaDoSpread, pct } from "@/lib/spread-comum";
import { CircleCheck, CircleX } from "lucide-react";

/**
 * Economia → Cobrança on-line (12/11/2026): taxa do cartão (repassar ou absorver), faixa do spread e situação da conta
 * Asaas da filial. A Economia vê a própria filial; o dono do sistema escolhe qualquer uma (página /economia?aba=cobranca).
 */
const EXEMPLO = 120;
const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (aaaamm: string) => `${MES[Number(aaaamm.slice(5, 7)) - 1]} de ${aaaamm.slice(0, 4)}`;
const num = (n: number) => n.toLocaleString("pt-BR");

export async function CobrancaOnline({ schoolId, dono }: { schoolId: string; dono: boolean }) {
  const escola = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, mercurioUnidade: true, asaasSubaccountApiKey: true } });
  const config = await configCobranca();
  const [repassa, vigente, previa] = await Promise.all([
    cartaoRepassaTaxa(schoolId),
    spreadDoMes().catch(() => null),
    contarEscopo(config.escopo).catch(() => null),
  ]);
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
          mês seguinte. O fixo nacional de R$ {num(FIXO_MENSAL)} por mês diminui na mesma medida do spread recebido.
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
