import { BotaoImprimir } from "@/components/member/botao-imprimir";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { entregaDoPedido, TIPO_PEDIDO_DECLARACAO } from "@/lib/declaracoes/pedidos";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Declaração entregue pela Escolástica pelo Portal (pedido do usuário 06/11/2026). Só a própria pessoa abre. O texto é o
 * que a secretaria conferiu e entregou (ResumoNacional "declaracao:<id>"); o aluno imprime ou salva em PDF.
 */
export default async function MinhaDeclaracaoPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/portal/declaracao/${id}`);
  const pedido = await db.scholasticPendency.findFirst({ where: { id, memberId: member.id, tipo: TIPO_PEDIDO_DECLARACAO }, select: { id: true } });
  const entrega = pedido ? await entregaDoPedido(pedido.id) : null;
  if (!entrega || entrega.modo !== "portal") notFound();
  const d = entrega.declaracao;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 bg-na-bg p-4 print:bg-white print:p-0 dark:bg-gray-950">
      <style>{`@media print {
        @page { size: A4; margin: 22mm 20mm; }
        #folha-declaracao { border: 0 !important; box-shadow: none !important; padding: 0 !important; }
      }`}</style>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/portal" className="-my-2 flex min-h-11 w-fit items-center gap-1.5 text-[13px] font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <BotaoImprimir />
      </div>
      <article id="folha-declaracao" className="w-full rounded-sm border border-gray-200 bg-white px-[14mm] py-[16mm] font-serif text-[15px] leading-[1.75] text-gray-900 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/na-logo.png" alt="Nova Acrópole" className="mx-auto mb-10 h-16 w-auto" />
        <h1 className="mb-10 text-center font-sans text-[18px] font-bold uppercase tracking-[0.2em]">{d.titulo}</h1>
        <div className="flex flex-col gap-5 text-justify">
          {d.paragrafos.map((p, i) => (
            <p key={i} className="indent-10">
              {p}
            </p>
          ))}
        </div>
        <p className="mt-10 text-right">{d.localData}</p>
        {d.assinatura && (
          <div className="mt-20 flex flex-col items-center">
            <span className="w-72 border-t border-gray-800" />
            <span className="mt-2 font-sans text-[14px] font-semibold">{d.assinatura.nome}</span>
            <span className="font-sans text-[13px] text-gray-600">{d.assinatura.cargo}</span>
          </div>
        )}
        <p className="mt-12 text-center font-sans text-[10px] text-gray-500">
          Emitida pela secretaria da escola pelo Portal em {new Date(entrega.entregueEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
        </p>
      </article>
    </main>
  );
}
