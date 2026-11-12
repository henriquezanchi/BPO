import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { ehAdministradorNacional } from "@/lib/acesso-voluntario";
import { getAuthenticatedMember } from "@/lib/auth";
import { situacaoDasRotinas } from "@/lib/rotinas";
import { dadosDoMercurio, verificarTudo } from "@/lib/saude";
import { CircleAlert, CircleCheck, Clock, Radio } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nunca";

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

const intervalo = (min: number) => (min >= 1440 ? "1 vez por dia" : min >= 60 ? `a cada ${min / 60} h` : `a cada ${min} min`);

/** Saúde do Portal (26/10/2026): rotinas agendadas e serviços externos, verificados na hora. Só administração nacional. */
export default async function SaudePage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/admin/saude");
  if (!(await ehAdministradorNacional(member))) redirect("/portal");
  const [rotinas, servicos, mercurio] = await Promise.all([situacaoDasRotinas(), verificarTudo(), dadosDoMercurio()]);
  const fontesVelhas = (mercurio.fontes ?? []).filter((f) => f.desatualizada);
  const filiaisAtrasadas = mercurio.filiais.filter((f) => f.atrasada);
  const problemas =
    rotinas.filter((r) => r.ok === false || r.atrasada).length +
    servicos.filter((s) => !s.ok).length +
    fontesVelhas.filter((f) => f.critica).length +
    filiaisAtrasadas.length +
    (mercurio.erroFontes ? 1 : 0);
  // Ao vivo primeiro, depois cópias da mais velha para a mais nova; dentro de cada grupo, as críticas antes.
  const fontes = [...(mercurio.fontes ?? [])].sort(
    (a, b) => Number(b.aoVivo) - Number(a.aoVivo) || Number(b.critica) - Number(a.critica) || (a.carregadaEm ?? "").localeCompare(b.carregadaEm ?? ""),
  );

  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Saúde do Portal</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {problemas ? `${problemas} ponto(s) de atenção.` : "Tudo funcionando."} Falhas também chegam ao WhatsApp do suporte.
      </p>

      <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-black text-na-green-dark dark:text-emerald-400">Serviços (verificados agora)</h2>
        <ul className="mt-3 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {servicos.map((s) => (
            <li key={s.chave} className="flex items-start gap-2 py-2 text-sm">
              {s.ok ? <CircleCheck size={16} className="mt-0.5 shrink-0 text-na-green" /> : <CircleAlert size={16} className="mt-0.5 shrink-0 text-na-danger" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{s.titulo}</p>
                <p className={`break-words text-[12px] ${s.ok ? "text-gray-500 dark:text-gray-400" : "text-na-danger-dark dark:text-red-400"}`}>{s.detalhe}</p>
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{s.ms} ms</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-black text-na-green-dark dark:text-emerald-400">O que vem do Mercúrio, e de quando</h2>
        <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
          O Portal lê o banco de consulta do Mercúrio. Fontes <strong>ao vivo</strong> mostram o Mercúrio de agora; <strong>cópias</strong> mostram o Mercúrio do dia em
          que foram carregadas, e o que mudou depois não chega ao Portal. Cópia com mais de 2 dias aparece em vermelho.
        </p>
        {mercurio.erroFontes ? (
          <p className="mt-3 text-[12px] text-na-danger-dark dark:text-red-400">Não foi possível consultar as fontes agora: {mercurio.erroFontes}</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {fontes.map((f) => (
              <li key={f.tabela} className="flex items-start gap-2 py-2 text-sm">
                {f.aoVivo ? (
                  <Radio size={16} className="mt-0.5 shrink-0 text-na-green" />
                ) : f.desatualizada ? (
                  <CircleAlert size={16} className={`mt-0.5 shrink-0 ${f.critica ? "text-na-danger" : "text-amber-500"}`} />
                ) : (
                  <CircleCheck size={16} className="mt-0.5 shrink-0 text-na-green" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 dark:text-gray-100">{f.traz}</p>
                  <p className={`text-[12px] ${f.desatualizada && !f.aoVivo ? "text-na-danger-dark dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                    <code className="text-[11px]">{f.tabela}</code> ·{" "}
                    {!f.existe
                      ? "não encontrada no banco"
                      : f.aoVivo
                        ? "ao vivo"
                        : f.carregadaEm
                          ? `cópia de ${dia(f.carregadaEm)} (há ${f.dias} dias)`
                          : "cópia sem data"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-5 text-[13px] font-black text-gray-800 dark:text-gray-200">Última importação completa por filial</h3>
        <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">Cada filial é reimportada uma vez por dia, a partir das fontes acima.</p>
        <ul className="mt-2 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {mercurio.filiais.map((f) => {
            const atrasada = f.atrasada;
            return (
              <li key={f.unidade} className="flex items-center gap-2 py-1.5 text-sm">
                {atrasada ? <CircleAlert size={16} className="shrink-0 text-na-danger" /> : <CircleCheck size={16} className="shrink-0 text-na-green" />}
                <span className="min-w-0 flex-1 truncate text-gray-900 dark:text-gray-100">{f.filial}</span>
                <span className={`shrink-0 text-[12px] tabular-nums ${atrasada ? "text-na-danger-dark dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                  {quando(f.ultima)}
                  {f.emAndamento !== null ? ` · importando agora, faltam ${f.emAndamento}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-black text-na-green-dark dark:text-emerald-400">Rotinas agendadas</h2>
        <ul className="mt-3 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {rotinas.map((r) => {
            const ruim = r.ok === false || r.atrasada;
            return (
              <li key={r.nome} className="flex items-start gap-2 py-2 text-sm">
                {r.ok === null ? (
                  <Clock size={16} className="mt-0.5 shrink-0 text-gray-400" />
                ) : ruim ? (
                  <CircleAlert size={16} className="mt-0.5 shrink-0 text-na-danger" />
                ) : (
                  <CircleCheck size={16} className="mt-0.5 shrink-0 text-na-green" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{r.titulo}</p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">
                    {intervalo(r.intervaloMin)} · última execução {quando(r.ultimaExecucao)}
                    {r.atrasada && r.ultimaExecucao ? " · atrasada" : ""}
                    {r.ultimaFalha ? ` · última falha ${quando(r.ultimaFalha)}` : ""}
                  </p>
                  {r.ok === false && r.falhas.map((f) => <p key={f} className="break-words text-[12px] text-na-danger-dark dark:text-red-400">{f}</p>)}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">Rotina sem registro ainda não rodou desde que a página de saúde foi criada.</p>
      </section>
    </ShellTrabalho>
  );
}
