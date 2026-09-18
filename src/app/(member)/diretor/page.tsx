import { formatDateBR } from "@/lib/format";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DiretorPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/diretor");
  if (!member.isDiretor && !member.isSubChefe) redirect("/portal");

  const direcao = await db.member.findMany({
    where: { schoolId: member.schoolId, OR: [{ isDiretor: true }, { isSubChefe: true }] },
  });
  const diretor = direcao.find((m) => m.isDiretor);
  const subChefe = direcao.find((m) => m.isSubChefe);
  const { school } = member;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link href="/voluntario" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Portal do Voluntário
      </Link>
      <h1 className="text-xl font-bold text-na-green-dark">Painel do Diretor</h1>

      <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-800">{school.name}</h2>
        <dl className="flex flex-col gap-2 text-xs">
          <Item label="Diretor(a)" value={diretor?.name ?? "—"} />
          <Item label="Sub-Chefe" value={subChefe?.name ?? "—"} />
          <Item label="CNPJ" value={school.cnpj ?? "—"} />
          <Item label="Endereço" value={school.enderecoCompleto ?? "—"} />
          <Item label="Telefone" value={school.telefoneUnidade ?? "—"} />
          <Item label="Fundação" value={school.fundacao ? formatDateBR(school.fundacao) : "—"} />
        </dl>
        {school.unidadeSyncedAt && (
          <p className="text-[10px] text-gray-400">Sincronizado do Mercúrio em {formatDateBR(school.unidadeSyncedAt)}.</p>
        )}
      </section>
    </main>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-100 pb-1.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  );
}
