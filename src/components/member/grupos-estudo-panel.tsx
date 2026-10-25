"use client";

import { pedirNotificacoes } from "@/components/pwa/ativar-notificacoes";
import { entrarNoGrupoDeEstudo } from "@/lib/actions/grupos-actions";
import { MODALIDADES } from "@/lib/grupos-comum";
import { BookOpenText, ChevronRight, Loader2, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type GrupoDeEstudo = { id: string; nome: string; tipo: string; descricao: string | null; modalidade: string | null; local: string | null; participo: boolean };

/**
 * Grupos de estudo e leituras comentadas da filial no Portal do Aluno (pedido do usuário 2026-10-25):
 * os seus e os abertos, com "Quero participar" (entra na hora; o servidor confere se o grupo aceita a pessoa).
 */
export function GruposEstudoPanel({ grupos }: { grupos: GrupoDeEstudo[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const meus = grupos.filter((g) => g.participo);
  const abertos = grupos.filter((g) => !g.participo);

  function entrar(id: string) {
    setErro(null);
    setEntrando(id);
    iniciar(async () => {
      const r = await entrarNoGrupoDeEstudo(id);
      setEntrando(null);
      if (!r.ok) return setErro(r.error);
      pedirNotificacoes("Você entrou no grupo. Quer ser lembrado dos encontros?");
      router.refresh();
    });
  }

  const Linha = ({ g, children }: { g: GrupoDeEstudo; children: React.ReactNode }) => (
    <li className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
        <BookOpenText size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold tracking-wide text-na-gold-dark uppercase dark:text-amber-300">{g.tipo}</p>
        <p className="text-[14px] leading-snug font-bold text-gray-900 dark:text-gray-100">{g.nome}</p>
        {(g.modalidade || g.local) && (
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-gray-600 dark:text-gray-400">
            <MapPin size={12} className="shrink-0" /> {[g.modalidade && MODALIDADES[g.modalidade], g.local].filter(Boolean).join(" · ")}
          </p>
        )}
        {g.descricao && <p className="mt-1 line-clamp-3 text-[12px] whitespace-pre-line text-gray-600 dark:text-gray-400">{g.descricao}</p>}
        {children}
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-5 text-left">
      {erro && <p className="text-[12px] text-na-danger-dark dark:text-red-300">{erro}</p>}
      {meus.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300">Seus grupos</h3>
          <ul className="flex flex-col gap-2">
            {meus.map((g) => (
              <Linha key={g.id} g={g}>
                <Link href={`/grupos/${g.id}?de=portal`} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">
                  Encontros e avisos <ChevronRight size={13} />
                </Link>
              </Linha>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300">Abertos para você</h3>
        {abertos.length === 0 ? (
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Nenhum grupo de estudo ou leitura comentada aberto agora na sua escola.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {abertos.map((g) => (
              <Linha key={g.id} g={g}>
                <button
                  onClick={() => entrar(g.id)}
                  disabled={entrando === g.id}
                  className="mt-2 flex items-center gap-1.5 rounded-lg bg-na-green px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
                >
                  {entrando === g.id && <Loader2 size={13} className="animate-spin" />} Quero participar
                </button>
              </Linha>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
