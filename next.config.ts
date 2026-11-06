import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tesouraria (src/pages/api/tesouraria): navegador automatizado no Mercúrio.
  // Playwright e o Chromium para serverless ficam fora do empacotamento.
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/tesouraria/\\[\\[\\.\\.\\.rota\\]\\]": [
      "./src/tesouraria/web/public/**/*",
      "./src/tesouraria/dados/**/*",
      "./public/na-logo.png",
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
    // Fila de escrita no Mercúrio (navegador automatizado), rotina da Vercel desde 26/10/2026.
    // playwright-core/browsers.json não era empacotado ("Cannot find module …/browsers.json", 27/10/2026).
    "/api/cron/fila-mercurio": ["./node_modules/@sparticuz/chromium/bin/**/*", "./node_modules/playwright-core/**/*.json", "./node_modules/playwright/**/*.json"],
  },
  poweredByHeader: false,
  // Service worker do PWA: sempre a versão mais nova (sem cache), só scripts do próprio site.
  async headers() {
    return [
      // Proteções do navegador em todo o site (01/11/2026): o Portal só pode ser embutido por ele mesmo (a TV girada
      // usa um iframe da própria tela), o navegador não "adivinha" tipos de arquivo e o endereço completo não vaza
      // para outros sites.
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/economia/tesouraria", destination: "/api/tesouraria" },
      { source: "/economia/tesouraria/:caminho*", destination: "/api/tesouraria/:caminho*" },
    ];
  },
};

export default nextConfig;
