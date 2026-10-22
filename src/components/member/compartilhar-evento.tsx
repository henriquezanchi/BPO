"use client";

import { gerarArteEvento, type FormatoArte } from "@/lib/arte-evento";
import { linkDoCanal, nomeDoArquivo, textoParaCanal, type EventoCompartilhavel } from "@/lib/compartilhar-evento";
import { Check, Download, Link2, Loader2, Mail, Send, Share2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/** Ícones de marca desenhados à mão (o lucide não traz logos de empresas). */
export function IconeWhatsApp({ tamanho = 16 }: { tamanho?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} aria-hidden fill="none" stroke="#1faa59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3z" />
      <path
        d="M9 8.6c.2-.4.5-.5.8-.5h.4l1 2.1-.6.8c.5 1 1.4 1.9 2.4 2.4l.8-.6 2.1 1v.4c0 .3-.1.6-.5.8-.7.4-1.6.5-2.7-.1a8 8 0 0 1-3.6-3.6c-.6-1.1-.5-2 -.1-2.7z"
        fill="#1faa59"
        stroke="none"
      />
    </svg>
  );
}
function IconeInstagram() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="#d62976" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1" fill="#d62976" stroke="none" />
    </svg>
  );
}
function IconeFacebook() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#1877f2" />
      <path d="M13.2 21.9v-7h2.3l.4-2.8h-2.7v-1.7c0-.8.3-1.4 1.4-1.4h1.4V6.6a17 17 0 0 0-2.1-.1c-2 0-3.5 1.3-3.5 3.6v2h-2.3v2.8h2.3v7" fill="#fff" />
    </svg>
  );
}

const BOTAO =
  "flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-[12px] font-semibold text-gray-800 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";

function Canal({
  href,
  onClick,
  icone,
  rotulo,
  desabilitado,
}: {
  href?: string;
  onClick?: () => void;
  icone: ReactNode;
  rotulo: string;
  desabilitado?: boolean;
}) {
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={BOTAO}>
        {icone} {rotulo}
      </a>
    );
  return (
    <button type="button" onClick={onClick} disabled={desabilitado} className={BOTAO}>
      {icone} {rotulo}
    </button>
  );
}

type Artes = Record<FormatoArte, { arquivo: File; url: string }>;

function baixar(arquivo: File, url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo.name;
  a.click();
}

/**
 * Compartilhar evento público (Ulisses) — cada canal já abre com a postagem
 * montada no formato dele:
 *  - WhatsApp, Facebook, Telegram, e-mail: link que abre o aplicativo (ou a
 *    versão web no computador) com o texto pronto.
 *  - Instagram: não aceita postagem por link. No celular, abre a folha de
 *    compartilhamento com a arte no tamanho certo (story 9:16 ou feed 4:5),
 *    onde se escolhe o Instagram; a legenda (feed) ou o link (story, para o
 *    adesivo de link) vai copiado. No computador, baixa a arte e abre o site.
 * As artes são geradas ao abrir o painel, para o toque no Instagram chamar o
 * compartilhamento na hora (o navegador só permite logo após o toque).
 */
export function CompartilharEvento({ evento }: { evento: EventoCompartilhavel }) {
  const [aberto, setAberto] = useState(false);
  const [artes, setArtes] = useState<Artes | null>(null);
  const [erroArte, setErroArte] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [temShareNativo, setTemShareNativo] = useState(false);

  useEffect(() => {
    if (!aberto || artes) return;
    let cancelado = false;
    (async () => {
      try {
        const [story, feed] = await Promise.all((["story", "feed"] as const).map((f) => gerarArteEvento(evento, f)));
        const montar = (blob: Blob, f: FormatoArte) => {
          const arquivo = new File([blob], nomeDoArquivo(evento, f), {
            type: "image/png",
          });
          return { arquivo, url: URL.createObjectURL(arquivo) };
        };
        if (!cancelado)
          setArtes({
            story: montar(story, "story"),
            feed: montar(feed, "feed"),
          });
      } catch {
        if (!cancelado) setErroArte(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [aberto, artes, evento]);

  // Libera as imagens da memória ao sair.
  useEffect(
    () => () => {
      if (artes) for (const a of Object.values(artes)) URL.revokeObjectURL(a.url);
    },
    [artes],
  );

  function abrir() {
    setAberto((v) => !v);
    setAviso(null);
    setTemShareNativo(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }

  function copiar(texto: string) {
    return (
      navigator.clipboard?.writeText(texto).then(
        () => true,
        () => false,
      ) ?? Promise.resolve(false)
    );
  }

  function compartilharInstagram(formato: FormatoArte) {
    if (!artes) return;
    const { arquivo, url } = artes[formato];
    // Story: o link vai no adesivo "Link". Feed: a legenda inteira.
    const paraColar = formato === "story" ? evento.registrationUrl : textoParaCanal(evento, "instagram");
    void copiar(paraColar);
    const dica =
      formato === "story"
        ? 'Link copiado. No story, toque no ícone de adesivos, escolha "Link" e cole.'
        : "Legenda copiada. No Instagram, cole no campo de legenda.";
    if (navigator.canShare?.({ files: [arquivo] })) {
      navigator.share({ files: [arquivo] }).catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        baixar(arquivo, url);
        setAviso(`Não deu para abrir o compartilhamento: a arte foi baixada. ${dica}`);
      });
      setAviso(`Escolha o Instagram (${formato === "story" ? "Story" : "Feed"}) na lista. ${dica}`);
      return;
    }
    // Computador: sem compartilhamento de arquivos.
    baixar(arquivo, url);
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    setAviso(
      `Arte baixada e ${formato === "story" ? "link" : "legenda"} copiado${formato === "story" ? "" : "a"}. No Instagram, crie a publicação com a imagem baixada. Pelo celular, este botão abre o Instagram direto.`,
    );
  }

  function copiarLink() {
    void copiar(evento.registrationUrl).then((ok) => {
      setLinkCopiado(ok);
      setAviso(ok ? "Link de inscrição copiado." : "Não foi possível copiar. Link: " + evento.registrationUrl);
      if (ok) setTimeout(() => setLinkCopiado(false), 2000);
    });
  }

  function outrosApps() {
    const texto = textoParaCanal(evento, "whatsapp").replace(/\*/g, "").replace(`\n\nInscrições: ${evento.registrationUrl}`, "");
    navigator.share({ title: evento.title, text: texto, url: evento.registrationUrl }).catch(() => {});
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={abrir}
        aria-expanded={aberto}
        className="inline-flex items-center gap-1.5 rounded-lg border border-na-green/40 px-3 py-1.5 text-[12px] font-semibold text-na-green-dark transition hover:bg-na-green-light dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
      >
        {aberto ? <X size={13} /> : <Share2 size={13} />} {aberto ? "Fechar" : "Compartilhar"}
      </button>

      {aberto && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
          <p className="mb-2 text-[11px] text-gray-600 dark:text-gray-400">Evento aberto ao público. Cada opção abre o aplicativo com a postagem pronta.</p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Canal href={linkDoCanal(evento, "whatsapp")} icone={<IconeWhatsApp />} rotulo="WhatsApp" />
            <Canal
              onClick={() => compartilharInstagram("story")}
              desabilitado={!artes}
              icone={artes ? <IconeInstagram /> : <Loader2 size={16} className="animate-spin" />}
              rotulo="Instagram Story"
            />
            <Canal
              onClick={() => compartilharInstagram("feed")}
              desabilitado={!artes}
              icone={artes ? <IconeInstagram /> : <Loader2 size={16} className="animate-spin" />}
              rotulo="Instagram Feed"
            />
            <Canal href={linkDoCanal(evento, "facebook")} icone={<IconeFacebook />} rotulo="Facebook" />
            <Canal href={linkDoCanal(evento, "telegram")} icone={<Send size={16} className="text-[#229ed9]" />} rotulo="Telegram" />
            <Canal href={linkDoCanal(evento, "email")} icone={<Mail size={16} className="text-gray-500" />} rotulo="E-mail" />
            <Canal
              onClick={copiarLink}
              icone={linkCopiado ? <Check size={16} className="text-na-green" /> : <Link2 size={16} className="text-gray-500" />}
              rotulo={linkCopiado ? "Copiado" : "Copiar link"}
            />
            {temShareNativo && <Canal onClick={outrosApps} icone={<Share2 size={16} className="text-gray-500" />} rotulo="Outros apps" />}
          </div>

          {aviso && (
            <p
              role="status"
              className="mt-2 rounded-lg bg-na-green-light px-2.5 py-2 text-[11px] text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {aviso}
            </p>
          )}

          {erroArte && (
            <p className="mt-2 text-[11px] text-na-danger-dark dark:text-red-400">
              Não foi possível gerar a arte neste navegador. Os outros canais funcionam normalmente.
            </p>
          )}
          {artes && (
            <div className="mt-3 flex items-end gap-3">
              {(["story", "feed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => baixar(artes[f].arquivo, artes[f].url)}
                  className="group flex flex-col items-center gap-1"
                  title="Baixar a arte"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada no navegador (blob) */}
                  <img
                    src={artes[f].url}
                    alt={`Arte para ${f === "story" ? "story" : "feed"} do Instagram`}
                    className={`rounded-md border border-gray-200 shadow-sm dark:border-gray-700 ${f === "story" ? "h-28 w-auto" : "h-[78px] w-auto"}`}
                  />
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-200">
                    <Download size={10} /> {f === "story" ? "Story" : "Feed"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
