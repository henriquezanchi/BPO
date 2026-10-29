import { Imprimir } from "@/components/estudos/imprimir";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Anotação ou resumo pronto para "Salvar como PDF" (abre a impressão do navegador). Só a própria pessoa. */
export default async function AnotacaoPdf(props: { params: Promise<{ id: string }>; searchParams: Promise<{ so?: string }> }) {
  const { id } = await props.params;
  const { so } = await props.searchParams;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/estudos/anotacoes/${id}/pdf`);
  const a = await db.anotacaoAula.findFirst({ where: { id, memberId: member.id } });
  if (!a) notFound();
  const soResumo = so === "resumo" && !!a.resumo;
  return (
    <main className="mx-auto max-w-2xl bg-white p-8 text-gray-900">
      <Imprimir />
      <p className="text-[11px] tracking-wide text-gray-500 uppercase">Nova Acrópole · Anotações das aulas</p>
      <h1 className="mt-1 text-2xl font-bold">{a.tema}</h1>
      <p className="text-sm text-gray-600">
        {a.materiaNome ?? a.materiaSigla} · {member.name} · {a.updatedAt.toLocaleDateString("pt-BR")}
      </p>
      {a.resumo && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Resumo para estudar</h2>
          <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-line">{a.resumo}</p>
        </section>
      )}
      {!soResumo && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Anotações</h2>
          <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-line">{a.texto}</p>
        </section>
      )}
    </main>
  );
}
