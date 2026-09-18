"use client";

import { formatBRL, formatDateBR } from "@/lib/format";
import type { DirectorDashboard } from "@/lib/director-data";
import {
  ArrowLeft,
  BadgePercent,
  ClipboardList,
  Coffee,
  FileWarning,
  Handshake,
  LayoutDashboard,
  Search,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const ABAS = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "membros", label: "Gestão de Membros", icon: Users },
  { id: "eventos", label: "Gestão de Eventos", icon: Ticket },
  { id: "recuperacao", label: "Recup. de Crédito", icon: Handshake },
  { id: "fortuna", label: "Caixa Fortuna", icon: Coffee },
  { id: "repasses", label: "Contas e Repasses", icon: Wallet },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

const STATUS_LABEL: Record<string, string> = { em_dia: "Em Dia", atrasado: "Atrasado", negociando: "Em Negociação", isento: "Isento" };
const STATUS_ESTILO: Record<string, string> = {
  em_dia: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  atrasado: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400",
  negociando: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  isento: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function DiretorDashboard({ schoolName, data }: { schoolName: string; data: DirectorDashboard }) {
  const [aba, setAba] = useState<AbaId>("visao-geral");
  const abaAtual = ABAS.find((a) => a.id === aba)!;

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="flex w-64 shrink-0 flex-col bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-2 border-b border-slate-700 bg-slate-950 px-5 py-6">
          <span className="text-sm font-bold text-white">Painel do Diretor</span>
          <span className="rounded-full bg-na-green px-2.5 py-0.5 text-[11px] font-semibold">{schoolName}</span>
        </div>
        <nav className="flex-1 py-4">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`flex w-full items-center gap-3 border-l-4 px-6 py-3.5 text-left text-sm font-medium transition ${
                aba === a.id ? "border-na-gold bg-white/5 text-na-gold" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-na-gold"
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

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h2 className="text-lg font-bold text-na-green-dark dark:text-emerald-400">{abaAtual.label}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Governança Financeira — {schoolName}</p>
          </div>
        </header>

        <div className="p-8">
          {aba === "visao-geral" && <VisaoGeralTab data={data} />}
          {aba === "membros" && <MembrosTab data={data} />}
          {aba === "eventos" && <EventosTab data={data} />}
          {aba === "recuperacao" && <RecuperacaoTab data={data} />}
          {aba === "fortuna" && <FortunaTab data={data} />}
          {aba === "repasses" && <RepassesTab data={data} />}
        </div>
      </main>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  title: string;
  value: string;
  sub: string;
  accent: "green" | "danger" | "warning" | "gold" | "blue";
  icon: React.ComponentType<{ size?: number }>;
}) {
  const bordas: Record<string, string> = {
    green: "before:bg-na-green",
    danger: "before:bg-red-500",
    warning: "before:bg-amber-500",
    gold: "before:bg-na-gold",
    blue: "before:bg-blue-500",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 before:absolute before:top-0 before:left-0 before:h-full before:w-1 dark:border-gray-800 dark:bg-gray-900 ${bordas[accent]}`}
    >
      <Icon size={20} />
      <p className="mt-3 text-[13px] font-semibold text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">{sub}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">{text}</p>;
}

function VisaoGeralTab({ data }: { data: DirectorDashboard }) {
  const { kpis, transacoesRecentes } = data;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-5 gap-4">
        <KpiCard title="Receita Prevista (Mensal)" value={formatBRL(kpis.receitaPrevista)} sub={`${kpis.membrosAtivos} membros ativos`} accent="green" icon={Wallet} />
        <KpiCard title="Despesas Pendentes" value={formatBRL(kpis.despesasPrevistas)} sub="Contas a pagar em aberto" accent="danger" icon={FileWarning} />
        <KpiCard title="Taxa de Inadimplência" value={`${kpis.taxaInadimplencia.toFixed(1)}%`} sub="dos membros ativos" accent="warning" icon={BadgePercent} />
        <KpiCard title="Total em Atraso" value={formatBRL(kpis.totalEmAtraso)} sub="Soma da composição de quem está atrasado" accent="gold" icon={Handshake} />
        <KpiCard title="Saldo Fortuna Consolidado" value={formatBRL(kpis.saldoFortunaConsolidado)} sub="Membros vinculados ao Fortuna" accent="blue" icon={Coffee} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-bold text-na-green-dark dark:text-emerald-400">Últimos Pagamentos PIX Confirmados</h3>
        {transacoesRecentes.length === 0 ? (
          <EmptyState text="Nenhum pagamento confirmado pelo Portal ainda." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] font-semibold text-gray-400">
                <th className="border-b border-gray-100 pb-2 dark:border-gray-800">Membro</th>
                <th className="border-b border-gray-100 pb-2 dark:border-gray-800">Data</th>
                <th className="border-b border-gray-100 pb-2 dark:border-gray-800">Valor</th>
              </tr>
            </thead>
            <tbody>
              {transacoesRecentes.map((t) => (
                <tr key={t.id}>
                  <td className="border-b border-gray-100 py-2.5 font-medium dark:border-gray-800">{t.memberName}</td>
                  <td className="border-b border-gray-100 py-2.5 text-gray-500 dark:border-gray-800 dark:text-gray-400">{formatDateBR(t.paidAt)}</td>
                  <td className="border-b border-gray-100 py-2.5 font-semibold text-na-green dark:border-gray-800 dark:text-emerald-400">{formatBRL(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MembrosTab({ data }: { data: DirectorDashboard }) {
  const [busca, setBusca] = useState("");
  const filtrados = data.membros.filter((m) => m.name.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 p-5 dark:border-gray-800">
        <div className="relative">
          <Search size={14} className="absolute top-3 left-3 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 text-sm dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[11px] font-semibold text-gray-400">
            <th className="px-5 py-3">Membro</th>
            <th className="py-3">Composição</th>
            <th className="py-3">Valor Total</th>
            <th className="py-3">Status</th>
            <th className="px-5 py-3 text-center">Contato</th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((m) => (
            <tr key={m.id} className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-5 py-3">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{m.name}</div>
                <div className="text-[10px] text-gray-400">Matrícula: #{m.registrationNo ?? "—"}</div>
              </td>
              <td className="py-3">
                <div className="flex flex-wrap gap-1">
                  {m.compositionLabels.length === 0 ? (
                    <span className="text-[10px] text-gray-400">—</span>
                  ) : (
                    m.compositionLabels.map((l, i) => (
                      <span key={i} className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[9px] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                        {l}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td className="py-3 font-semibold">{formatBRL(m.compositionTotal)}</td>
              <td className="py-3">
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_ESTILO[m.status] ?? STATUS_ESTILO.em_dia}`}>
                  {STATUS_LABEL[m.status] ?? m.status}
                </span>
              </td>
              <td className="px-5 py-3 text-center">
                <a
                  href={`https://wa.me/${m.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1 text-[11px] font-semibold text-white"
                >
                  WhatsApp
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="p-5 text-[11px] text-gray-400">
        Exibindo {filtrados.length} de {data.membros.length} membros.
      </p>
    </div>
  );
}

function EventosTab({ data }: { data: DirectorDashboard }) {
  if (data.eventos.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <Ticket size={28} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum evento com inscrições registradas ainda.</p>
        <p className="mt-1 text-[11px] text-gray-400">
          Controle de portaria (check-in) e inscrição na recepção com PIX na hora ainda não foram construídos — esta aba já mostra dados reais quando existirem.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.eventos.map((e) => (
        <div key={e.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-na-green-dark dark:text-emerald-400">{e.title}</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{formatDateBR(e.startsAt)}</p>
            </div>
            <div className="text-right text-xs text-gray-500 dark:text-gray-400">
              {e.presentes}/{e.inscritos} presentes
            </div>
          </div>
          <table className="w-full text-left text-xs">
            <tbody>
              {e.registrations.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-2 font-medium">{r.memberName}</td>
                  <td className="py-2 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {r.paid ? "Pago" : "Pendente"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.checkedIn ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {r.checkedIn ? "Presente" : "Aguardando"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function RecuperacaoTab({ data }: { data: DirectorDashboard }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-1 text-sm font-bold text-na-green-dark dark:text-emerald-400">Réguas de Cobrança</h3>
        <p className="mb-4 text-[11px] text-gray-500 dark:text-gray-400">
          O modelo de dados já existe (ChargingRule), mas o construtor visual e o disparo automático de mensagens ainda não foram construídos.
        </p>
        {data.regrasDeCobranca.length === 0 ? (
          <EmptyState text="Nenhuma régua de cobrança cadastrada ainda." />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.regrasDeCobranca.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
                <span className="font-medium">{r.name}</span>
                <span className="text-[11px] text-gray-400">{r.triggers} gatilho(s)</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
        <ClipboardList size={24} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          CRM de negociação e antecipação de recebíveis (factoring) ainda não existem no sistema — não fazem parte desta versão.
        </p>
      </div>
    </div>
  );
}

function FortunaTab({ data }: { data: DirectorDashboard }) {
  return (
    <div className="flex flex-col gap-5">
      <KpiCard
        title="Saldo Consolidado (membros vinculados ao Fortuna)"
        value={formatBRL(data.kpis.saldoFortunaConsolidado)}
        sub="Lido em tempo real da API do Fortuna"
        accent="gold"
        icon={Coffee}
      />
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-bold text-na-green-dark dark:text-emerald-400">Movimentações Recentes</h3>
        {data.fortunaTransacoes.length === 0 ? (
          <EmptyState text="Nenhuma movimentação Fortuna registrada localmente ainda." />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.fortunaTransacoes.map((t, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
                <span className="font-medium">{t.memberName}</span>
                <span className={`font-semibold ${t.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {formatBRL(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RepassesTab({ data }: { data: DirectorDashboard }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 p-5 dark:border-gray-800">
        <h3 className="text-sm font-bold text-na-green-dark dark:text-emerald-400">Contas a Pagar (em aberto)</h3>
      </div>
      {data.despesasPendentes.length === 0 ? (
        <div className="p-8">
          <EmptyState text="Nenhuma conta a pagar cadastrada." />
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] font-semibold text-gray-400">
              <th className="px-5 py-3">Fornecedor</th>
              <th className="py-3">Vencimento</th>
              <th className="py-3">Valor</th>
              <th className="px-5 py-3">Nota Fiscal</th>
            </tr>
          </thead>
          <tbody>
            {data.despesasPendentes.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-5 py-3 font-medium">{p.vendor}</td>
                <td className="py-3 text-gray-500 dark:text-gray-400">{formatDateBR(p.dueDate)}</td>
                <td className="py-3 font-semibold">{formatBRL(p.amount)}</td>
                <td className="px-5 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${p.hasInvoice ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {p.hasInvoice ? "OK" : "Pendente"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="p-5 text-[11px] text-gray-400">
        Repasses/malote contábil (upload de NF, aprovação bancária, compliance) ainda não foram construídos.
      </p>
    </div>
  );
}
