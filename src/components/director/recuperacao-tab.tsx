"use client";

import {
  abrirNegociacao,
  aprovarEEnviarRascunho,
  createChargeTrigger,
  createChargingRule,
  descartarRascunho,
  gerarRascunhosDeCobranca,
  resolverNegociacao,
  toggleChargeTrigger,
} from "@/lib/actions/charging-actions";
import { CHARGE_TRIGGER_LABEL } from "@/lib/charging-labels";
import type { DirectorDashboard, MemberRow } from "@/lib/director-data";
import { formatBRL, formatDateBR } from "@/lib/format";
import type { ChargeTriggerType } from "@prisma/client";
import { CircleCheck, Loader2, Send, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { EmptyState } from "./diretor-dashboard";

const TIPOS_GATILHO = Object.keys(CHARGE_TRIGGER_LABEL);

// Mesma granularidade dos gatilhos "1 mês / 2+ meses" da régua de cobrança
// (ver charging-labels.ts), só que quebrando o "2+" em colunas pra dar mais
// sinal visual de urgência num kanban — pedido do usuário 2026-09-22: trocar
// o dropdown de seleção de membro por um kanban organizado por quantidade
// de contribuições em atraso.
const COLUNAS_ATRASO = [
  { min: 1, max: 1, label: "1 mês em atraso" },
  { min: 2, max: 2, label: "2 meses em atraso" },
  { min: 3, max: 3, label: "3 meses em atraso" },
  { min: 4, max: Infinity, label: "4+ meses em atraso" },
];

export function RecuperacaoTab({ schoolId, data }: { schoolId: string; data: DirectorDashboard }) {
  const [isPending, startTransition] = useTransition();
  const [nomeRegua, setNomeRegua] = useState("");
  const [gerarResultado, setGerarResultado] = useState<string | null>(null);
  const [rascunhosEditados, setRascunhosEditados] = useState<Record<string, string>>({});
  const [negMemberId, setNegMemberId] = useState("");
  const [negNota, setNegNota] = useState("");
  const [negData, setNegData] = useState("");

  function handleCriarRegua(formData: FormData) {
    const nome = String(formData.get("nome") ?? "").trim();
    if (!nome) return;
    startTransition(async () => {
      await createChargingRule(schoolId, nome);
      setNomeRegua("");
    });
  }

  function handleCriarGatilho(chargingRuleId: string, formData: FormData) {
    const type = String(formData.get("type") ?? "");
    const messageTemplate = String(formData.get("messageTemplate") ?? "").trim();
    if (!type || !messageTemplate) return;
    startTransition(() => createChargeTrigger(schoolId, chargingRuleId, type as ChargeTriggerType, messageTemplate));
  }

  function handleGerarRascunhos() {
    startTransition(async () => {
      const { criados } = await gerarRascunhosDeCobranca(schoolId);
      setGerarResultado(criados === 0 ? "Nenhum rascunho novo — nada que já não estivesse gerado neste ciclo." : `${criados} rascunho(s) novo(s) gerado(s).`);
    });
  }

  function handleAbrirNegociacao() {
    if (!negMemberId || !negNota.trim()) return;
    startTransition(async () => {
      await abrirNegociacao(schoolId, negMemberId, negNota, negData || undefined);
      setNegMemberId("");
      setNegNota("");
      setNegData("");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-na-green-dark dark:text-emerald-400">Réguas de Cobrança</h3>
          <button
            onClick={handleGerarRascunhos}
            disabled={isPending}
            className="rounded-lg bg-na-green px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
          >
            Gerar rascunhos (réguas ativas)
          </button>
        </div>
        <p className="mb-4 text-[11px] text-gray-500 dark:text-gray-400">
          Gera 1 rascunho por membro × gatilho ativo. O gatilho <strong>Dia 10</strong> mira quem ainda não pagou o mês atual — inclui quem está
          &quot;Em Dia&quot; (sem atraso no histórico), não só quem já está atrasado. Os gatilhos de atraso (1 mês / 2+ meses) só miram quem já está
          Atrasado/Em Negociação. Mensagens ficam pendentes de aprovação manual antes de enviar — nenhum disparo automático real. Placeholders no
          modelo:{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{"{{nome}}"}</code>,{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{"{{valor}}"}</code> (valor mensal da composição),{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{"{{valorAtraso}}"}</code> (valor × meses em atraso),{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{"{{mesesAtraso}}"}</code>.
        </p>
        {gerarResultado && <p className="mb-3 text-[11px] font-medium text-na-green-dark dark:text-emerald-400">{gerarResultado}</p>}

        {data.regrasDeCobranca.length === 0 ? (
          <EmptyState text="Nenhuma régua de cobrança cadastrada ainda." />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.regrasDeCobranca.map((r) => (
              <li key={r.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <span className="font-medium text-gray-900 dark:text-gray-100">{r.name}</span>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {r.triggers.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-2 rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-800">
                      <div>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{CHARGE_TRIGGER_LABEL[t.type] ?? t.type}</span>
                        <p className="mt-0.5 text-gray-500 dark:text-gray-400">{t.messageTemplate}</p>
                      </div>
                      <button
                        onClick={() => startTransition(() => toggleChargeTrigger(schoolId, t.id, !t.active))}
                        className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${
                          t.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {t.active ? "Ativo" : "Inativo"}
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  action={(fd) => handleCriarGatilho(r.id, fd)}
                  className="mt-2 flex flex-wrap items-start gap-2 border-t border-gray-100 pt-2 dark:border-gray-800"
                >
                  <select name="type" className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                    {TIPOS_GATILHO.map((t) => (
                      <option key={t} value={t} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                        {CHARGE_TRIGGER_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <input
                    name="messageTemplate"
                    placeholder="Modelo da mensagem..."
                    className="min-w-[220px] flex-1 rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button type="submit" className="rounded bg-gray-800 px-2 py-1 text-[11px] font-semibold text-white dark:bg-gray-700">
                    + Gatilho
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={handleCriarRegua} className="mt-4 flex gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          <input
            name="nome"
            value={nomeRegua}
            onChange={(e) => setNomeRegua(e.target.value)}
            placeholder="Nome da nova régua (ex: Régua Padrão)"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button type="submit" disabled={isPending} className="rounded-lg bg-na-green px-3 py-2 text-sm font-semibold text-white hover:bg-na-green-dark disabled:opacity-60">
            Criar régua
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-1 text-sm font-bold text-na-green-dark dark:text-emerald-400">Fila de Aprovação</h3>
        <p className="mb-4 text-[11px] text-gray-500 dark:text-gray-400">Revise e edite antes de enviar — nada sai sem essa aprovação.</p>
        {data.rascunhosPendentes.length === 0 ? (
          <EmptyState text="Nenhum rascunho pendente." />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.rascunhosPendentes.map((d) => (
              <li key={d.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{d.memberName}</span>
                  <span className="text-gray-500 dark:text-gray-400">{CHARGE_TRIGGER_LABEL[d.triggerType] ?? d.triggerType}</span>
                </div>
                <textarea
                  defaultValue={d.body}
                  onChange={(e) => setRascunhosEditados((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 p-2 text-[13px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => startTransition(() => descartarRascunho(schoolId, d.id))}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <Trash2 size={12} /> Descartar
                  </button>
                  <button
                    onClick={() => startTransition(() => aprovarEEnviarRascunho(schoolId, d.id, rascunhosEditados[d.id]))}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-na-green px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
                  >
                    {isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Aprovar e Enviar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-1 text-sm font-bold text-na-green-dark dark:text-emerald-400">Atrasados por Tempo de Atraso</h3>
        <p className="mb-4 text-[11px] text-gray-500 dark:text-gray-400">
          Só matrículas ativas no Mercúrio (quem trancou não aparece aqui). Clique num card pra abrir uma negociação.
        </p>
        <NegociacaoKanban
          membros={data.membros}
          negMemberId={negMemberId}
          negNota={negNota}
          negData={negData}
          isPending={isPending}
          onSelecionar={setNegMemberId}
          onNotaChange={setNegNota}
          onDataChange={setNegData}
          onAbrir={handleAbrirNegociacao}
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-bold text-na-green-dark dark:text-emerald-400">Em Negociação</h3>
        {data.negociacoesAbertas.length === 0 ? (
          <EmptyState text="Nenhuma negociação em aberto." />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.negociacoesAbertas.map((n) => (
              <li key={n.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{n.memberName}</span>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {n.notes} {n.promisedPaymentDate && `— promessa: ${formatDateBR(n.promisedPaymentDate)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => startTransition(() => resolverNegociacao(schoolId, n.id, "em_dia"))}
                    className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  >
                    <CircleCheck size={12} /> Pagou
                  </button>
                  <button
                    onClick={() => startTransition(() => resolverNegociacao(schoolId, n.id, "atrasado"))}
                    className="rounded bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400"
                  >
                    Não cumpriu
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Antecipação de recebíveis (factoring) não faz parte desta versão.</p>
      </div>
    </div>
  );
}

/**
 * Kanban por quantidade de meses em atraso (decisão do usuário 2026-09-22:
 * substitui o dropdown plano que existia antes — mais fácil de ver quem
 * precisa de atenção urgente vs. quem está só 1 mês atrasado). Só mostra
 * quem já está "atrasado" de verdade (não "negociando" — esses já aparecem
 * na lista "Em Negociação" logo abaixo, evita duplicar a mesma pessoa nos
 * dois lugares) E com matrícula ativa no Mercúrio (mesmo bug de mostrar
 * quem trancou como atrasado já corrigido em Gestão de Membros/Visão
 * Geral, faltava aqui).
 */
function NegociacaoKanban({
  membros,
  negMemberId,
  negNota,
  negData,
  isPending,
  onSelecionar,
  onNotaChange,
  onDataChange,
  onAbrir,
}: {
  membros: MemberRow[];
  negMemberId: string;
  negNota: string;
  negData: string;
  isPending: boolean;
  onSelecionar: (id: string) => void;
  onNotaChange: (v: string) => void;
  onDataChange: (v: string) => void;
  onAbrir: () => void;
}) {
  const atrasados = membros.filter((m) => m.mercurioAtivo && m.status === "atrasado" && m.overdueCount > 0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {COLUNAS_ATRASO.map((col) => {
        const membrosColuna = atrasados
          .filter((m) => m.overdueCount >= col.min && m.overdueCount <= col.max)
          .sort((a, b) => b.overdueCount - a.overdueCount || a.name.localeCompare(b.name));
        return (
          <div key={col.label} className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
            <div className="flex items-center justify-between px-0.5">
              <h4 className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{col.label}</h4>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {membrosColuna.length}
              </span>
            </div>
            {membrosColuna.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-gray-400 dark:text-gray-500">Ninguém aqui.</p>
            ) : (
              membrosColuna.map((m) => (
                <div key={m.id} className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900">
                  <p className="text-[12px] font-medium text-gray-900 dark:text-gray-100">{m.name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatBRL(m.compositionTotal * m.overdueCount)} em atraso</p>

                  {negMemberId === m.id ? (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <input
                        value={negNota}
                        onChange={(e) => onNotaChange(e.target.value)}
                        placeholder="Nota da negociação..."
                        className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        autoFocus
                      />
                      <input
                        type="date"
                        value={negData}
                        onChange={(e) => onDataChange(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={onAbrir}
                          disabled={isPending || !negNota.trim()}
                          className="flex-1 rounded bg-na-green px-2 py-1 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
                        >
                          Registrar
                        </button>
                        <button
                          onClick={() => onSelecionar("")}
                          className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => onSelecionar(m.id)}
                      className="mt-2 text-[11px] font-semibold text-na-green hover:underline dark:text-emerald-400"
                    >
                      Abrir negociação
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
