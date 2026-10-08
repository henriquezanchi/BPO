"use client";

import {
  aprovarSolicitacaoCadastro,
  concluirPendenciaEscolastica,
  criarPendenciaEscolastica,
  getMembrosParaPendencia,
  getPendenciasEscolastica,
  getSolicitacoesCadastroPendentes,
  rejeitarSolicitacaoCadastro,
} from "@/lib/actions/escolastica-actions";
import { formatDateBR } from "@/lib/format";
import { Check, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

const TIPOS = [
  { value: "inclusao_circulo_amigos", label: "Incluir no Círculo de Amigos" },
  { value: "baixa_membro", label: "Dar baixa como membro" },
  { value: "outro", label: "Outro" },
];

const LABEL_CAMPO: Record<string, string> = { whatsapp: "WhatsApp", email: "E-mail" };

type Pendencia = Awaited<ReturnType<typeof getPendenciasEscolastica>>[number];
type MembroOpcao = Awaited<ReturnType<typeof getMembrosParaPendencia>>[number];
type SolicitacaoCadastro = Awaited<ReturnType<typeof getSolicitacoesCadastroPendentes>>[number];

/**
 * Agenda de pendências do Secretário de Escolástica (ou Direção, enquanto
 * ninguém tiver esse cargo no Mercúrio — ver requireEscolasticaOuDirecao).
 * Conclusão é MANUAL: a pessoa vai no Mercúrio executar a ação (dar baixa,
 * incluir no Círculo de Amigos etc) e só depois marca aqui como feito — não
 * automatizamos a execução em si porque não achamos, explorando ao vivo, a
 * tela do Mercúrio que faz isso (as telas óbvias — ficha do aluno, lista de
 * C. de Amigos — não têm essa ação pro nível de acesso do usuário do BPO).
 */
export function EscolasticaPanel({ schoolId }: { schoolId: string }) {
  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCadastro[] | null>(null);
  const [membros, setMembros] = useState<MembroOpcao[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function recarregar() {
    getPendenciasEscolastica(schoolId).then(setPendencias);
    getSolicitacoesCadastroPendentes(schoolId).then(setSolicitacoes);
  }

  useEffect(() => {
    recarregar();
    getMembrosParaPendencia(schoolId).then(setMembros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  function handleAprovar(logId: string) {
    startTransition(async () => {
      await aprovarSolicitacaoCadastro(schoolId, logId);
      recarregar();
    });
  }

  function handleRejeitar(logId: string) {
    startTransition(async () => {
      await rejeitarSolicitacaoCadastro(schoolId, logId);
      recarregar();
    });
  }

  function handleCriar(formData: FormData) {
    startTransition(async () => {
      await criarPendenciaEscolastica(schoolId, {
        memberId: String(formData.get("memberId") || "") || null,
        tipo: String(formData.get("tipo") || "outro"),
        title: String(formData.get("title") || ""),
        notes: String(formData.get("notes") || ""),
        dueDate: String(formData.get("dueDate") || ""),
      });
      setMostrarForm(false);
      recarregar();
    });
  }

  function handleConcluir(id: string) {
    startTransition(async () => {
      await concluirPendenciaEscolastica(schoolId, id);
      recarregar();
    });
  }

  if (!pendencias || !solicitacoes) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const abertas = pendencias.filter((p) => !p.completedAt).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const concluidas = pendencias.filter((p) => p.completedAt);
  const hoje = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          Solicitações de correção de cadastro ({solicitacoes.length})
        </p>
        {solicitacoes.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma solicitação pendente.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {solicitacoes.map((s) => {
              const oldValues = s.oldValues as Record<string, string | null>;
              const newValues = s.newValues as Record<string, string>;
              return (
                <div key={s.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{s.member.name}</p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {Object.keys(newValues).map((campo) => (
                      <li key={campo} className="text-[11px] text-gray-700 dark:text-gray-300">
                        {LABEL_CAMPO[campo] ?? campo}: <span className="text-gray-400 line-through">{oldValues[campo] || "—"}</span>{" "}
                        → <span className="font-semibold">{newValues[campo]}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[10px] text-gray-400">Solicitado em {formatDateBR(s.createdAt)}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleAprovar(s.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-na-green px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
                    >
                      <Check size={12} /> Aprovar
                    </button>
                    <button
                      onClick={() => handleRejeitar(s.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <X size={12} /> Rejeitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Lembretes de ações a fazer no Mercúrio (ex: transições pro Círculo de Amigos) — marcar como feito é manual, depois de você mesmo executar a ação lá.
        </p>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-na-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-na-green-dark"
        >
          <Plus size={14} /> Nova pendência
        </button>
      </div>

      {mostrarForm && (
        <form action={handleCriar} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 text-[13px] dark:border-gray-700">
          <select name="memberId" defaultValue="" className="rounded-lg border border-gray-300 p-2 dark:border-gray-700 dark:bg-gray-800">
            <option value="">Sem membro específico</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select name="tipo" defaultValue="inclusao_circulo_amigos" className="rounded-lg border border-gray-300 p-2 dark:border-gray-700 dark:bg-gray-800">
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            name="title"
            required
            placeholder="Descrição (ex: Incluir Glaubia Rocha Barbosa Relvas no Círculo de Amigos)"
            className="rounded-lg border border-gray-300 p-2 dark:border-gray-700 dark:bg-gray-800"
          />
          <input name="dueDate" type="date" required className="rounded-lg border border-gray-300 p-2 dark:border-gray-700 dark:bg-gray-800" />
          <textarea name="notes" rows={2} placeholder="Observações (opcional)" className="rounded-lg border border-gray-300 p-2 dark:border-gray-700 dark:bg-gray-800" />
          <button type="submit" disabled={isPending} className="self-end rounded-lg bg-na-green px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {isPending ? <Loader2 size={14} className="animate-spin" /> : "Agendar"}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {abertas.length === 0 && <p className="text-xs text-gray-400">Nenhuma pendência em aberto.</p>}
        {abertas.map((p) => {
          const atrasada = p.dueDate < hoje;
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-[13px] ${
                atrasada ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{p.title}</p>
                <p className={`text-[11px] ${atrasada ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                  Previsto: {formatDateBR(p.dueDate)} {p.member && `· ${p.member.name}`} {atrasada && "· ATRASADA"}
                </p>
                {p.notes && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{p.notes}</p>}
              </div>
              <button
                onClick={() => handleConcluir(p.id)}
                disabled={isPending}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <CheckCircle2 size={12} /> Marcar como feito
              </button>
            </div>
          );
        })}
      </div>

      {concluidas.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
          <p className="text-[11px] font-semibold text-gray-400">Concluídas</p>
          {concluidas.map((p) => (
            <div key={p.id} className="flex justify-between text-[12px] text-gray-400">
              <span className="line-through">{p.title}</span>
              <span>{formatDateBR(p.completedAt!)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
