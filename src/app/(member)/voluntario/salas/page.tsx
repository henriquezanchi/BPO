import { AlertTriangle, ChevronLeft, ChevronRight, DoorOpen } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { agendaPorSala } from "@/lib/agenda-salas";
import { areasNaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { itensDoCalendario, type ItemCalendario } from "@/lib/calendario-filial";
import { fusoDaEscola } from "@/lib/fuso-escola";

export const dynamic = "force-dynamic";

const CAMADA: Record<string, string> = { aula: "Aula", reuniao_grupo: "Grupo", evento_filial: "Evento" };

/**
 * Agenda da sala (pedido do usuário 07/11/2026): semana a semana, o que ocupa cada sala da filial (aulas do Mercúrio,
 * turmas planejadas, eventos e grupos) e os choques de horário. Mesmo acesso do calendário da filial.
 */
export default async function AgendaSalasPage(props: { searchParams: Promise<{ semana?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/voluntario/salas");
  const areas = await areasNaFilial(member, member.schoolId);
  if (!areas.includes("eventos") && !areas.includes("direcao")) redirect("/voluntario");

  const deslocamento = Math.max(-8, Math.min(26, Number((await props.searchParams).semana ?? 0) || 0));
  const fuso = fusoDaEscola(member.school.uf);
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: fuso });
  const base = new Date(`${hoje}T12:00:00Z`);
  const segunda = new Date(base.getTime() - ((base.getUTCDay() + 6) % 7) * 864e5 + deslocamento * 7 * 864e5);
  const de = new Date(`${segunda.toISOString().slice(0, 10)}T00:00:00Z`);
  const ate = new Date(de.getTime() + 7 * 864e5 - 1);
  const salas = agendaPorSala(await itensDoCalendario(member.schoolId, de, ate));
  const totalChoques = salas.reduce((s, x) => s + x.choques.length, 0);

  const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit" });
  const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit" });
  const quando = (i: ItemCalendario) => (i.diaInteiro ? `${dia(i.inicio)} · dia inteiro` : `${dia(i.inicio)} · ${hora(i.inicio)}${i.fim ? `–${hora(i.fim)}` : ""}`);
  const periodo = `${de.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })} a ${new Date(ate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}`;

  return (
    <ShellTrabalho>
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">
          <DoorOpen size={22} /> Agenda das salas
        </h1>
        <p className="text-[13px] text-gray-600 dark:text-gray-400">
          Aulas do Mercúrio, turmas planejadas, eventos e grupos, pela sala ou local informado em cada um. Aulas sem horário de término contam 2 horas.
        </p>
        <nav className="flex items-center gap-2 text-sm" aria-label="Semana">
          <Link href={`/voluntario/salas?semana=${deslocamento - 1}`} className="rounded-lg border border-gray-300 p-2 dark:border-gray-700" aria-label="Semana anterior">
            <ChevronLeft size={16} />
          </Link>
          <span className="font-semibold">Semana de {periodo}</span>
          <Link href={`/voluntario/salas?semana=${deslocamento + 1}`} className="rounded-lg border border-gray-300 p-2 dark:border-gray-700" aria-label="Próxima semana">
            <ChevronRight size={16} />
          </Link>
          {deslocamento !== 0 && (
            <Link href="/voluntario/salas" className="text-[13px] font-semibold text-na-green-dark dark:text-emerald-400">
              Esta semana
            </Link>
          )}
        </nav>
        {totalChoques > 0 && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-[13px] font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle size={16} /> {totalChoques === 1 ? "1 choque de horário" : `${totalChoques} choques de horário`} nesta semana.
          </p>
        )}
      </header>

      {!salas.length && <p className="text-sm text-gray-600 dark:text-gray-400">Nada com sala informada nesta semana.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {salas.map((s) => {
          const emChoque = new Set(s.choques.flat().map((i) => i.id));
          return (
            <section key={s.sala} className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="flex items-center justify-between gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                {s.sala}
                <span className="text-[12px] font-normal text-gray-500">{s.itens.length} no período</span>
              </h2>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {s.itens.map((i) => (
                  <li key={i.id} className={`rounded-lg px-2 py-1.5 ${emChoque.has(i.id) ? "bg-amber-50 dark:bg-amber-950/30" : "bg-gray-50 dark:bg-gray-800/50"}`}>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{i.titulo}</span>
                    <span className="block text-[12px] text-gray-600 dark:text-gray-400">
                      {CAMADA[i.camada] ?? ""} · {quando(i)}
                      {emChoque.has(i.id) && <strong className="text-amber-800 dark:text-amber-300"> · choque</strong>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </ShellTrabalho>
  );
}
