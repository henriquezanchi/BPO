"use client";

import { MembrosTab, VisaoGeralTab } from "@/components/director/diretor-dashboard";
import { FortunaTab } from "@/components/director/fortuna-tab";
import { MemberDetailPanel } from "@/components/director/member-detail-panel";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { getFortunaBalancesForDirector, type FortunaBalancesForDirector } from "@/lib/actions/fortuna-actions";
import type { DirectorDashboard } from "@/lib/director-data";
import { whatsappHref } from "@/lib/format";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AbaEscolastica } from "@/lib/abas-escolastica";

/** Abas de uma área da filial (links com ?aba=, funcionam no computador e no celular). */
export function AbasArea({ base, abas, atual }: { base: string; abas: readonly AbaEscolastica[]; atual: string }) {
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 lg:mx-0 lg:px-0 dark:border-gray-800" aria-label="Seções">
      {abas.map(([id, rotulo, href]) => (
        <Link
          key={id}
          href={href ?? `${base}?aba=${id}`}
          aria-current={atual === id ? "page" : undefined}
          className={`shrink-0 border-b-2 px-3 py-2 text-[13px] font-semibold ${
            atual === id ? "border-na-green text-na-green-dark dark:text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
          }`}
        >
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}

function useSaldosFortuna(schoolId: string) {
  const [saldos, setSaldos] = useState<FortunaBalancesForDirector>({ saldoConsolidado: 0, saldosPorMembro: [] });
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    getFortunaBalancesForDirector(schoolId)
      .then(setSaldos)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [schoolId]);
  return { saldos, carregando };
}

// Atalhos da Visão Geral levam à área de cada assunto.
const DESTINO_DA_ABA: Record<string, string> = {
  membros: "/economia?aba=situacao",
  repasses: "/economia?aba=contas",
  recuperacao: "/economia?aba=recuperacao",
  fortuna: "/voluntario/cafe",
};

/** Visão da filial (direção): o que era a Visão Geral do Painel da Direção. */
export function VisaoFilial({ schoolId, data, comRelatorio = true }: { schoolId: string; data: DirectorDashboard; comRelatorio?: boolean }) {
  const router = useRouter();
  const { saldos, carregando } = useSaldosFortuna(schoolId);
  return (
    <VisaoGeralTab
      schoolId={schoolId}
      data={data}
      onNavigate={(aba, opts) => router.push(aba === "membros" && opts?.statusFiltro ? `/economia?aba=situacao&status=${opts.statusFiltro}` : (DESTINO_DA_ABA[aba] ?? "/voluntario"))}
      saldoFortunaConsolidado={saldos.saldoConsolidado}
      fortunaCarregando={carregando}
      comRelatorio={comRelatorio}
    />
  );
}

/** Café: Caixa Fortuna. */
export function CafeArea({ schoolId, data }: { schoolId: string; data: DirectorDashboard }) {
  const { saldos, carregando } = useSaldosFortuna(schoolId);
  return <FortunaTab schoolId={schoolId} data={data} balances={saldos} carregando={carregando} />;
}

/** Economia → situação da contribuição (a antiga aba Gestão de Membros). */
export function SituacaoContribuicao({ schoolId, data, status }: { schoolId: string; data: DirectorDashboard; status?: string }) {
  return <MembrosTab schoolId={schoolId} data={data} filtroInicial={status} />;
}

/** Escolástica → membros, sem dados financeiros (esses ficam na Economia). */
export function MembrosEscolastica({ schoolId, data }: { schoolId: string; data: DirectorDashboard }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<{ id: string; name: string } | null>(null);
  const lista = data.membros.filter((m) => m.mercurioAtivo && m.name.toLowerCase().includes(busca.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 p-4 dark:border-gray-800">
        <label className="relative block">
          <Search size={14} className="absolute top-3 left-3 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {lista.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <button onClick={() => setAberto({ id: m.id, name: m.name })} className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{m.name}</span>
              <span className="block text-[11px] text-gray-500 dark:text-gray-400">Matrícula #{m.registrationNo ?? "—"}</span>
            </button>
            {m.whatsapp && (
              <a href={whatsappHref(m.whatsapp)} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-[#25D366] px-2.5 py-1 text-[11px] font-semibold text-white">
                WhatsApp
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="p-4 text-[11px] text-gray-500 dark:text-gray-400">{lista.length} pessoas ativas.</p>
      {aberto && (
        <BottomSheet open onOpenChange={(o) => !o && setAberto(null)} title={aberto.name}>
          <MemberDetailPanel key={aberto.id} schoolId={schoolId} memberId={aberto.id} />
        </BottomSheet>
      )}
    </div>
  );
}
