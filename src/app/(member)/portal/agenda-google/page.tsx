import { ArrowLeft, CalendarPlus } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CopiarLink } from "@/components/member/copiar-link";
import { codigoDaAgenda } from "@/lib/agenda-ics";
import { getAuthenticatedMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Levar os eventos do Portal para o Google Agenda (09/11/2026, caminho 1: assinatura por link). Inscritos entram
 * confirmados; publicados sem inscrição entram como "A confirmar". O Google atualiza agendas assinadas no ritmo dele.
 */
export default async function AgendaGooglePage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/portal/agenda-google");
  const h = await headers();
  const host = h.get("host") ?? "";
  const https = `${h.get("x-forwarded-proto") ?? "https"}://${host}/api/agenda/${codigoDaAgenda(member.id)}.ics`;
  const webcal = https.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  const botao =
    "flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <Link
        href="/portal"
        className="-my-2 flex min-h-11 w-fit items-center gap-1.5 text-[13px] font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft size={14} /> Portal do Aluno
      </Link>
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-na-green-dark dark:text-emerald-400">
          <CalendarPlus size={22} /> Eventos na sua agenda
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Os eventos da Nova Acrópole aparecem na agenda do seu celular. Os que
          você se inscreveu entram confirmados; os demais entram como “A
          confirmar”, com o link para se inscrever.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <a
          href={google}
          target="_blank"
          rel="noreferrer"
          className={`${botao} bg-na-green text-white transition hover:bg-na-green-dark`}
        >
          Adicionar ao Google Agenda
        </a>
        <a
          href={webcal}
          className={`${botao} border border-gray-300 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100`}
        >
          Adicionar no iPhone, Mac ou Outlook
        </a>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-[13px] text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
        <h2 className="font-bold text-gray-900 dark:text-gray-100">
          Bom saber
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            O Google atualiza essas agendas sozinho, mas no ritmo dele: uma
            inscrição nova pode levar algumas horas para virar “confirmada”.
          </li>
          <li>
            A inscrição continua sendo feita no Portal, pelo link que vai em
            cada evento.
          </li>
          <li>
            O link é pessoal: não compartilhe. Quem tiver o link vê os eventos
            da sua agenda.
          </li>
          <li>
            No celular, se o Google Agenda não mostrar a agenda nova, abra o
            Google Agenda no computador uma vez e marque “Nova Acrópole ·
            Portal” para sincronizar.
          </li>
        </ul>
      </section>

      <details className="text-[12px] text-gray-500">
        <summary className="cursor-pointer">
          Usar o link em outro aplicativo
        </summary>
        <div className="mt-2">
          <CopiarLink link={https} />
        </div>
      </details>
    </main>
  );
}
