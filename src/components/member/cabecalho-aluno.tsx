import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Cabeçalho único das subpáginas do Portal do Aluno (revisão de design 25/11/2026: havia dois padrões, o cartão verde
 * com rótulo dourado e o título com ícone). Linha de volta com o tema, depois o título com o ícone num quadro verde-claro
 * e, se houver, uma frase de orientação e ações à direita.
 */
export function CabecalhoAluno({ titulo, icone, descricao, acoes, voltar = "/portal", rotuloVoltar = "Portal do Aluno" }: { titulo: string; icone?: ReactNode; descricao?: ReactNode; acoes?: ReactNode; voltar?: string; rotuloVoltar?: string }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Link href={voltar} className="-my-2 -ml-1 flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-1 text-[13px] font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> {rotuloVoltar}
        </Link>
        <ThemeToggle />
      </div>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icone && <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-na-green-light text-na-green-dark [&>svg]:h-[22px] [&>svg]:w-[22px] dark:bg-emerald-950/40 dark:text-emerald-400">{icone}</span>}
          <div className="min-w-0">
            <h1 className="text-xl leading-tight font-black text-balance text-na-green-dark lg:text-2xl dark:text-emerald-400">{titulo}</h1>
            {descricao && <p className="mt-1 text-[13px] leading-snug text-gray-600 dark:text-gray-300">{descricao}</p>}
          </div>
        </div>
        {acoes && <div className="flex shrink-0 gap-2">{acoes}</div>}
      </header>
    </>
  );
}
