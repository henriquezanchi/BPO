"use client";

import { addContributionItem, removeContributionItem } from "@/lib/actions/contribution-actions";
import { formatBRL } from "@/lib/format";
import type { SerializedCompositionItem } from "@/lib/member-data";
import type { MercurioCatalogItem } from "@/lib/mercurio";
import { AlertTriangle, Loader2, Lock, Plus, Trash2 } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [isAdding, startAdd] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemoving, startRemove] = useTransition();

  const total = items.reduce((soma, i) => soma + i.amount, 0);

  function handleAdd() {
    if (!selectedGroup) return;
    setError(null);
    const label = catalog.find((c) => c.value === selectedGroup)?.label ?? "";
    startAdd(async () => {
      const res = await addContributionItem(memberId, selectedGroup, label);
      if (!res.ok) {
        setError(res.error ?? "Falha ao incluir item.");
        return;
      }
      setItems((prev) => [...prev.filter((i) => i.id !== res.item.id), res.item]);
      setCatalog((prev) => prev.filter((c) => c.value !== selectedGroup));
      setSelectedGroup("");
    });
  }

  function handleRemove(item: SerializedCompositionItem) {
    setError(null);
    setRemovingId(item.id);
    startRemove(async () => {
      const res = await removeContributionItem(memberId, item.id);
      if (!res.ok) {
        setError(res.error ?? "Falha ao excluir item.");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
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
              <div key={item.id} className="flex items-center justify-between gap-2 p-2.5 text-[13px]">
                <span className="flex items-center gap-1.5">
                  {!item.addedViaPortal && <Lock size={11} className="shrink-0 text-gray-400" />}
                  {item.label}
                </span>
                <div className="flex items-center gap-2">
                  <strong>{formatBRL(item.amount)}</strong>
                  {item.addedViaPortal && (
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
                  )}
                </div>
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
          <div className="flex gap-2">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 p-2 text-[13px] text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">Selecione...</option>
              {catalog.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selectedGroup || isAdding}
              className="flex items-center gap-1 rounded-lg bg-na-green px-3 text-[13px] font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
            >
              {isAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Incluir
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-[11px] text-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
