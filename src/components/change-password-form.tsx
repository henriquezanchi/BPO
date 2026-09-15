"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

/**
 * Troca a senha de login diretamente via Supabase Auth (não passa pelo
 * nosso banco/Mercúrio — a senha do Portal é só do Portal). Pensado pra
 * quem ainda está com a senha inicial (6 primeiros dígitos do CPF).
 */
export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSubmit(formData: FormData) {
    setStatus(null);
    startTransition(async () => {
      const novaSenha = String(formData.get("novaSenha") ?? "");
      const confirmacao = String(formData.get("confirmacao") ?? "");

      if (novaSenha.length < 6) {
        setStatus({ ok: false, message: "A senha precisa ter pelo menos 6 caracteres." });
        return;
      }
      if (novaSenha !== confirmacao) {
        setStatus({ ok: false, message: "As senhas não coincidem." });
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: novaSenha });

      if (error) {
        setStatus({ ok: false, message: error.message });
        return;
      }

      setStatus({ ok: true, message: "Senha alterada com sucesso." });
      (document.getElementById("form-trocar-senha") as HTMLFormElement | null)?.reset();
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold text-gray-900 dark:text-gray-100">
        <KeyRound size={14} /> Trocar Senha
      </div>
      <form id="form-trocar-senha" action={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-800 dark:text-gray-300">Nova senha</label>
          <input name="novaSenha" type="password" required autoComplete="new-password" className={INPUT_CLASS} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-gray-800 dark:text-gray-300">Confirmar nova senha</label>
          <input name="confirmacao" type="password" required autoComplete="new-password" className={INPUT_CLASS} />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-na-green px-4 py-2.5 text-[13px] font-semibold text-na-green-dark transition hover:bg-na-green-light disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          {isPending ? "Salvando..." : "Salvar nova senha"}
        </button>

        {status && (
          <div
            className={`flex items-start gap-2 rounded-lg p-3 text-[11px] ${
              status.ok
                ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
            }`}
          >
            {status.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
            <span>{status.message}</span>
          </div>
        )}
      </form>
    </div>
  );
}
