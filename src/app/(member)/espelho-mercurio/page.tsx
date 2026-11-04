import { redirect } from "next/navigation";
import { PainelEspelho, type ItemTela } from "@/components/espelho-mercury/painel";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { areasNaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { espelhoLigado } from "@/lib/espelho-mercury/rodar";

export const dynamic = "force-dynamic";

/**
 * Pendências do espelho Mercúrio novo → antigo (pedido do usuário 04/11/2026). Escolástica vê as de cadastro,
 * Economia as de dinheiro, a direção todas. Em espera até o espelho ser ligado (src/lib/espelho-mercury/rodar.ts).
 */
export default async function EspelhoMercurioPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/espelho-mercurio");
  const areas = (await areasNaFilial(member, member.schoolId)).filter((a) => a === "escolastica" || a === "economia");
  if (!areas.length) redirect("/voluntario");

  const [config, itens] = await carregar(member.schoolId, areas);

  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Mercúrio novo → antigo</h1>
      <PainelEspelho
        schoolId={member.schoolId}
        emEspera={!config || config.modo === "desligado"}
        modo={config?.modo ?? "desligado"}
        desde={config?.desde ?? null}
        rodada={config?.rodada?.toISOString() ?? null}
        erroRodada={config?.erro ?? null}
        itens={itens.map(
          (i): ItemTela => ({
            id: i.id,
            tipo: i.tipo,
            area: i.area,
            matricula: i.matricula,
            nome: i.nome,
            resumo: i.resumo,
            dados: i.dados as Record<string, string>,
            robo: i.robo !== null,
            revisao: i.revisao,
            status: i.status,
            ultimoErro: i.ultimoErro,
            observacao: i.observacao,
            criadoEm: i.createdAt.toISOString(),
            feitoEm: i.feitoEm?.toISOString() ?? null,
            // Feito há mais de 2 dias e a diferença ainda aparece na rodada: conferir no antigo.
            persiste: Boolean((i.status === "feito_robo" || i.status === "feito_manual") && i.feitoEm && i.vistoEm.getTime() - i.feitoEm.getTime() > 2 * 86_400_000),
          }),
        )}
      />
    </ShellTrabalho>
  );
}

/** Abertos + o que mudou nos últimos 30 dias. Sem a migração aplicada as tabelas não existem: fica "em espera". */
async function carregar(schoolId: string, areas: string[]) {
  if (!espelhoLigado()) return [null, []] as const;
  const desde = new Date(Date.now() - 30 * 86_400_000);
  const r = await Promise.all([
    db.espelhoMercuryConfig.findUnique({ where: { schoolId } }),
    db.espelhoMercuryItem.findMany({
      where: { schoolId, area: { in: areas }, OR: [{ status: { in: ["pendente", "aprovado", "erro"] } }, { updatedAt: { gte: desde } }] },
      orderBy: [{ createdAt: "asc" }],
      take: 1000,
    }),
  ]).catch(() => null);
  return r ?? ([null, []] as const);
}
