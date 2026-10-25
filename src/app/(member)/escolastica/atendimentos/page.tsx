import { AbasArea } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { TabelaInstrutores } from "@/components/atendimentos/tabela-instrutores";
import { ABAS_ESCOLASTICA } from "@/lib/abas-escolastica";
import { ehAdministradorNacional } from "@/lib/acesso-voluntario";
import { numerosDosInstrutores } from "@/lib/atendimentos";
import { getAuthenticatedMember } from "@/lib/auth";
import { escolasQueGereAvaliacao } from "@/lib/avaliacao";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const curto = (n: string) => n.replace(/^Nova Acrópole\s*-\s*/i, "");

/**
 * Atendimentos dos instrutores (pedido do usuário 2026-10-25): para a Direção, a Escolástica e o nacional, quem não
 * abriu horários, quem está mais livre e mais cheio, e o que foi realizado. Mesma permissão da Avaliação dos instrutores.
 */
export default async function AtendimentosGestaoPage(props: { searchParams: Promise<{ filial?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/escolastica/atendimentos");
  const nacional = await ehAdministradorNacional(member);
  const ids = nacional
    ? (await db.school.findMany({ where: { members: { some: { isPedagogo: true, mercurioAtivo: true } } }, select: { id: true } })).map((s) => s.id)
    : await escolasQueGereAvaliacao(member);
  if (!ids.length) redirect("/portal");

  const escolas = await db.school.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, uf: true }, orderBy: [{ uf: "asc" }, { name: "asc" }] });
  const { filial } = await props.searchParams;
  const todas = filial === "todas" && escolas.length > 1;
  const escola = escolas.find((e) => e.id === filial) ?? escolas.find((e) => e.id === member.schoolId) ?? escolas[0];
  const recorte = todas ? escolas : [escola];
  const numeros = await numerosDosInstrutores(recorte.map((e) => e.id));

  const nomeFilial = new Map(escolas.map((e) => [e.id, curto(e.name)]));
  const comHorarios = numeros.filter((n) => n.horariosAbertos > 0);
  const abertos = numeros.reduce((s, n) => s + n.horariosAbertos, 0);
  const marcados = numeros.reduce((s, n) => s + n.marcados, 0);
  const realizados = numeros.reduce((s, n) => s + n.realizados30, 0);
  const porUf = escolas.reduce((m, e) => m.set(e.uf ?? "—", [...(m.get(e.uf ?? "—") ?? []), e]), new Map<string, typeof escolas>());

  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Escolástica</h1>
      <AbasArea base="/escolastica" atual="atendimentos" abas={ABAS_ESCOLASTICA} />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Conversas individuais que os alunos marcam com os instrutores das suas turmas. Horários e ocupação contam as próximas 4 semanas; realizadas, faltas e cancelamentos, os últimos 30 dias. Dados do Portal.
      </p>

      {escolas.length > 1 && (
        <form className="-mt-2 flex flex-wrap items-center gap-2">
          <select name="filial" defaultValue={todas ? "todas" : escola.id} className="min-h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            <option value="todas">Todas as filiais ({escolas.length})</option>
            {[...porUf.entries()].map(([uf, lista]) => (
              <optgroup key={uf} label={uf}>
                {lista.map((e) => (
                  <option key={e.id} value={e.id}>{curto(e.name)}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button className="min-h-10 rounded-xl bg-na-green px-4 text-sm font-bold text-white hover:bg-na-green-dark">Ver</button>
        </form>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Instrutores com horários", `${comHorarios.length} de ${numeros.length}`, numeros.length - comHorarios.length ? `${numeros.length - comHorarios.length} sem horários abertos` : "todos abriram horários"],
          ["Horários abertos", String(abertos), "próximas 4 semanas"],
          ["Conversas marcadas", String(marcados), abertos ? `${Math.round((marcados / abertos) * 100)}% dos horários abertos` : "nenhum horário aberto"],
          ["Conversas realizadas", String(realizados), "últimos 30 dias"],
        ].map(([rotulo, valor, detalhe]) => (
          <div key={rotulo} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{rotulo}</p>
            <p className="mt-1 text-2xl font-black text-gray-900 tabular-nums dark:text-gray-100">{valor}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{detalhe}</p>
          </div>
        ))}
      </div>

      <TabelaInstrutores
        mostrarFilial={todas}
        linhas={numeros.map((n) => ({ ...n, filial: nomeFilial.get(n.schoolId) ?? "", proximoLivre: n.proximoLivre?.toISOString() ?? null }))}
      />
    </ShellTrabalho>
  );
}
