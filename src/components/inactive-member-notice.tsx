import { logout } from "@/lib/actions/auth-actions";
import { LogOut, MessageCircle } from "lucide-react";

/**
 * Mostrado quando o login (e-mail/senha) funcionou, mas a matrícula não
 * está mais ativa no Mercúrio (mercurioAtivo=false — ver
 * scripts/sync-active-status.ts e src/lib/auth.ts). Deliberadamente NÃO
 * usa a mesma tela de "precisa fazer login" — a pessoa se autenticou
 * corretamente, só não tem mais acesso ao conteúdo do Portal.
 */
export function InactiveMemberNotice({ schoolWhatsapp }: { schoolWhatsapp: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-na-bg p-5 dark:bg-gray-950">
      <div className="w-full max-w-[380px] rounded-[28px] border border-gray-200 bg-white p-6 text-center shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-2 text-base font-bold text-na-green-dark dark:text-emerald-400">Matrícula não está mais ativa</h1>
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
          Seu login funcionou, mas seu cadastro consta como inativo na escola. Se isso não deveria ter acontecido,
          fale com a secretaria.
        </p>

        {schoolWhatsapp && (
          <a
            href={`https://wa.me/${schoolWhatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-na-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-na-green-dark"
          >
            <MessageCircle size={16} /> Falar com a Secretaria
          </a>
        )}

        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <LogOut size={14} /> Sair
          </button>
        </form>
      </div>
    </div>
  );
}
