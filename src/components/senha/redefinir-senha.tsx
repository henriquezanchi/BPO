"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const CAMPO =
  "w-full rounded-lg border border-gray-200 p-2.5 text-[13px] text-gray-900 outline-none focus:border-na-green focus:ring-2 focus:ring-na-green-light dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

/**
 * Chegada pelo link do e-mail de "esqueci minha senha". Aceita os dois
 * formatos do Supabase: ?token_hash=…&type=recovery (funciona em qualquer
 * aparelho) e ?code=… (mesmo navegador em que o link foi pedido).
 */
export function RedefinirSenha() {
  const router = useRouter();
  const [estado, setEstado] = useState<"conferindo" | "pronto" | "invalido">("conferindo");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const p = new URLSearchParams(window.location.search);
    const tokenHash = p.get("token_hash");
    const code = p.get("code");
    (async () => {
      const { error } = tokenHash
        ? await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })
        : code
          ? await supabase.auth.exchangeCodeForSession(code)
          : { error: new Error("link sem token") };
      setEstado(error ? "invalido" : "pronto");
    })();
  }, []);

  function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nova = String(f.get("nova") ?? "");
    if (nova.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
    if (nova !== String(f.get("confirmacao") ?? "")) return setErro("As senhas não coincidem.");
    setErro(null);
    iniciar(async () => {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password: nova });
      if (error) return setErro("Não foi possível salvar a senha. Peça um link novo.");
      router.replace("/portal");
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-na-bg p-5 dark:bg-gray-950">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-900">
        <h1 className="text-lg font-black text-na-green-dark dark:text-emerald-400">Criar senha nova</h1>
        {estado === "conferindo" && (
          <p className="flex items-center gap-2 text-[13px] text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Conferindo o link…
          </p>
        )}
        {estado === "invalido" && (
          <div className="flex flex-col gap-3 text-[13px] text-gray-700 dark:text-gray-300">
            <p className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-na-warning-dark" /> Este link expirou ou já foi usado.
            </p>
            <Link href="/login/esqueci" className="font-semibold text-na-green-dark dark:text-emerald-400">
              Pedir um link novo
            </Link>
          </div>
        )}
        {estado === "pronto" && (
          <form onSubmit={salvar} className="flex flex-col gap-3">
            <input name="nova" type="password" required minLength={6} autoComplete="new-password" placeholder="Senha nova" className={CAMPO} aria-label="Senha nova" />
            <input name="confirmacao" type="password" required minLength={6} autoComplete="new-password" placeholder="Repita a senha" className={CAMPO} aria-label="Repita a senha" />
            {erro && <p className="text-[12px] text-na-danger-dark dark:text-red-400">{erro}</p>}
            <button
              disabled={pendente}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white hover:bg-na-green-dark disabled:opacity-60"
            >
              {pendente ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Salvar e entrar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
