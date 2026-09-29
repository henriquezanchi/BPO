import type { MetadataRoute } from "next";

/**
 * PWA instalável — decisão do usuário 2026-09-28. Só a parte de
 * instalabilidade (ícone na tela, abre em modo "standalone" sem barra do
 * navegador); notificação push fica pra quando decidirmos o canal de
 * notificação de verdade (ver conversa sobre WhatsApp real vs Web Push).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal do Membro - Nova Acrópole",
    short_name: "Portal NA",
    description: "Contribuição, carteira Fortuna, agenda e jornada na Nova Acrópole.",
    start_url: "/portal",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#005a4b",
    icons: [
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
