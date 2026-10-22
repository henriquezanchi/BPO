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
    // Nome sob o ícone na tela do celular (pedido do usuário 2026-10-22); o launcher pode cortar nomes longos.
    short_name: "Portal do Aluno - Nova Acrópole",
    description: "Contribuição, carteira Fortuna, agenda e jornada na Nova Acrópole.",
    lang: "pt-BR",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#086357",
    icons: [
      // Símbolo oficial (logomarca sem o texto) sobre fundo branco — pedido do usuário 2026-10-21.
      { src: "/pwa-icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      // Versão com mais margem: o Android recorta o ícone em círculo/gota.
      { src: "/pwa-icon-maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Meus eventos", url: "/eventos", icons: [{ src: "/pwa-icon-192.png?v=2", sizes: "192x192" }] },
      { name: "Área do Voluntário", url: "/voluntario", icons: [{ src: "/pwa-icon-192.png?v=2", sizes: "192x192" }] },
    ],
  };
}
