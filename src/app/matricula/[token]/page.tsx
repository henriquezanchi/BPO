import { FormMatricula } from "@/components/matricula/form-matricula";
import { aberturaPorToken } from "@/lib/matricula-online";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Matrícula · Nova Acrópole", robots: { index: false } };

const DIAS = ["domingos", "segundas-feiras", "terças-feiras", "quartas-feiras", "quintas-feiras", "sextas-feiras", "sábados"];
const hora = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

/** Site público de matrícula de uma abertura de turma (pedido do usuário 2026-10-25). */
export default async function MatriculaPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const a = await aberturaPorToken(token);
  const filial = a?.school.name.replace(/^Nova Acrópole\s*-\s*/i, "") ?? "";

  return (
    <main className="min-h-screen bg-na-bg px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="rounded-3xl bg-gradient-to-br from-na-green-dark to-na-green px-6 py-7 text-white shadow-sm">
          <p className="text-[12px] font-bold tracking-[0.16em] text-na-gold uppercase">Nova Acrópole{filial ? ` · ${filial}` : ""}</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Matrícula no curso de Filosofia</h1>
          {a && (
            <p className="mt-2 text-sm text-white/85">
              Início em {a.primeiraAula.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long" })} · aulas às {DIAS[a.diaSemana]}, {hora(a.inicioMinuto)} · {a.sala}
            </p>
          )}
        </header>

        {!a || !a.disponivel ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Matrículas fechadas</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">As matrículas desta turma não estão abertas no momento. Fale com a escola para saber das próximas turmas.</p>
          </section>
        ) : a.lotada ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Vagas preenchidas</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Esta turma já está completa. Fale com a escola para entrar na lista da próxima.</p>
          </section>
        ) : (
          <FormMatricula
            token={token}
            vagas={a.capacidade - a.pagas}
            valorCentavos={a.cobraOnline ? (a.valorContribuicaoCentavos ?? 0) : null}
          />
        )}
        <p className="text-center text-[11px] text-gray-500 dark:text-gray-400">
          Seus dados são usados só para a matrícula na escola. O CPF fica protegido e é apagado do site depois do registro.
        </p>
      </div>
    </main>
  );
}
