import { KeyRound, Settings } from "lucide-react";
import Link from "next/link";

/**
 * Abas da Administração da filial (pedido do usuário 2026-10-25: "Liberar acessos" dentro da Administração).
 * Secretarias e GAF têm itens próprios no menu (/secretarias e /grupos). `acessos`: só para quem libera
 * acessos (Chefe, Sub-Chefe, administração nacional).
 */
export function AbasAdmin({ atual, filial, acessos }: { atual: "recursos" | "acessos"; filial?: string; acessos: boolean }) {
  const abas = [
    { id: "recursos", rotulo: "Recursos e administradores", icone: Settings, href: `/admin?aba=recursos${filial ? `&filial=${filial}` : ""}` },
    { id: "acessos", rotulo: "Liberar acessos", icone: KeyRound, href: "/voluntario/acessos" },
  ] as const;
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 lg:mx-0 lg:px-0 dark:border-gray-800" aria-label="Seções da Administração">
      {abas.filter((a) => a.id !== "acessos" || acessos).map((a) => (
        <Link
          key={a.id}
          href={a.href}
          aria-current={atual === a.id ? "page" : undefined}
          className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold ${
            atual === a.id ? "border-na-green text-na-green-dark dark:text-emerald-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
          }`}
        >
          <a.icone size={15} /> {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
