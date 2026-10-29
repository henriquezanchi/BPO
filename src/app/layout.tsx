import { RegistrarServiceWorker } from "@/components/pwa/registrar-service-worker";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Noto_Sans } from "next/font/google";
import "./globals.css";

// Fonte oficial da marca Nova Acrópole (Guia de uso de marca 2025, seção 8):
// Noto Sans Black para títulos, Noto Sans Regular para corpo de texto — a
// mesma fonte em todas as comunicações, escolhida pela organização por
// cobrir a maioria dos alfabetos usados nos 50+ países onde atua.
const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: "variable", // dá os pesos 400 (corpo) e 900/Black (títulos) do mesmo arquivo, sem negrito sintético
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portal do Aluno - Nova Acrópole",
  description: "Autogestão, carteira digital e agenda de atividades para membros e professores.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Portal do Aluno - Nova Acrópole",
  },
};

// Cor da barra do sistema no celular (PWA instalado e navegador).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#086357" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
};

// Roda ANTES da hidratação (script síncrono no <head>) pra aplicar a
// classe "dark" já no primeiro paint — sem isso, a página nasceria clara
// e só escureceria um instante depois (flash visível), mesmo pra quem já
// escolheu modo noturno antes. Ver src/components/ui/theme-toggle.tsx.
// Sem escolha feita no Portal, segue o tema do celular/computador e acompanha a troca (pedido do usuário 2026-10-29).
const THEME_INIT_SCRIPT = `
  try {
    var escolha = localStorage.getItem('na-theme');
    var sistema = window.matchMedia('(prefers-color-scheme: dark)');
    if (escolha ? escolha === 'dark' : sistema.matches) document.documentElement.classList.add('dark');
    sistema.addEventListener('change', function (e) {
      if (!localStorage.getItem('na-theme')) document.documentElement.classList.toggle('dark', e.matches);
    });
  } catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${notoSans.variable} ${geistMono.variable} h-full antialiased`}
      // O script no <head> abaixo pode acrescentar "dark" a essa classe
      // antes da hidratação (evita flash do tema errado) — isso é
      // ESPERADO e sempre vai diferir do HTML renderizado pelo servidor,
      // então suprimimos só o aviso de hidratação deste elemento.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
