"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { criarEvento, excluirEvento, marcarPresencaEvento } from "@/lib/actions/event-actions";
import { getFortunaBalancesForDirector, type FortunaBalancesForDirector } from "@/lib/actions/fortuna-actions";
import { formatBRL, formatDateBR, whatsappHref } from "@/lib/format";
import type { DirectorDashboard } from "@/lib/director-data";
import { EscolasticaPanel } from "@/components/escolastica/escolastica-panel";
import { EconomiaPanel } from "@/components/economia/economia-panel";
import { ArrowLeft, ArrowUpDown, BadgePercent, Banknote, CalendarClock, Coffee, FileWarning, Handshake, LayoutDashboard, Menu, Search, Ticket, Trash2, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { FortunaTab } from "./fortuna-tab";
import { MemberDetailPanel } from "./member-detail-panel";
import { QrCodeCadastroCard } from "./qr-code-cadastro-card";
import { RecuperacaoTab } from "./recuperacao-tab";
import { ContasConciliacoesTab } from "./contas-conciliacoes-tab";

const ABAS = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "membros", label: "Gestão de Membros", icon: Users },
  { id: "eventos", label: "Gestão de Eventos", icon: Ticket },
  { id: "recuperacao", label: "Recup. de Crédito", icon: Handshake },
  { id: "escolastica", label: "Escolástica", icon: CalendarClock },
  { id: "economia", label: "Economia", icon: Banknote },
  { id: "fortuna", label: "Caixa Fortuna", icon: Coffee },
  { id: "repasses", label: "Contas e Conciliações", icon: Wallet },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

const STATUS_LABEL: Record<string, string> = { em_dia: "Em Dia", atrasado: "Atrasado", negociando: "Em Negociação", isento: "Isento", inativo: "Inativo" };
const STATUS_ESTILO: Record<string, string> = {
  em_dia: "bg-na-success-light text-na-success-dark dark:bg-emerald-950/40 dark:text-emerald-400",
  atrasado: "bg-na-danger-light text-na-danger-dark dark:bg-red-950/40 dark:text-red-400",
  negociando: "bg-na-warning-light text-na-warning-dark dark:bg-amber-950/40 dark:text-amber-400",
  isento: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  inativo: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

/** Matrícula trancada/inativa no Mercúrio — não faz sentido cobrar nem mostrar "atrasado" pra quem não é mais aluno ativo, mesmo que o último status calculado antes de trancar tenha sido esse. */
function statusEfetivo(m: { status: string; mercurioAtivo: boolean }): string {
  return m.mercurioAtivo ? m.status : "inativo";
}

export function DiretorDashboard({ schoolId, schoolName, data }: { schoolId: string; schoolName: string; data: DirectorDashboard }) {
  const [aba, setAba] = useState<AbaId>("visao-geral");
  const [membrosFiltroInicial, setMembrosFiltroInicial] = useState<string>("todos");
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const abaAtual = ABAS.find((a) => a.id === aba)!;

  // Saldo Fortuna buscado à parte, no cliente — NÃO no carregamento inicial
  // de getDirectorDashboard (bug real: /diretor levava 7-9s porque isso
  // rodava em série, 1 chamada HTTP por membro vinculado, bloqueando a
  // página inteira — mesmo problema já corrigido no Portal do Membro).
  const [fortunaBalances, setFortunaBalances] = useState<FortunaBalancesForDirector>({ saldoConsolidado: 0, saldosPorMembro: [] });
  const [fortunaCarregando, setFortunaCarregando] = useState(true);

  useEffect(() => {
    getFortunaBalancesForDirector(schoolId)
      .then(setFortunaBalances)
      .finally(() => setFortunaCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navegarPara(destino: AbaId, opts?: { statusFiltro?: string }) {
    if (opts?.statusFiltro) setMembrosFiltroInicial(opts.statusFiltro);
    setAba(destino);
  }

  function selecionarAba(destino: AbaId) {
    setAba(destino);
    setMenuMobileAberto(false);
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {menuMobileAberto && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setMenuMobileAberto(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 -translate-x-full flex-col bg-slate-900 text-white transition-transform lg:static lg:translate-x-0 ${
          menuMobileAberto ? "translate-x-0" : ""
        }`}
      >
        <div className="flex flex-col items-center gap-2 border-b border-slate-700 bg-slate-950 px-5 py-6">
          <span className="text-sm font-bold text-white">Painel do Diretor</span>
          <span className="rounded-full bg-na-green px-2.5 py-0.5 text-[11px] font-semibold">{schoolName}</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => selecionarAba(a.id)}
              className={`flex w-full items-center gap-3 px-6 py-3.5 text-left text-sm font-medium transition ${
                aba === a.id ? "bg-white/10 text-na-gold" : "text-slate-300 hover:bg-white/5 hover:text-na-gold"
              }`}
            >
              <a.icon size={16} /> {a.label}
            </button>
          ))}
        </nav>
        <Link href="/voluntario" className="flex items-center gap-2 border-t border-slate-700 px-6 py-4 text-xs font-medium text-slate-400 hover:text-white">
          <ArrowLeft size={14} /> Portal do Voluntário
        </Link>
      </aside>

      <main className="flex-1 overflow-y-auto lg:ml-0">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 sm:px-8 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuMobileAberto(true)}
              aria-label="Abrir menu"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-lg font-black text-na-green-dark dark:text-emerald-400">{abaAtual.label}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Governança Financeira — {schoolName}</p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <div className="p-4 sm:p-8">
          {aba === "visao-geral" && (
            <VisaoGeralTab data={data} onNavigate={navegarPara} saldoFortunaConsolidado={fortunaBalances.saldoConsolidado} fortunaCarregando={fortunaCarregando} />
          )}
          {aba === "membros" && <MembrosTab schoolId={schoolId} data={data} filtroInicial={membrosFiltroInicial} />}
          {aba === "eventos" && <EventosTab schoolId={schoolId} data={data} />}
          {aba === "recuperacao" && <RecuperacaoTab schoolId={schoolId} data={data} />}
          {aba === "escolastica" && <EscolasticaPanel schoolId={schoolId} />}
          {aba === "economia" && <EconomiaPanel schoolId={schoolId} />}
          {aba === "fortuna" && <FortunaTab schoolId={schoolId} data={data} balances={fortunaBalances} carregando={fortunaCarregando} />}
          {aba === "repasses" && <ContasConciliacoesTab schoolId={schoolId} data={data} />}
        </div>
      </main>
    </div>
  );
}

export function KpiCard({
  title,
  value,
  sub,
  accent,
  icon: Icon,
  onClick,
}: {
  title: string;
  value: string;
  sub: string;
  accent: "green" | "danger" | "warning" | "gold" | "blue";
  icon: React.ComponentType<{ size?: number }>;
  onClick?: () => void;
}) {
  const badges: Record<string, string> = {
    green: "bg-na-green-light text-na-green dark:bg-emerald-900/40 dark:text-emerald-400",
    danger: "bg-na-danger-light text-na-danger-dark dark:bg-red-950/40 dark:text-red-400",
    warning: "bg-na-warning-light text-na-warning-dark dark:bg-amber-950/40 dark:text-amber-400",
    gold: "bg-na-gold/15 text-na-gold-dark dark:bg-na-gold/20",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border border-gray-200 bg-white p-5 text-left text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 ${
        onClick ? "cursor-pointer transition hover:border-na-gold/60 hover:shadow-md" : ""
      }`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${badges[accent]}`}>
        <Icon size={18} />
      </div>
      <p className="mt-3 text-[13px] font-semibold text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{sub}</p>
    </button>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{text}</p>;
}

function VisaoGeralTab({
  data,
  onNavigate,
  saldoFortunaConsolidado,
  fortunaCarregando,
}: {
  data: DirectorDashboard;
  onNavigate: (aba: AbaId, opts?: { statusFiltro?: string }) => void;
  saldoFortunaConsolidado: number;
  fortunaCarregando: boolean;
}) {
  const { kpis, transacoesRecentes } = data;
  const resultadoPositivo = kpis.resultadoFinanceiroMes >= 0;
  return (
    <div className="flex flex-col gap-5">
      <div
        className={`rounded-2xl border p-5 ${
          resultadoPositivo
            ? "border-na-success/30 bg-na-success-light dark:border-emerald-900 dark:bg-emerald-950/30"
            : "border-na-danger/30 bg-na-danger-light dark:border-red-900 dark:bg-red-950/30"
        }`}
      >
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Resultado Financeiro do Mês</p>
        <p className={`mt-1 text-3xl font-bold ${resultadoPositivo ? "text-na-success-dark dark:text-emerald-400" : "text-na-danger-dark dark:text-red-400"}`}>
          {formatBRL(kpis.resultadoFinanceiroMes)}
        </p>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Contribuições {formatBRL(kpis.receitaPrevista)} + Eventos {formatBRL(kpis.receitaEventosMes)} − Despesas do mês{" "}
          {formatBRL(kpis.despesasTotaisMes)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          title="Receita Prevista (Mensal)"
          value={formatBRL(kpis.receitaPrevista)}
          sub={`${kpis.membrosAtivos} membros ativos`}
          accent="green"
          icon={Wallet}
          onClick={() => onNavigate("membros")}
        />
        <KpiCard
          title="Despesas Pendentes"
          value={formatBRL(kpis.despesasPrevistas)}
          sub="Contas a pagar em aberto"
          accent="danger"
          icon={FileWarning}
          onClick={() => onNavigate("repasses")}
        />
        <KpiCard
          title="Despesas Pagas (Mês)"
          value={formatBRL(kpis.despesasRealizadasMes)}
          sub="Já pagas este mês"
          accent="blue"
          icon={FileWarning}
          onClick={() => onNavigate("repasses")}
        />
        <KpiCard
          title="Taxa de Inadimplência"
          value={`${kpis.taxaInadimplencia.toFixed(1)}%`}
          sub="dos membros ativos"
          accent="warning"
          icon={BadgePercent}
          onClick={() => onNavigate("recuperacao")}
        />
        <KpiCard
          title="Total em Atraso"
          value={formatBRL(kpis.totalEmAtraso)}
          sub="Soma da composição de quem está atrasado"
          accent="gold"
          icon={Handshake}
          onClick={() => onNavigate("membros", { statusFiltro: "atrasado" })}
        />
        <KpiCard
          title="Saldo Fortuna Consolidado"
          value={fortunaCarregando ? "..." : formatBRL(saldoFortunaConsolidado)}
          sub="Membros vinculados ao Fortuna"
          accent="blue"
          icon={Coffee}
          onClick={() => onNavigate("fortuna")}
        />
      </div>

      <QrCodeCadastroCard />

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-black text-na-green-dark dark:text-emerald-400">Últimos Pagamentos PIX Confirmados</h3>
        {transacoesRecentes.length === 0 ? (
          <EmptyState text="Nenhum pagamento confirmado pelo Portal ainda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <th className="border-b border-gray-100 pb-2 dark:border-gray-800">Membro</th>
                  <th className="border-b border-gray-100 pb-2 dark:border-gray-800">Tipo</th>
                  <th className="border-b border-gray-100 pb-2 dark:border-gray-800">Data</th>
                  <th className="border-b border-gray-100 pb-2 dark:border-gray-800">Valor</th>
                </tr>
              </thead>
              <tbody>
                {transacoesRecentes.map((t) => (
                  <tr key={t.id}>
                    <td className="border-b border-gray-100 py-2.5 font-medium whitespace-nowrap dark:border-gray-800">{t.memberName}</td>
                    <td className="border-b border-gray-100 py-2.5 whitespace-nowrap text-gray-500 dark:border-gray-800 dark:text-gray-400">
                      {t.tipo === "recarga_fortuna" ? "Recarga Fortuna" : "Contribuição"}
                    </td>
                    <td className="border-b border-gray-100 py-2.5 whitespace-nowrap text-gray-500 dark:border-gray-800 dark:text-gray-400">{formatDateBR(t.paidAt)}</td>
                    <td className="border-b border-gray-100 py-2.5 font-semibold whitespace-nowrap text-na-green dark:border-gray-800 dark:text-emerald-400">{formatBRL(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

type OrdenacaoMembros = "nome" | "status" | "valor" | "atrasadas";

function CabecalhoOrdenavel({
  campo,
  label,
  className,
  ordenarPor,
  onClick,
}: {
  campo: OrdenacaoMembros;
  label: string;
  className?: string;
  ordenarPor: OrdenacaoMembros;
  onClick: () => void;
}) {
  return (
    <th className={className}>
      <button onClick={onClick} className="inline-flex items-center gap-1 text-gray-500 hover:text-na-green-dark dark:text-gray-400 dark:hover:text-emerald-400">
        {label} <ArrowUpDown size={11} className={ordenarPor === campo ? "opacity-100" : "opacity-30"} />
      </button>
    </th>
  );
}

function MembrosTab({ schoolId, data, filtroInicial }: { schoolId: string; data: DirectorDashboard; filtroInicial?: string }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(filtroInicial ?? "todos");
  const [composicaoFiltro, setComposicaoFiltro] = useState<string>("todas");
  const [ordenarPor, setOrdenarPor] = useState<OrdenacaoMembros>("nome");
  const [ordemAsc, setOrdemAsc] = useState(true);
  const [membroSelecionado, setMembroSelecionado] = useState<{ id: string; name: string } | null>(null);

  const composicoesDisponiveis = Array.from(new Set(data.membros.flatMap((m) => m.compositionLabels))).sort();

  const filtrados = data.membros
    .filter((m) => m.name.toLowerCase().includes(busca.toLowerCase()))
    .filter((m) => statusFiltro === "todos" || statusEfetivo(m) === statusFiltro)
    .filter((m) => composicaoFiltro === "todas" || m.compositionLabels.includes(composicaoFiltro))
    .sort((a, b) => {
      let cmp = 0;
      if (ordenarPor === "nome") cmp = a.name.localeCompare(b.name, "pt-BR");
      else if (ordenarPor === "status") cmp = statusEfetivo(a).localeCompare(statusEfetivo(b));
      else if (ordenarPor === "valor") cmp = a.compositionTotal - b.compositionTotal;
      else if (ordenarPor === "atrasadas") cmp = a.overdueCount - b.overdueCount;
      if (cmp === 0 && ordenarPor !== "atrasadas") cmp = b.overdueCount - a.overdueCount; // empate: quem tem mais atraso aparece primeiro
      return ordemAsc ? cmp : -cmp;
    });

  function alternarOrdenacao(campo: OrdenacaoMembros) {
    if (ordenarPor === campo) setOrdemAsc((asc) => !asc);
    else {
      setOrdenarPor(campo);
      setOrdemAsc(true);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute top-3 left-3 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="todos" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
            Todos os status
          </option>
          {Object.entries(STATUS_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
              {label}
            </option>
          ))}
        </select>
        <select
          value={composicaoFiltro}
          onChange={(e) => setComposicaoFiltro(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="todas" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
            Todas as composições
          </option>
          {composicoesDisponiveis.map((c) => (
            <option key={c} value={c} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              <CabecalhoOrdenavel campo="nome" label="Membro" className="px-5 py-3" ordenarPor={ordenarPor} onClick={() => alternarOrdenacao("nome")} />
              <th className="py-3">Composição</th>
              <CabecalhoOrdenavel campo="valor" label="Valor Total" className="py-3" ordenarPor={ordenarPor} onClick={() => alternarOrdenacao("valor")} />
              <CabecalhoOrdenavel campo="status" label="Status" className="py-3" ordenarPor={ordenarPor} onClick={() => alternarOrdenacao("status")} />
              <CabecalhoOrdenavel campo="atrasadas" label="Atrasadas" className="py-3" ordenarPor={ordenarPor} onClick={() => alternarOrdenacao("atrasadas")} />
              <th className="px-5 py-3 text-center">Contato</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((m) => (
              <tr
                key={m.id}
                onClick={() => setMembroSelecionado({ id: m.id, name: m.name })}
                className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- vem do Supabase Storage, não é um asset local
                        <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">{m.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="whitespace-nowrap">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{m.name}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">Matrícula: #{m.registrationNo ?? "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {m.compositionLabels.length === 0 ? (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">—</span>
                    ) : (
                      m.compositionLabels.map((l, i) => (
                        <span key={i} className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[9px] whitespace-nowrap text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                          {l}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="py-3 font-semibold whitespace-nowrap text-gray-900 dark:text-gray-100">{formatBRL(m.compositionTotal)}</td>
                <td className="py-3">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold whitespace-nowrap uppercase ${STATUS_ESTILO[statusEfetivo(m)] ?? STATUS_ESTILO.em_dia}`}>
                    {STATUS_LABEL[statusEfetivo(m)] ?? statusEfetivo(m)}
                  </span>
                </td>
                <td className="py-3">
                  {m.overdueCount > 0 ? (
                    <span className="font-semibold text-na-danger dark:text-red-400">{m.overdueCount}x</span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  <a
                    href={whatsappHref(m.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-white"
                  >
                    WhatsApp
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {membroSelecionado && (
        <BottomSheet open onOpenChange={(open) => !open && setMembroSelecionado(null)} title={membroSelecionado.name}>
          <MemberDetailPanel key={membroSelecionado.id} schoolId={schoolId} memberId={membroSelecionado.id} />
        </BottomSheet>
      )}
      <p className="p-5 text-[11px] text-gray-500 dark:text-gray-400">
        Exibindo {filtrados.length} de {data.membros.length} membros.
      </p>
    </div>
  );
}

function EventosTab({ schoolId, data }: { schoolId: string; data: DirectorDashboard }) {
  const [isPending, startTransition] = useTransition();

  function handleCriarEvento(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    const startsAt = String(formData.get("startsAt") ?? "");
    const price = Number(formData.get("price") ?? 0);
    if (!title || !startsAt) return;
    startTransition(() => criarEvento(schoolId, title, startsAt, price));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-black text-na-green-dark dark:text-emerald-400">Novo Evento</h3>
        <form action={handleCriarEvento} className="flex flex-wrap items-end gap-2">
          <input name="title" placeholder="Título do evento" required className="min-w-[180px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <input name="startsAt" type="datetime-local" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <input name="price" type="number" step="0.01" min="0" placeholder="Preço (0 = grátis)" className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <button type="submit" disabled={isPending} className="rounded-lg bg-na-green px-3 py-2 text-sm font-semibold text-white hover:bg-na-green-dark disabled:opacity-60">
            + Evento
          </button>
        </form>
      </div>

      {data.eventos.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <Ticket size={28} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum evento cadastrado ainda.</p>
        </div>
      ) : (
        data.eventos.map((e) => (
          <div key={e.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-na-green-dark dark:text-emerald-400">{e.title}</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {formatDateBR(e.startsAt)} {e.price > 0 && `· ${formatBRL(e.price)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {e.presentes}/{e.inscritos} presentes
                </span>
                <button
                  onClick={() => confirm(`Excluir "${e.title}"? Isso também remove as inscrições.`) && startTransition(() => excluirEvento(schoolId, e.id))}
                  disabled={isPending}
                  className="text-gray-400 hover:text-na-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {e.registrations.length === 0 ? (
              <EmptyState text="Nenhuma inscrição ainda." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {e.registrations.map((r) => (
                      <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-2 font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">{r.memberName}</td>
                        <td className="py-2 text-right">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${r.paid ? "bg-na-success-light text-na-success-dark" : "bg-na-warning-light text-na-warning-dark"}`}>
                            {r.paid ? "Pago" : "Pendente"}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => startTransition(() => marcarPresencaEvento(schoolId, r.id, !r.checkedIn))}
                            disabled={isPending}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${r.checkedIn ? "bg-na-success-light text-na-success-dark" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                          >
                            {r.checkedIn ? "Presente" : "Marcar presença"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

