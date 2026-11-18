"use client";

import { entrarComoResponsavel } from "@/lib/actions/login-responsavel-actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** "Sou o responsável" na tela de aviso da criança (lib/actions/login-responsavel-actions.ts). */
export function EntrarComoResponsavel({ nome }: { nome: string }) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await entrarComoResponsavel();
            if (r.ok) router.refresh();
            else setErro(r.error);
          })
        }
        className="min-h-11 rounded-xl bg-na-green px-4 font-bold text-white disabled:opacity-60"
      >
        {pendente ? "Entrando…" : `Sou o responsável: entrar como ${nome.split(" ")[0]}`}
      </button>
      <p className="text-xs text-gray-500">Este e-mail também é o do cadastro de {nome}. A conta e a senha continuam as mesmas.</p>
      {erro && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{erro}</p>}
    </div>
  );
}
