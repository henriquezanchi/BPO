import { ParearTv } from "@/components/tv/parear-tv";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conectar TV — Nova Acrópole",
  robots: { index: false, follow: false },
};

/**
 * Endereço curto para a TV (pedido do usuário 2026-10-24: TV só tem controle remoto). Mostra um
 * código e um QR para o voluntário conectar pelo celular; se a TV já foi conectada, volta direto
 * para a tela guardada. /tv?nova=1 força um código novo (para trocar a tela desta TV).
 */
export default async function ConectarTvPage(props: { searchParams: Promise<{ nova?: string }> }) {
  const { nova } = await props.searchParams;
  return <ParearTv nova={nova === "1"} />;
}
