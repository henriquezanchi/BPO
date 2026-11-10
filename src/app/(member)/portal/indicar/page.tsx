import { ArrowLeft, HeartHandshake } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CompartilharConvite } from "@/components/member/compartilhar-convite";
import { getAuthenticatedMember } from "@/lib/auth";
import { codigoDeConvite } from "@/lib/carteirinha";
import { proximasAberturas, quandoComeca } from "@/lib/convite";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Indicar um amigo (pedido do usuário 07/11/2026). O aluno manda um link pessoal com as próximas turmas da filial; se o
 * amigo se matricula pelo site, "como conheceu" registra a indicação. Mostra quantos já entraram pelo convite.
 */
export default async function IndicarPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/portal/indicar");
  const matricula = member.mercurioId && /^\d+$/.test(member.mercurioId) ? member.mercurioId : null;
  const h = await headers();
  const origem = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const link = matricula ? `${origem}/convite/${codigoDeConvite(matricula)}` : null;
  const [aberturas, indicados] = await Promise.all([
    proximasAberturas(member.schoolId),
    matricula ? db.matriculaOnline.count({ where: { comoConheceu: { endsWith: `(matrícula ${matricula})` }, status: { in: ["paga", "lancada"] } } }) : 0,
  ]);
  const texto = aberturas.length
    ? `Estudo filosofia na Nova Acrópole e queria te convidar. Vai começar uma turma nova: ${quandoComeca(aberturas[0]).replace("Começa em", "começa em")}. Veja os detalhes:`
    : "Estudo filosofia na Nova Acrópole e queria te convidar para conhecer. Veja as próximas turmas:";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <Link href="/portal" className="-my-2 flex min-h-11 w-fit items-center gap-1.5 text-[13px] font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> Portal do Aluno
      </Link>
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-na-green-dark dark:text-emerald-400">
          <HeartHandshake size={22} /> Indicar um amigo
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Quem chega por um amigo costuma ficar mais na escola. Mande o seu convite: ele mostra as próximas turmas e, se a pessoa se matricular pelo site, a escola
          sabe que foi você.
        </p>
      </header>

      {link ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="rounded-xl bg-gray-50 p-3 text-[13px] text-gray-700 dark:bg-gray-800 dark:text-gray-200">{texto}</p>
          <CompartilharConvite link={link} texto={texto} />
        </section>
      ) : (
        <p className="text-sm text-gray-600">Sua matrícula ainda não chegou ao Portal. Fale com a secretaria.</p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Próximas turmas da sua filial</h2>
        {aberturas.length ? (
          aberturas.map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{a.titulo}</p>
              <p className="text-[13px] text-gray-600 dark:text-gray-400">{quandoComeca(a)}</p>
            </div>
          ))
        ) : (
          <p className="text-[13px] text-gray-600 dark:text-gray-400">Nenhuma turma nova com data marcada agora. O convite continua valendo: ele mostra as turmas quando forem marcadas.</p>
        )}
      </section>

      {indicados > 0 && (
        <p className="rounded-xl bg-na-gold/15 p-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
          {indicados === 1 ? "1 pessoa já se matriculou" : `${indicados} pessoas já se matricularam`} pelo seu convite. Obrigado!
        </p>
      )}
    </main>
  );
}
