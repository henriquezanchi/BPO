"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AlertTriangle, Loader2, LogIn } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

export function LoginClient({ next }: { next: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Controlado (não usa o prop `action` do <form>) de propósito: React 19
  // reseta os campos de um form action automaticamente após o submit,
  // mesmo em erro — o que apagava o e-mail já digitado numa tentativa com
  // senha errada, obrigando a redigitar tudo (achado testando ao vivo).
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) {
        setError(
          error.message.includes("Invalid login credentials")
            ? "E-mail ou senha incorretos. A senha inicial são os 6 primeiros números do seu CPF."
            : error.message,
        );
        return;
      }

      router.push(next);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-na-bg p-5 dark:bg-gray-950">
      <div className="relative w-full max-w-[380px] rounded-[28px] border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <ThemeToggle className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800" />

        <div className="mb-6 flex justify-center">
          <Image src="/na-logo.png" alt="Nova Acrópole" width={160} height={48} className="h-auto w-36 dark:brightness-0 dark:invert" />
        </div>

        <h1 className="mb-1 text-center text-base font-bold text-na-green-dark dark:text-emerald-400">
          Entrar no Portal do Membro
        </h1>
        <p className="mb-5 text-center text-xs text-gray-500 dark:text-gray-400">
          Use o e-mail cadastrado no Mercúrio.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-800 dark:text-gray-300">E-mail</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-800 dark:text-gray-300">Senha</label>
            <input name="password" type="password" required autoComplete="current-password" className={INPUT_CLASS} />
            <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
              Senha inicial: os 6 primeiros números do seu CPF.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-[11px] text-red-800 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark disabled:opacity-60"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            {isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
