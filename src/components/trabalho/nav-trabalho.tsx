"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Destino, IconeDestino } from "@/lib/area-trabalho";
import { ArrowLeft, Banknote, CalendarClock, CalendarDays, ClipboardCheck, Coffee, Crown, FileSignature, Globe2, GraduationCap, HandHeart, Home, KeyRound, Menu, Settings, Ticket, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ICONES: Record<IconeDestino, typeof Home> = {
  inicio: Home,
  instrutor: GraduationCap,
  grupos: Users,
  escolastica: CalendarClock,
  avaliacao: ClipboardCheck,
  economia: Banknote,
  eventos: Ticket,
  cafe: Coffee,
  direcao: Crown,
  admin: Settings,
  acessos: KeyRound,
  nacional: Globe2,
  termo: FileSignature,
  calendario: CalendarDays,
  aberturas: GraduationCap,
  secretarias: Users,
  oportunidades: HandHeart,
};
const SECOES: Destino["secao"][] = ["Meu trabalho", "Secretarias", "Gestão da filial", "Nacional"];

/** Destino ativo: o mais específico cujo endereço começa a página atual (/escolastica/avaliacao vence /escolastica). */
function ativo(destinos: Destino[], caminho: string, forcado?: string) {
  if (forcado) return forcado;
  const base = (h: string) => h.split("?")[0];
  return [...destinos].sort((a, b) => base(b.href).length - base(a.href).length).find((d) => caminho === base(d.href) || caminho.startsWith(`${base(d.href)}/`))?.href ?? "/voluntario";
}

function Lista({ destinos, atual, aoEscolher }: { destinos: Destino[]; atual: string; aoEscolher?: () => void }) {
  return (
    <nav className="flex flex-col gap-5" aria-label="Área do Voluntário">
      {SECOES.map((secao) => {
        const itens = destinos.filter((d) => d.secao === secao);
        if (!itens.length) return null;
        return (
          <div key={secao} className="flex flex-col gap-0.5">
            <p className="mb-1 px-3 text-[10px] font-bold tracking-wide text-gray-400 uppercase">{secao}</p>
            {itens.map((d) => {
              const Icone = ICONES[d.icone];
              const marcado = d.href === atual;
              return (
                <Link
                  key={d.href}
                  href={d.href}
                  onClick={aoEscolher}
                  aria-current={marcado ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                    marcado ? "bg-na-green text-white" : "text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-900"
                  }`}
                >
                  <Icone size={16} className={marcado ? "" : "text-gray-400"} /> <span className="flex-1">{d.rotulo}</span>
                  {!!d.pendentes && (
                    <span className="min-w-5 rounded-full bg-na-danger px-1.5 py-0.5 text-center text-[10px] font-bold text-white" aria-label={`${d.pendentes} aguardando`}>
                      {d.pendentes}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Menu da Área do Voluntário: lateral fixa no computador; no celular, barra
 * no topo com um botão que abre a lista. Só lista o que a pessoa pode ver.
 */
export function NavTrabalho({ destinos, nome, filial, forcado }: { destinos: Destino[]; nome: string; filial: string; forcado?: string }) {
  const caminho = usePathname() ?? "";
  const atual = ativo(destinos, caminho, forcado);
  const [aberto, setAberto] = useState(false);
  const rotuloAtual = destinos.find((d) => d.href === atual)?.rotulo ?? "Área do Voluntário";

  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  const rodape = (
    <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-800">
      <Link href="/portal" className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> Portal do Aluno
      </Link>
      <ThemeToggle />
    </div>
  );
  const cabecalho = (
    <div>
      <p className="text-[11px] font-bold tracking-wide text-na-gold-dark uppercase dark:text-na-gold">Área do Voluntário</p>
      <p className="mt-0.5 truncate text-[13px] font-bold text-gray-900 dark:text-gray-100">{nome}</p>
      <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{filial}</p>
    </div>
  );

  return (
    <>
      {/* Computador */}
      <aside className="hidden border-r border-gray-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:overflow-y-auto lg:p-5 dark:border-gray-800">
        {cabecalho}
        <Lista destinos={destinos} atual={atual} />
        <div className="mt-auto">{rodape}</div>
      </aside>

      {/* Celular */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-gray-200 bg-na-bg/95 px-4 py-3 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-950/95">
        <button onClick={() => setAberto(true)} aria-label="Abrir menu" aria-expanded={aberto} className="flex items-center gap-2 rounded-lg py-1 pr-2 text-[14px] font-bold text-gray-900 dark:text-gray-100">
          <Menu size={20} /> {rotuloAtual}
          {destinos.some((d) => d.pendentes) && <span className="h-2 w-2 rounded-full bg-na-danger" aria-label="Há pedidos aguardando" />}
        </button>
        <ThemeToggle />
      </header>
      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu da Área do Voluntário">
          <button className="absolute inset-0 bg-black/40" aria-label="Fechar menu" onClick={() => setAberto(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col gap-6 overflow-y-auto bg-na-bg p-5 shadow-xl dark:bg-gray-950">
            <div className="flex items-start justify-between gap-2">
              {cabecalho}
              <button onClick={() => setAberto(false)} aria-label="Fechar menu" className="rounded-lg p-1 text-gray-500">
                <X size={20} />
              </button>
            </div>
            <Lista destinos={destinos} atual={atual} aoEscolher={() => setAberto(false)} />
            <div className="mt-auto">{rodape}</div>
          </div>
        </div>
      )}
    </>
  );
}
