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
  },
  async rewrites() {
    return [
      { source: "/economia/tesouraria", destination: "/api/tesouraria" },
      { source: "/economia/tesouraria/:caminho*", destination: "/api/tesouraria/:caminho*" },
    ];
  },
};

export default nextConfig;
