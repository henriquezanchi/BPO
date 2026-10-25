import { TelaVencida } from "@/components/tv/parear-tv";
import { TelaTv } from "@/components/tv/tela-tv";
import s from "@/components/tv/tela-tv.module.css";
import { slidesDaTela, telaPorToken } from "@/lib/telas-eventos";
import type { Metadata } from "next";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eventos — Nova Acrópole",
  robots: { index: false, follow: false },
};

/**
 * Tela de TV da filial (pedido do usuário 2026-10-24). Pública, sem login: o token do link
 * é o segredo. Criada em Eventos → Telas da filial.
 *
 * Orientação "direita"/"esquerda" (TV presa em pé cujo navegador não gira): a página põe a
 * própria tela num quadro girado 90°; dentro do quadro (?quadro=1) a tela se vê em pé e usa o
 * layout vertical normalmente.
 */
export default async function TelaTvPage(props: { params: Promise<{ token: string }>; searchParams: Promise<{ quadro?: string }> }) {
  const { token } = await props.params;
  const { quadro } = await props.searchParams;
  const tela = await telaPorToken(token);
  if (!tela) return <TelaVencida />;
  if (tela.orientacao !== "auto" && quadro !== "1") {
    return (
      <main className={s.tela}>
        <iframe
          src={`/tv/${token}?quadro=1`}
          title={tela.nome}
          allow="screen-wake-lock"
          className={`${s.quadroGirado} ${tela.orientacao === "esquerda" ? s.girarEsquerda : s.girarDireita}`}
        />
      </main>
    );
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "portal-na-one.vercel.app";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const slides = await slidesDaTela(tela, `${protocolo}://${host}/portal`);
  const filial = tela.school.city ? `Nova Acrópole ${tela.school.city}` : tela.school.name;
  return <TelaTv slides={slides} filial={filial} token={token} />;
}
