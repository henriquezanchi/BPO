import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  CartaoEvento,
  partes,
  type Registro,
} from "@/components/member/meus-eventos";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Meus eventos (pedido do usuário 2026-10-22: "a página está meio sem graça,
 * preto e branco, sem destacar a categoria, nome ou data"). Mesmo visual da
 * Agenda: data em destaque, categoria, etiqueta colorida com a situação da
 * inscrição; próximos primeiro, depois os anteriores.
 */
async function carregar(memberId: string) {
  const [registrations, reception] = await Promise.all([
    db.eventRegistration.findMany({
      where: { memberId },
      include: { event: { include: { school: { select: { name: true } } } } },
      orderBy: { event: { startsAt: "asc" } },
    }),
    db.eventReception.findMany({
      where: { memberId },
      include: { event: true },
      orderBy: { event: { startsAt: "asc" } },
    }),
  ]);
  return { registrations, reception };
}

export default async function Page() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/eventos");
  if (!member.mercurioAtivo) redirect("/portal");
  const { registrations, reception } = await carregar(member.id);
  const agora = new Date();
  const fim = (r: Registro) => r.event.endsAt ?? r.event.startsAt;
  const proximos = registrations.filter((r) => fim(r) >= agora);
  const anteriores = registrations.filter((r) => fim(r) < agora).reverse();
  const recepcaoProxima = reception.filter(
    (r) => (r.event.endsAt ?? r.event.startsAt) >= agora,
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col gap-5 bg-na-bg p-5 pb-16 dark:bg-gray-950">
      <Link
        href="/portal"
        className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-na-green dark:text-emerald-400"
      >
        <ArrowLeft size={15} /> Portal do Aluno
      </Link>

      <header className="rounded-2xl bg-gradient-to-br from-na-green-dark to-na-green p-4 text-white">
        <p className="text-[10px] font-semibold tracking-wide text-na-gold uppercase">
          Agenda & Eventos
        </p>
        <h1 className="mt-1 text-xl font-black">Meus eventos</h1>
        <p className="mt-1 text-[12px] text-green-100">
          Suas inscrições, a participação nos eventos e as equipes de recepção.
        </p>
      </header>

      {recepcaoProxima.length > 0 && (
        <section className="flex flex-col gap-2">
          <CollapsibleSection title={<h2 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300">
            <ShieldCheck size={14} /> Minha equipe de recepção
          </h2>}>
          {recepcaoProxima.map((r) => {
            const d = partes(r.event.startsAt);
            return (
              <Link
                key={r.id}
                href={`/eventos/${r.eventId}/recepcao`}
                className="flex items-center gap-3 rounded-2xl border border-na-gold/40 bg-na-gold/10 p-3.5 transition hover:border-na-gold dark:border-amber-900 dark:bg-amber-950/20"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-na-gold/25 text-na-gold-dark dark:text-amber-300">
                  <ShieldCheck size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-gray-900 dark:text-gray-100">
                    {r.event.title}
                  </span>
                  <span className="block text-[12px] text-gray-600 dark:text-gray-400">
                    {d.semana}, {d.dia} {d.mes} · {d.hora} · Abrir a recepção
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-gray-400" />
              </Link>
            );
          })}
        </CollapsibleSection></section>
      )}

      <section className="flex flex-col gap-2">
        <CollapsibleSection title={<h2 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gray-600 uppercase dark:text-gray-300">
          <CalendarDays size={14} /> Próximos
        </h2>}>
        {proximos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-5 text-center dark:border-gray-700">
            <p className="text-[13px] text-gray-600 dark:text-gray-400">
              Nenhuma inscrição para os próximos dias.
            </p>
            <Link
              href="/portal"
              className="mt-2 inline-block text-[13px] font-semibold text-na-green dark:text-emerald-400"
            >
              Ver eventos na Agenda →
            </Link>
          </div>
        ) : (
          proximos.map((r) => (
            <CartaoEvento
              key={r.id}
              r={r}
              minhaEscola={member.schoolId}
              passado={false}
              memberId={member.id}
              podeResponder={!member.isJanos}
            />
          ))
        )}
      </CollapsibleSection></section>

      {anteriores.length > 0 && (
        <section className="flex flex-col gap-2">
          <CollapsibleSection title={<h2 className="text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Anteriores
          </h2>}>
          {anteriores.map((r) => (
            <CartaoEvento
              key={r.id}
              r={r}
              minhaEscola={member.schoolId}
              passado
              memberId={member.id}
              podeResponder={!member.isJanos}
            />
          ))}
        </CollapsibleSection></section>
      )}

      <p className="text-center text-[11px] text-gray-500 dark:text-gray-400">
        Ative as notificações no Portal para receber os lembretes dos seus
        eventos no celular.
      </p>
    </main>
  );
}
