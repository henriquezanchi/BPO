import { GeradorDeclaracoes } from "@/components/escolastica/declaracoes";
import { AbasArea } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { ABAS_ESCOLASTICA } from "@/lib/abas-escolastica";
import { exigirArea } from "@/lib/area-trabalho";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Declarações de matrícula, instrução, voluntariado e cursos, com os dados do Mercúrio (pedido do usuário 02/11/2026). */
export default async function DeclaracoesPage() {
  const member = await exigirArea("escolastica", "/escolastica/declaracoes");
  const pessoas = await db.member.findMany({
    where: { schoolId: member.schoolId, mercurioAtivo: true, mercurioId: { not: null } },
    select: { id: true, name: true, mercurioId: true },
    orderBy: { name: "asc" },
  });
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400 print:hidden">Escolástica</h1>
      <div className="print:hidden">
        <AbasArea base="/escolastica" atual="declaracoes" abas={ABAS_ESCOLASTICA} />
      </div>
      <GeradorDeclaracoes schoolId={member.schoolId} pessoas={pessoas.map((p) => ({ id: p.id, nome: p.name, matricula: p.mercurioId! }))} />
    </ShellTrabalho>
  );
}
