import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getAuthenticatedMember } from "@/lib/auth";
import { carregarHistorico, hojeDaPessoa } from "@/lib/diario-dados";
import { meusGrupos } from "@/lib/grupos-dados";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Lock, Moon, Pencil, Sunrise } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const nomeDoMes = (mes: string) => new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const nomeDoDia = (data: string) => new Date(`${data}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });

/** Histórico do diário (2026-10-29): os registros de cada mês, só leitura. Só a própria pessoa vê. */
export default async function HistoricoDiarioPage(props: { searchParams: Promise<{ mes?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/diario/historico");
  if (!(await meusGrupos(member, ["GAF"])).length) redirect("/portal");
  const { mes: mesPedido } = await props.searchParams;
  const { mes, meses, dias } = await carregarHistorico(member, mesPedido);
  const hoje = hojeDaPessoa(member);
  const i = meses.indexOf(mes);
  const anterior = i >= 0 ? meses[i + 1] : undefined;
  const seguinte = i > 0 ? meses[i - 1] : undefined;
  const epilogos = dias.filter((d) => d.epilogo).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <div className="flex items-center justify-between">
        <Link href="/diario" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft size={14} /> Meu diário
        </Link>
        <ThemeToggle />
      </div>
      <header>
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">Histórico do diário</h1>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">O caminho que você já percorreu, mês a mês.</p>
      </header>

      <nav aria-label="Mês" className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
        {anterior ? (
          <Link href={`/diario/historico?mes=${anterior}`} aria-label="Mês anterior" className="rounded-xl p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            <ChevronLeft size={18} />
          </Link>
        ) : (
          <span className="w-[34px]" />
        )}
        <span className="text-center">
          <span className="block text-[15px] font-bold text-gray-900 capitalize dark:text-gray-100">{nomeDoMes(mes)}</span>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">
            {dias.length} {dias.length === 1 ? "dia registrado" : "dias registrados"} · {epilogos} {epilogos === 1 ? "Epílogo" : "Epílogos"}
          </span>
        </span>
        {seguinte ? (
          <Link href={`/diario/historico?mes=${seguinte}`} aria-label="Mês seguinte" className="rounded-xl p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            <ChevronRight size={18} />
          </Link>
        ) : (
          <span className="w-[34px]" />
        )}
      </nav>

      {dias.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-5 text-center text-[13px] text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          Nenhum registro ainda. O primeiro Prólogo ou Epílogo que você fizer aparece aqui.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dias.map((d) => (
            <li key={d.data}>
              <details className="group rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-gray-500 capitalize dark:text-gray-400">{d.data === hoje ? "Hoje" : nomeDoDia(d.data)}</span>
                    <span className="block truncate text-[14px] font-bold text-gray-900 dark:text-gray-100">{d.virtude ?? "Sem virtude escolhida"}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Sunrise size={15} aria-label={d.prologo ? "Prólogo feito" : "Sem Prólogo"} className={d.prologo ? "text-amber-500" : "text-gray-300 dark:text-gray-700"} />
                    <Moon size={15} aria-label={d.epilogo ? "Epílogo feito" : "Sem Epílogo"} className={d.epilogo ? "text-indigo-500 dark:text-indigo-300" : "text-gray-300 dark:text-gray-700"} />
                    <ChevronRight size={15} className="text-gray-400 transition group-open:rotate-90" />
                  </span>
                </summary>
                <div className="flex flex-col gap-2.5 border-t border-gray-100 p-3.5 text-[13px] text-gray-700 dark:border-gray-800 dark:text-gray-300">
                  {d.compromisso && <Trecho rotulo="Meu compromisso" texto={d.compromisso} />}
                  {d.praticas.length > 0 && (
                    <div>
                      <strong className="block text-[12px] text-gray-500 dark:text-gray-400">Práticas feitas</strong>
                      <ul className="mt-0.5 flex flex-col gap-0.5">
                        {d.praticas.map((p) => (
                          <li key={p} className="flex items-center gap-1.5">
                            <Check size={13} className="text-na-green" /> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d.falhei && <Trecho rotulo="Em que falhei?" texto={d.falhei} />}
                  {d.fizBem && <Trecho rotulo="O que fiz bem?" texto={d.fizBem} />}
                  {d.deixeiDeFazer && <Trecho rotulo="O que deixei de fazer?" texto={d.deixeiDeFazer} />}
                  {d.reflexaoLivre && <Trecho rotulo="Reflexão livre" texto={d.reflexaoLivre} />}
                  {d.editavel && (
                    <Link href={d.data === hoje ? "/diario" : `/diario?dia=${d.data}`} className="flex items-center gap-1 self-start text-[12px] font-semibold text-na-green-dark dark:text-emerald-400">
                      <Pencil size={12} /> Editar este dia
                    </Link>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        <Lock size={11} /> Só você vê o seu diário. Nem a coordenação nem a escola têm acesso.
      </p>
    </main>
  );
}

function Trecho({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <p>
      <strong className="block text-[12px] text-gray-500 dark:text-gray-400">{rotulo}</strong>
      <span className="whitespace-pre-line">{texto}</span>
    </p>
  );
}
