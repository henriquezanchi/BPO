import { AreaSecretaria } from "@/components/secretarias-rede/area-secretaria";
import { CalendarioTab } from "@/components/director/calendario-tab";
import { EventosTab } from "@/components/director/eventos-tab";
import { TelasTab } from "@/components/director/telas-tab";
import { AbasArea } from "@/components/trabalho/areas";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { exigirArea } from "@/lib/area-trabalho";
import { db } from "@/lib/db";
import { getDirectorDashboard } from "@/lib/director-data";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function origemDoPortal() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "portal-na-one.vercel.app";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

/** Eventos: gestão de eventos, telas de TV e calendário da filial (antes no Painel da Direção). */
export default async function EventosAreaPage(props: { searchParams: Promise<{ aba?: string }> }) {
  if((await props.searchParams).aba==='orientacoes')return <ShellTrabalho><AreaSecretaria secretaria="Eventos"/></ShellTrabalho>;
  const member = await exigirArea("eventos", "/voluntario/eventos");
  const { aba = "eventos" } = await props.searchParams;
  return (
    <ShellTrabalho>
      <h1 className="text-xl font-black text-na-green-dark lg:text-2xl dark:text-emerald-400">Eventos</h1>
      <AbasArea
        base="/voluntario/eventos"
        atual={aba}
        abas={[
          ["orientacoes", "Orientações e gestão"],
          ["eventos", "Gestão de eventos"],
          ["telas", "Telas (TV)"],
          ["calendario", "Calendário", "/voluntario/calendario"],
        ]}
      />
      {aba === "calendario" ? (
        <CalendarioTab schoolId={member.schoolId} />
      ) : aba === "telas" ? (
        <TelasTab
          schoolId={member.schoolId}
          origem={await origemDoPortal()}
          telas={await db.telaEventos.findMany({ where: { schoolId: member.schoolId }, orderBy: { createdAt: "asc" }, select: { id: true, nome: true, publicos: true, conteudos: true, orientacao: true, token: true } })}
          cartoes={(await db.telaCartao.findMany({ where: { schoolId: member.schoolId }, orderBy: { createdAt: "asc" } })).map((c) => ({
            id: c.id,
            tipo: c.tipo,
            titulo: c.titulo,
            texto: c.texto,
            link: c.link,
            ate: c.ate ? c.ate.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : null,
          }))}
        />
      ) : (
        <EventosTab schoolId={member.schoolId} data={await getDirectorDashboard(member.schoolId)} />
      )}
    </ShellTrabalho>
  );
}
