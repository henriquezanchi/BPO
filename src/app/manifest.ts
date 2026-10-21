import type { MetadataRoute } from "next";

/**
 * PWA instalável — decisão do usuário 2026-09-28 (ícone na tela, abre em
 * modo "standalone" sem barra do navegador). Em 2026-10-21 ganhou service
 * worker (public/sw.js) e notificações push, enquanto não há app nativo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/portal",
    name: "Portal do Aluno - Nova Acrópole",
    short_name: "Portal NA",
    description: "Contribuição, carteira Fortuna, agenda e jornada na Nova Acrópole.",
    lang: "pt-BR",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f8",
    theme_color: "#086357",
    icons: [
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      // O ícone já é um quadrado cheio com a sigla no centro: serve também como "maskable" (Android recorta em círculo/gota).
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Meus eventos", url: "/eventos", icons: [{ src: "/pwa-icon-192", sizes: "192x192" }] },
      { name: "Área do Voluntário", url: "/voluntario", icons: [{ src: "/pwa-icon-192", sizes: "192x192" }] },
    ],
  };
}
