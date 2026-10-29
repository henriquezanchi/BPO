import { ThemeToggle } from "@/components/ui/theme-toggle";
import { temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember } from "@/lib/auth";
import { ETAPAS_GAF, rotuloTexto, TEXTOS_GAF, textoGaf } from "@/lib/gaf-leituras";
import { artigoDoGaf } from "@/lib/gaf-texto";
import { meusGrupos } from "@/lib/grupos-dados";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Um texto de trabalho do GAF lido dentro do Portal (2026-10-29). Para quem participa de um GAF ou tem o Portal do
 * Voluntário (coordenação). O conteúdo vem do site do GAF, limpo em lib/gaf-texto.ts.
 */
export default async function TextoGafPage(props: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await props.params;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/gaf/texto/${codigo}`);
  const texto = textoGaf(codigo);
  if (!texto) notFound();
  if (!(await meusGrupos(member, ["GAF"])).length && !(await temAcessoVoluntario(member))) redirect("/portal");

  const html = await artigoDoGaf(texto);
  const i = TEXTOS_GAF.findIndex((t) => t.codigo === texto.codigo);
  const anterior = TEXTOS_GAF[i - 1];
  const proximo = TEXTOS_GAF[i + 1];
  const etapa = ETAPAS_GAF[texto.etapa as keyof typeof ETAPAS_GAF];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 bg-na-bg p-4 sm:p-6 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Portal do Aluno
        </Link>
        <ThemeToggle />
      </div>
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-bold tracking-wide text-na-green-dark uppercase dark:text-emerald-400">
          GAF · Etapa {etapa?.nome} · Texto {String(texto.numero).padStart(2, "0")}
        </p>
        <h1 className="text-2xl leading-tight font-black text-gray-900 dark:text-gray-100">{texto.titulo}</h1>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">{texto.tema}</p>
      </header>

      {html ? (
        <article
          className="rounded-2xl bg-white p-5 text-[16px] leading-[1.75] text-gray-800 sm:p-7 dark:bg-gray-900 dark:text-gray-200 [&_a]:text-na-green-dark [&_a]:underline dark:[&_a]:text-emerald-400 [&_aside]:mt-8 [&_aside]:border-t [&_aside]:border-gray-200 [&_aside]:pt-4 [&_aside]:text-[13px] [&_aside]:text-gray-600 dark:[&_aside]:border-gray-800 dark:[&_aside]:text-gray-400 [&_blockquote]:my-4 [&_blockquote]:pl-4 [&_blockquote]:text-gray-600 [&_blockquote]:italic dark:[&_blockquote]:text-gray-400 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-gray-900 dark:[&_h2]:text-gray-100 [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-bold [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_sup]:text-[11px] [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="rounded-2xl bg-white p-5 text-[14px] text-gray-700 dark:bg-gray-900 dark:text-gray-300">
          O site do GAF não respondeu agora. Tente de novo em instantes ou{" "}
          <a href={texto.url} target="_blank" rel="noreferrer" className="font-semibold text-na-green-dark underline dark:text-emerald-400">
            abra no site do GAF
          </a>
          .
        </div>
      )}

      <nav aria-label="Outros textos" className="grid grid-cols-2 gap-2">
        {anterior ? (
          <Link href={`/gaf/texto/${anterior.codigo}`} className="flex flex-col rounded-xl border border-gray-200 bg-white p-3 text-[12px] dark:border-gray-800 dark:bg-gray-900">
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <ChevronLeft size={13} /> Anterior
            </span>
            <span className="truncate font-semibold text-gray-900 dark:text-gray-100">{rotuloTexto(anterior)}</span>
          </Link>
        ) : (
          <span />
        )}
        {proximo && (
          <Link href={`/gaf/texto/${proximo.codigo}`} className="flex flex-col items-end rounded-xl border border-gray-200 bg-white p-3 text-right text-[12px] dark:border-gray-800 dark:bg-gray-900">
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              Próximo <ChevronRight size={13} />
            </span>
            <span className="max-w-full truncate font-semibold text-gray-900 dark:text-gray-100">{rotuloTexto(proximo)}</span>
          </Link>
        )}
      </nav>
      <a href={texto.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 text-[11px] text-gray-400 hover:text-gray-600">
        Fonte: site do GAF <ExternalLink size={11} />
      </a>
    </main>
  );
}
