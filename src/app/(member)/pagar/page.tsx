import { PagamentoGuiado } from "@/components/member/pagamento-guiado";
import { escolaCobraOnline } from "@/lib/asaas/conta-escola";
import { getAuthenticatedMember } from "@/lib/auth";
import { oldestOpenContribution } from "@/lib/contribution-order";
import { db } from "@/lib/db";
import { cartaoRepassaTaxa } from "@/lib/spread";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Pagamento guiado (12/11/2026, cronograma do spread — QR code no pátio da escola). O QR leva a
 * /pagar?filial=SIGLA&origem=patio; quem não está logado entra e volta direto para cá. A tela mostra a contribuição,
 * gera o Pix sozinha e só pede o CPF de quem paga na primeira vez (depois reaproveita o pagador da última cobrança).
 * O aluno só digita a senha do Portal (se precisar) e confirma no app do banco.
 */
export default async function PagarPage(props: { searchParams: Promise<{ filial?: string; origem?: string }> }) {
  const params = await props.searchParams;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?${new URLSearchParams({ next: `/pagar?${new URLSearchParams(params as Record<string, string>)}` })}`);

  const escola = await db.school.findUniqueOrThrow({ where: { id: member.schoolId }, select: { name: true, asaasSubaccountApiKey: true, mercurioEscrita: true } });
  const casca = (children: React.ReactNode) => (
    <main className="mx-auto grid min-h-dvh max-w-md content-start gap-4 px-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-na-green dark:text-emerald-400">{escola.name}</p>
      {children}
    </main>
  );
  if (!member.mercurioAtivo || !escolaCobraOnline(escola) || !escola.mercurioEscrita)
    return casca(
      <div className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-900">
        <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">Pagamento pelo Portal ainda não liberado</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">A sua filial ainda não recebe pagamentos pelo Portal. Por enquanto, fale com a secretaria.</p>
        <Link href="/portal" className="text-sm font-semibold text-na-green underline dark:text-emerald-400">Ir para o Portal</Link>
      </div>,
    );

  const [mensal, cobrancas, itens, ultimaCobranca, repassa] = await Promise.all([
    db.contributionMonthlyStatus.findMany({ where: { memberId: member.id }, select: { year: true, month: true, status: true } }),
    db.paymentCharge.findMany({ where: { memberId: member.id, status: { in: ["pendente", "pago"] } }, select: { referenceYear: true, referenceMonth: true, status: true } }),
    db.contributionCompositionItem.findMany({ where: { memberId: member.id }, select: { label: true, amount: true }, orderBy: { label: "asc" } }),
    db.paymentCharge.findFirst({ where: { memberId: member.id, createdAt: { gte: new Date("2026-10-25T00:00:00-03:00") } }, select: { id: true } }),
    cartaoRepassaTaxa(member.schoolId),
  ]);

  // Mês mais antigo em aberto; sem nenhum, o mês corrente se ainda não estiver pago ou isento.
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const atual = { year: Number(hoje.slice(0, 4)), month: Number(hoje.slice(5, 7)) };
  const resolvido = (y: number, m: number) =>
    mensal.some((x) => x.year === y && x.month === m && (x.status === "paga" || x.status === "isento")) ||
    cobrancas.some((c) => c.referenceYear === y && c.referenceMonth === m && c.status === "pago");
  const alvo = oldestOpenContribution(mensal, cobrancas) ?? (resolvido(atual.year, atual.month) ? null : atual);

  return casca(
    <PagamentoGuiado
      memberId={member.id}
      nome={member.name.split(" ")[0]}
      alvo={alvo}
      itens={itens.map((i) => ({ rotulo: i.label, valor: Number(i.amount) }))}
      temPagadorSalvo={!!ultimaCobranca}
      cartaoComTaxa={repassa}
    />,
  );
}
