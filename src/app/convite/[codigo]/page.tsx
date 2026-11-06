import type { Metadata } from "next";
import { lerCodigoDeConvite } from "@/lib/carteirinha";
import { proximasAberturas, quandoComeca } from "@/lib/convite";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Convite · Nova Acrópole", robots: { index: false } };

const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

/**
 * Página pública do convite (Indicar um amigo, 07/11/2026). Mostra quem convidou (só o primeiro nome) e as próximas
 * aberturas de turma da filial; a matrícula pelo site leva o código, e a indicação fica registrada.
 */
export default async function ConvitePage(props: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await props.params;
  const matricula = lerCodigoDeConvite(decodeURIComponent(codigo));
  const quem = matricula
    ? await db.member.findFirst({
        where: { mercurioId: matricula, mercurioAtivo: true },
        select: { name: true, school: { select: { id: true, name: true, city: true, whatsapp: true, enderecoCompleto: true } } },
      })
    : null;
  const aberturas = quem ? await proximasAberturas(quem.school.id) : [];
  const filial = quem?.school.name.replace(/^Nova Acrópole\s*-\s*/i, "") ?? "";
  const primeiroNome = quem ? titulo(quem.name.trim().split(/\s+/)[0]) : "";
  const whatsapp = quem?.school.whatsapp?.replace(/\D/g, "");

  return (
    <main className="min-h-screen bg-na-bg px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <header className="rounded-3xl bg-gradient-to-br from-na-green-dark to-na-green px-6 py-7 text-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/na-logo.png" alt="Nova Acrópole" className="mb-4 h-10 w-auto brightness-0 invert" />
          {quem ? (
            <>
              <p className="text-[12px] font-bold tracking-[0.16em] text-na-gold uppercase">Nova Acrópole · {filial}</p>
              <h1 className="mt-1 text-2xl font-black [text-wrap:balance]">{primeiroNome} convidou você para conhecer a Nova Acrópole</h1>
              <p className="mt-2 text-sm text-white/85">
                Escola de Filosofia à maneira clássica: estudar e viver as grandes ideias da humanidade, com aulas em grupo e um curso que começa do zero.
              </p>
            </>
          ) : (
            <h1 className="text-2xl font-black">Convite não encontrado</h1>
          )}
        </header>

        {quem && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Próximas turmas</h2>
            {aberturas.length ? (
              aberturas.map((a) => (
                <article key={a.id} className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">{a.titulo}</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{quandoComeca(a)}</p>
                  {a.sala && <p className="text-[13px] text-gray-500 dark:text-gray-400">{a.sala.toLowerCase() === "online" ? "Aulas online" : `Sala ${a.sala}`}</p>}
                  {a.matriculaToken ? (
                    <a
                      href={`/matricula/${a.matriculaToken}?indicacao=${encodeURIComponent(codigo)}`}
                      className="mt-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-na-green-dark px-4 text-sm font-semibold text-white"
                    >
                      Quero me matricular
                    </a>
                  ) : (
                    <p className="text-[13px] text-gray-600 dark:text-gray-400">Matrículas pelo site ainda não abertas para esta turma: fale com a escola.</p>
                  )}
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                Nenhuma turma nova com data marcada agora. Fale com a escola para saber da próxima.
              </p>
            )}
          </section>
        )}

        {quem && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">Fale com a escola</h2>
            {quem.school.enderecoCompleto && <p className="mt-1">{quem.school.enderecoCompleto}</p>}
            {whatsapp && (
              <p className="mt-1">
                WhatsApp:{" "}
                <a className="font-semibold text-na-green-dark underline dark:text-emerald-400" href={`https://wa.me/${whatsapp.startsWith("55") ? whatsapp : `55${whatsapp}`}`}>
                  {quem.school.whatsapp}
                </a>
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
