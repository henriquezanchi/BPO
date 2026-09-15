import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portal do Membro - Nova Acrópole",
  description: "Autogestão, carteira digital e agenda de atividades para membros e professores.",
};

// Roda ANTES da hidratação (script síncrono no <head>) pra aplicar a
// classe "dark" já no primeiro paint — sem isso, a página nasceria clara
// e só escureceria um instante depois (flash visível), mesmo pra quem já
// escolheu modo noturno antes. Ver src/components/ui/theme-toggle.tsx.
const THEME_INIT_SCRIPT = `
  try {
    if (localStorage.getItem('na-theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // O script no <head> abaixo pode acrescentar "dark" a essa classe
      // antes da hidratação (evita flash do tema errado) — isso é
      // ESPERADO e sempre vai diferir do HTML renderizado pelo servidor,
      // então suprimimos só o aviso de hidratação deste elemento.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
