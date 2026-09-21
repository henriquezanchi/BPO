"use client";

import { addContributionItem, removeContributionItem, updateContributionItemValue } from "@/lib/actions/contribution-actions";
import { formatBRL } from "@/lib/format";
import type { SerializedCompositionItem } from "@/lib/member-data";
import type { MercurioCatalogItem } from "@/lib/mercurio";
import { AlertTriangle, Check, Clock, Loader2, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";

export function MyContributionPanel({
  memberId,
  compositionItems,
  initialAvailableToAdd,
}: {
  memberId: string;
  compositionItems: SerializedCompositionItem[];
  initialAvailableToAdd: MercurioCatalogItem[];
}) {
  const [items, setItems] = useState(compositionItems);
  const [catalog, setCatalog] = useState(initialAvailableToAdd);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [newItemValue, setNewItemValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAdding, startAdd] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemoving, startRemove] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSavingEdit, startSaveEdit] = useTransition();

  const total = items.reduce((soma, i) => soma + i.amount, 0);

  function handleAdd() {
    if (!selectedGroup) return;
    const valor = parseFloat(newItemValue.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Informe o valor desse item antes de incluir.");
      return;
    }
    setError(null);
    setNotice(null);
    const label = catalog.find((c) => c.value === selectedGroup)?.label ?? "";
    startAdd(async () => {
      const res = await addContributionItem(memberId, selectedGroup, label, valor);
      if (!res.ok) {
        setError(res.error ?? "Falha ao incluir item.");
        return;
      }
      setItems((prev) => [...prev, res.item]);
      setCatalog((prev) => prev.filter((c) => c.value !== selectedGroup));
      setSelectedGroup("");
      setNewItemValue("");
      setNotice(`"${label}" incluído — a confirmação no Mercúrio pode levar até 24h.`);
    });
  }

  function handleStartEdit(item: SerializedCompositionItem) {
    setError(null);
    setEditingId(item.id);
    setEditValue(item.amount.toFixed(2).replace(".", ","));
  }

  function handleSaveEdit(item: SerializedCompositionItem) {
    const novoValor = parseFloat(editValue.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(novoValor) || novoValor < 0) {
      setError("Valor inválido.");
      return;
    }
    setError(null);
    setNotice(null);
    startSaveEdit(async () => {
      const res = await updateContributionItemValue(memberId, item.id, novoValor);
      if (!res.ok) {
        setError(res.error ?? "Falha ao alterar valor.");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === res.item.id ? res.item : i)));
      setEditingId(null);
      setNotice("Valor atualizado — a confirmação no Mercúrio pode levar até 24h.");
    });
  }

  function handleRemove(item: SerializedCompositionItem) {
    setError(null);
    setNotice(null);
    setRemovingId(item.id);
    startRemove(async () => {
      const res = await removeContributionItem(memberId, item.id);
      if (!res.ok) {
        setError(res.error ?? "Falha ao excluir item.");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setNotice("Item removido — a confirmação no Mercúrio pode levar até 24h.");
    });
  }

  return (
    <div className="text-left">
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Composição atual da sua contribuição:</p>

      <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700">
        {items.length === 0 ? (
          <p className="p-3 text-xs text-gray-500 dark:text-gray-400">Nenhum item na sua composição ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-2 p-2.5 text-[13px] ${
                  item.pendingSync ? "bg-amber-50 dark:bg-amber-950/20" : ""
                }`}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    {!item.addedViaPortal && <Lock size={11} className="shrink-0 text-gray-400" />}
                    {item.label}
                  </span>
                  {item.pendingSync && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      <Clock size={10} /> Aguardando confirmação no Mercúrio
                    </span>
                  )}
                </span>
                {editingId === item.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(item)}
                      className="w-20 rounded-md border border-gray-200 p-1 text-right text-[13px] outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <button
                      onClick={() => handleSaveEdit(item)}
                      disabled={isSavingEdit}
                      title="Salvar"
                      className="text-gray-400 transition hover:text-na-green disabled:opacity-60"
                    >
                      {isSavingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button onClick={() => setEditingId(null)} title="Cancelar" className="text-gray-400 transition hover:text-red-600">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <strong>{formatBRL(item.amount)}</strong>
                    {item.addedViaPortal && (
                      <>
                        <button
                          onClick={() => handleStartEdit(item)}
                          title="Alterar valor deste item"
                          className="text-gray-400 transition hover:text-na-green"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleRemove(item)}
                          disabled={isRemoving && removingId === item.id}
                          title="Excluir item incluído por você"
                          className="text-gray-400 transition hover:text-red-600 disabled:opacity-60"
                        >
                          {isRemoving && removingId === item.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <div className="flex justify-between border-t border-dashed border-gray-300 p-2.5 text-sm font-bold text-na-green-dark dark:border-gray-600 dark:text-emerald-400">
            <span>Total</span>
            <span>{formatBRL(total)}/mês</span>
          </div>
        )}
      </div>

      <p className="mb-2 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
        <Lock size={10} /> Itens com cadeado foram lançados pela secretaria e não podem ser alterados por aqui.
      </p>

      <div className="mb-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
        <div className="mb-2 text-[11px] font-bold text-gray-900 dark:text-gray-100">Incluir novo item</div>
        {catalog.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum item novo disponível pra incluir.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full rounded-lg border border-gray-200 p-2 text-[13px] text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">Selecione...</option>
              {catalog.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                placeholder="Valor (ex: 20,00)"
                inputMode="decimal"
                disabled={!selectedGroup}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 p-2 text-[13px] text-gray-900 outline-none disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                onClick={handleAdd}
                disabled={!selectedGroup || isAdding}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-na-green px-3 py-2 text-[13px] font-semibold whitespace-nowrap text-white transition hover:bg-na-green-dark disabled:opacity-60"
              >
                {isAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Incluir
              </button>
            </div>
          </div>
        )}
      </div>

      {notice && (
        <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-[11px] text-green-800 dark:bg-green-950/30 dark:text-green-300">
          <Check size={14} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-[11px] text-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
