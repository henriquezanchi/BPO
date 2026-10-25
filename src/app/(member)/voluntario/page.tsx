import { CartaoGrupo } from "@/components/admin/grupos-admin";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { destinosDaPessoa } from "@/lib/area-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { portalLabel } from "@/lib/display-labels";
import { meusGrupos, type ResumoGrupo } from "@/lib/grupos-dados";
import { ehFV } from "@/lib/grupos-portal";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const SECOES: { titulo: string; tipos: ResumoGrupo["tipo"][] }[] = [
  { titulo: "Secretarias", tipos: ["SEC"] },
  { titulo: "Grupos de FV", tipos: ["BF", "BM", "CS"] },
  { titulo: "GDVE", tipos: ["GDVE"] },
  { titulo: "GAF", tipos: ["GAF"] },
  { titulo: "Grupos de estudo e leituras", tipos: ["ESTUDO", "LEITURA"] },
];

/**
 * Início da Área do Voluntário (pedido do usuário 2026-10-19: um lugar só
 * para voluntário e administrador, mostrando só o que cada um pode ver).
 * Grupos da pessoa em destaque e, embaixo, atalhos para tudo o que ela
 * acessa — o mesmo conteúdo do menu, em cartões (útil no celular).
 */
export default async function VoluntarioPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario");
  const [acesso, fv, grupos, destinos] = await Promise.all([temAcessoVoluntario(member), ehFV(member.id), meusGrupos(member), destinosDaPessoa(member)]);
  const podeCriarGdve = fv && acesso;
  const secoes = SECOES.map((s) => ({ ...s, grupos: grupos.filter((g) => s.tipos.includes(g.tipo)) })).filter((s) => s.grupos.length > 0 || (s.titulo === "GDVE" && podeCriarGdve));
  const atalhos = destinos.filter((d) => d.href !== "/voluntario");
  const primeiroNome = member.name.split(" ")[0].replace(/^./, (c) => c.toUpperCase()).replace(/(?<=.).+/, (r) => r.toLowerCase());

  return (
    <ShellTrabalho>
      <header>
        <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Olá, {primeiroNome}</h1>
        {member.cargos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {member.cargos.map((cargo) => (
              <span key={cargo} className="rounded-full bg-na-green-light px-2.5 py-1 text-[11px] font-semibold text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-400">
                {portalLabel(cargo.charAt(0) + cargo.slice(1).toLowerCase())}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Pedidos aguardando quem tem a área (Escolástica: cadastro; Economia: contribuição). */}
      {destinos
        .filter((d) => d.pendentes)
        .map((d) => (
          <Link
            key={`pend-${d.href}`}
            href={d.href}
            className="flex items-center justify-between gap-3 rounded-2xl border border-na-danger/30 bg-na-danger-light px-4 py-3 text-na-danger-dark dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-na-danger px-2 text-sm font-black text-white">{d.pendentes}</span>
              <span>
                <span className="block text-[13px] font-bold">{d.rotulo}</span>
                <span className="block text-[12px]">{d.descricao}</span>
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0" />
          </Link>
        ))}

      {secoes.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-[13px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {acesso ? "Você ainda não faz parte de nenhum grupo ou secretaria." : "Seus grupos aparecem aqui depois que o responsável liberar seu acesso à área de voluntários."}
        </p>
      )}
      {secoes.map((s) => (
        <section key={s.titulo} className="flex flex-col gap-3">
          <h2 className="text-[12px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">{s.titulo}</h2>
          {s.titulo === "GDVE" && podeCriarGdve && (
            <Link href="/grupos?aba=gdve" className="w-fit text-[13px] font-semibold text-na-green-dark hover:underline dark:text-emerald-400">
              Criar GDVE em Grupos →
            </Link>
          )}
          {s.grupos.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {s.grupos.map((g) => (
                <CartaoGrupo key={g.id} g={g} de="voluntario" etiqueta={g.papel === "responsavel" ? "Responsável" : "Integrante"} />
              ))}
            </div>
          )}
        </section>
      ))}

      {atalhos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[12px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">O que você pode acessar</h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {atalhos.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                className="group flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:border-na-green/50 dark:border-gray-700 dark:bg-gray-900"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">{d.rotulo}</span>
                  <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{d.descricao}</span>
                </span>
                <ChevronRight size={15} className="shrink-0 text-gray-300 group-hover:text-na-green" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </ShellTrabalho>
  );
}
