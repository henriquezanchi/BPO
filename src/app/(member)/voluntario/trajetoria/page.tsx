import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { lerTrajetoria } from "@/lib/trajetoria";
import { Award, BookOpen, Flag, Landmark } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const br = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
const periodo = (inicio: string | null, termino: string | null, atual: boolean) =>
  atual ? (inicio ? `desde ${br(inicio)}` : "atual") : [inicio && br(inicio), termino && br(termino)].filter(Boolean).join(" a ") || "";

/**
 * Minha trajetória (pedido do usuário 06/11/2026): funções, distinções, marcos e aulas, como o Mercúrio registra.
 * Só a própria pessoa vê. Lido na hora do banco de consulta do Mercúrio.
 */
export default async function TrajetoriaPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/trajetoria");
  if (!member.mercurioAtivo || !member.mercurioId || !/^\d+$/.test(member.mercurioId)) redirect("/voluntario");

  const t = await lerTrajetoria(member.mercurioId).catch(() => undefined);

  return (
    <ShellTrabalho largura="estreita">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Minha trajetória</h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-400">O que o Mercúrio registra da sua caminhada na escola. Só você vê esta página.</p>
      </header>

      {t === undefined && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Não foi possível ler o Mercúrio agora. Tente de novo em instantes.</p>}
      {t === null && <p className="text-sm text-gray-500">Não encontramos seu cadastro no Mercúrio.</p>}
      {t && (
        <div className="flex flex-col gap-4">
          <Bloco icone={<Flag size={17} />} titulo="Marcos">
            {t.marcos.length === 0 ? (
              <Vazio>Nenhum marco registrado.</Vazio>
            ) : (
              <ol className="flex flex-col gap-2 border-l-2 border-na-green/30 pl-4 dark:border-emerald-900">
                {t.marcos.map((m) => (
                  <li key={m.titulo + m.data} className="text-[13px]">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{m.titulo}</span>
                    <span className="block text-[12px] text-gray-500 dark:text-gray-400">{br(m.data)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Bloco>

          <Bloco icone={<Landmark size={17} />} titulo="Funções">
            {t.funcoes.length === 0 ? (
              <Vazio>Nenhuma função registrada no Mercúrio. Se você exerce ou exerceu alguma, peça à Escolástica para registrar.</Vazio>
            ) : (
              <ul className="flex flex-col gap-2">
                {t.funcoes.map((f, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-gray-100 pt-2 text-[13px] first:border-0 first:pt-0 dark:border-gray-800">
                    <span className="min-w-0">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{f.nome}</span>
                      {f.atual && <span className="ml-2 rounded-full bg-na-green-light px-2 py-0.5 text-[11px] font-semibold text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">atual</span>}
                      <span className="block text-[12px] text-gray-500 dark:text-gray-400">
                        {f.alcance === "nacional" ? "Nacional" : (f.unidade ?? "Filial")}
                        {f.conselho && " · conselho"}
                      </span>
                    </span>
                    <span className="text-[12px] text-gray-500 tabular-nums dark:text-gray-400">{periodo(f.inicio, f.termino, f.atual)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>

          {t.distincoes.length > 0 && (
            <Bloco icone={<Award size={17} />} titulo="Distinções">
              <ul className="flex flex-col gap-2">
                {t.distincoes.map((d, i) => (
                  <li key={i} className="flex justify-between gap-3 text-[13px]">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{d.nome}</span>
                    <span className="text-[12px] text-gray-500 tabular-nums dark:text-gray-400">{br(d.data)}</span>
                  </li>
                ))}
              </ul>
            </Bloco>
          )}

          {t.aulas.length > 0 && (
            <Bloco icone={<BookOpen size={17} />} titulo="Aulas que você ministra">
              <ul className="flex flex-col gap-2">
                {t.aulas.map((a, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-x-3 text-[13px]">
                    <span className="min-w-0">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{a.materia}</span>
                      <span className="block text-[12px] text-gray-500 dark:text-gray-400">
                        Turma {a.turma}
                        {a.unidade && ` · ${a.unidade}`}
                      </span>
                    </span>
                    {a.desde && <span className="text-[12px] text-gray-500 tabular-nums dark:text-gray-400">desde {br(a.desde)}</span>}
                  </li>
                ))}
              </ul>
            </Bloco>
          )}

          <p className="text-[12px] text-gray-500 dark:text-gray-400">Algo errado ou faltando? A Escolástica da sua filial corrige no Mercúrio, e a página atualiza sozinha.</p>
        </div>
      )}
    </ShellTrabalho>
  );
}

function Bloco({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="flex items-center gap-2 text-[14px] font-bold text-gray-900 dark:text-gray-100">
        <span className="text-na-green-dark dark:text-emerald-400">{icone}</span> {titulo}
      </h2>
      {children}
    </section>
  );
}

const Vazio = ({ children }: { children: React.ReactNode }) => <p className="text-[13px] text-gray-500 dark:text-gray-400">{children}</p>;
