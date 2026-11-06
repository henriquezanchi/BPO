import { BotaoImprimir } from "@/components/member/botao-imprimir";
import { getAuthenticatedMember } from "@/lib/auth";
import { lerComprovanteAnual } from "@/lib/comprovante-anual";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Comprovante anual de contribuições (pedido do usuário 06/11/2026), para quem precisa comprovar o que contribuiu no ano.
 * Só a própria pessoa abre; os valores vêm dos recibos emitidos pela escola no Mercúrio. Imprime ou salva em PDF.
 */
export default async function ComprovanteAnualPage(props: { params: Promise<{ ano: string }> }) {
  const { ano: anoTexto } = await props.params;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/portal/comprovante/${anoTexto}`);
  const ano = Number(anoTexto);
  const anoAtual = new Date().getFullYear();
  if (!Number.isInteger(ano) || ano < anoAtual - 5 || ano > anoAtual) notFound();
  if (!member.mercurioId || member.school.sistemaRegistro !== "mercurio") notFound();

  const { linhas, total } = await lerComprovanteAnual(member.mercurioId, ano);
  const escola = member.school;
  const nome = member.name.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  const emitidoEm = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 bg-na-bg p-4 print:bg-white print:p-0 dark:bg-gray-950">
      <style>{`@media print {
        @page { size: A4; margin: 18mm 16mm; }
        #folha-comprovante { border: 0 !important; box-shadow: none !important; padding: 0 !important; }
      }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <div className="flex items-center gap-2">
          {[anoAtual, anoAtual - 1].map((a) => (
            <Link
              key={a}
              href={`/portal/comprovante/${a}`}
              aria-current={a === ano ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${a === ano ? "bg-na-green-dark text-white" : "border border-gray-300 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"}`}
            >
              {a}
            </Link>
          ))}
          <BotaoImprimir />
        </div>
      </div>

      <article id="folha-comprovante" className="w-full rounded-sm border border-gray-200 bg-white px-[12mm] py-[14mm] text-[13px] leading-relaxed text-gray-900 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/na-logo.png" alt="Nova Acrópole" className="mx-auto mb-6 h-14 w-auto" />
        <h1 className="text-center text-[16px] font-bold uppercase tracking-[0.15em]">Comprovante de contribuições · {ano}</h1>
        <p className="mt-1 text-center text-[12px] text-gray-600">
          {escola.name}
          {escola.cnpj ? ` · CNPJ ${escola.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}` : ""}
        </p>

        <p className="mt-6">
          Recibos emitidos pela escola em nome de <strong>{nome}</strong>, matrícula {member.mercurioId}, com data em {ano}.
        </p>

        {linhas.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-gray-400 text-left">
                  <th className="py-1.5 pr-2 font-semibold">Data</th>
                  <th className="py-1.5 pr-2 font-semibold">Recibo</th>
                  <th className="py-1.5 pr-2 font-semibold">Descrição</th>
                  <th className="py-1.5 pr-2 font-semibold">Referência</th>
                  <th className="py-1.5 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={`${l.recibo}-${i}`} className="border-b border-gray-100">
                    <td className="py-1 pr-2 tabular-nums">{dataBR(l.data)}</td>
                    <td className="py-1 pr-2 tabular-nums">{l.recibo}</td>
                    <td className="py-1 pr-2">{l.descricao}</td>
                    <td className="py-1 pr-2 tabular-nums">{l.referencia ?? "—"}</td>
                    <td className="py-1 text-right tabular-nums">{reais(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-800">
                  <td colSpan={4} className="py-2 font-bold">
                    Total no ano
                  </td>
                  <td className="py-2 text-right font-bold tabular-nums">{reais(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-gray-50 p-3 text-gray-700">Nenhum recibo em {ano} em seu nome.</p>
        )}

        <p className="mt-8 text-center text-[10px] text-gray-500">
          Emitido pelo Portal em {emitidoEm}, a partir dos recibos registrados no sistema da escola. Recibos cancelados não entram. Em caso de dúvida,
          procure a secretaria de Economia da filial.
        </p>
      </article>
    </main>
  );
}
