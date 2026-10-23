"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

type AcaoResultado = { ok: boolean; error?: string; aviso?: string; id?: string; comparacao?: unknown };

export function useFormAction<T extends AcaoResultado>(action: (formData: FormData) => Promise<T>, options?: { refresh?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [aviso, setAviso] = useState("");

  function submit(event: FormEvent<HTMLFormElement>, onSuccess?: (result: T) => void) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError("");
    setSuccess("");
    setAviso("");
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (!result.ok) {
          setError(result.error || "Não foi possível salvar. Confira os campos e tente novamente.");
          return;
        }
        setSuccess("Salvo com sucesso.");
        if (result.aviso) setAviso(result.aviso);
        onSuccess?.(result);
        if (options?.refresh !== false) router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Ocorreu um erro ao salvar. Tente novamente.");
      }
    });
  }

  return { pending, error, success, aviso, submit, setError, setSuccess };
}

export function Feedback({ error, success, aviso = "" }: { error: string; success: string; aviso?: string }) {
  if (!error && !success && !aviso) return null;
  const mensagem = error || aviso || success;
  return (
    <p role={error || aviso ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${error ? "border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" : aviso ? "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
      {mensagem}
    </p>
  );
}

export function Campo({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200 ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{hint}</span>}
    </label>
  );
}

export const CAMPO_CLASS = "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-na-green focus:ring-2 focus:ring-na-green/15 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";

export function SubmitButton({ children, pending, disabled = false, className = "" }: { children: React.ReactNode; pending: boolean; disabled?: boolean; className?: string }) {
  return (
    <button type="submit" disabled={pending || disabled} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-2 text-sm font-bold text-white transition hover:bg-na-green-dark disabled:cursor-wait disabled:opacity-60 ${className}`}>
      {pending ? "Salvando…" : children}
    </button>
  );
}

export function hiddenAberturaFields(schoolId: string, aberturaId?: string, revisao?: number) {
  return (
    <>
      <input type="hidden" name="schoolId" value={schoolId} />
      {aberturaId && <input type="hidden" name="aberturaId" value={aberturaId} />}
      {revisao !== undefined && <input type="hidden" name="revisao" value={String(revisao)} />}
    </>
  );
}
