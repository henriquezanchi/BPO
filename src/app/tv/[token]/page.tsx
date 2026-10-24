import { TelaTv } from "@/components/tv/tela-tv";
import { slidesDaTela, telaPorToken } from "@/lib/telas-eventos";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eventos — Nova Acrópole",
  robots: { index: false, follow: false },
};

/**
 * Tela de TV da filial (pedido do usuário 2026-10-24). Pública, sem login: o token do link
 * é o segredo. Criada em Eventos → Telas da filial.
 */
export default async function TelaTvPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const tela = await telaPorToken(token);
  if (!tela) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "portal-na-one.vercel.app";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const slides = await slidesDaTela(tela, `${protocolo}://${host}/portal`);
  const filial = tela.school.city ? `Nova Acrópole ${tela.school.city}` : tela.school.name;
  return <TelaTv slides={slides} filial={filial} />;
}
