"use client";

import { gerarArteEvento, type FormatoArte } from "@/lib/arte-evento";
import { linkDoCanal, nomeDoArquivo, semEmoji, textoParaCanal, type EventoCompartilhavel } from "@/lib/compartilhar-evento";
import { Check, Copy, Download, Link2, Loader2, Mail, Send, Share2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

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

type FormatoInstagram = Exclude<FormatoArte, "whatsapp">;
type Artes = Record<FormatoInstagram, { arquivo: File; url: string }>;

function baixar(arquivo: File, url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo.name;
  a.click();
}

/** Prepara o arquivo antes do toque em compartilhar, preservando a ativação do navegador. */
export function CompartilharWhatsApp({ evento, linkTexto, compacto = false }: {
  evento: EventoCompartilhavel;
  linkTexto: string;
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [arte, setArte] = useState<{ arquivo: File; url: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [textoCopiado, setTextoCopiado] = useState(false);
  const texto = new URL(linkTexto).searchParams.get("text") ?? "";

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    let url: string | undefined;
    gerarArteEvento(evento, "whatsapp").then((blob) => {
      if (cancelado) return;
      const arquivo = new File([blob], nomeDoArquivo(evento, "feed"), { type: "image/png" });
      url = URL.createObjectURL(arquivo);
      setArte({ arquivo, url });
    }).catch(() => { if (!cancelado) setErro(true); });
    return () => { cancelado = true; if (url) URL.revokeObjectURL(url); };
  }, [aberto, evento]);

  function abrir() {
    setArte(null);
    setErro(false);
    setAviso(null);
    setTextoCopiado(false);
    setAberto(true);
  }

  function copiarConvite() {
    if (!navigator.clipboard?.writeText) {
      setAviso("Selecione e copie o texto do convite abaixo para colar no WhatsApp.");
      return;
    }
    void navigator.clipboard.writeText(texto).then(() => setTextoCopiado(true), () => {
      setTextoCopiado(false);
      setAviso("Não foi possível copiar automaticamente. Selecione e copie o texto do convite abaixo.");
    });
  }

  function compartilhar() {
    if (!arte) return;
    // Alguns aparelhos encaminham só o arquivo ao WhatsApp. Mantém o convite
    // completo disponível para colar sem aguardar e perder a ativação do toque.
    copiarConvite();
    if (navigator.share && navigator.canShare?.({ files: [arte.arquivo] })) {
      // O link segue no texto para que o destinatário abra o evento exato.
      void navigator.share({ files: [arte.arquivo], title: evento.title, text: texto }).catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setAviso("Não foi possível compartilhar. Baixe a arte e anexe no WhatsApp, ou envie somente o convite.");
      });
    } else {
      baixar(arte.arquivo, arte.url);
      window.open(linkTexto, "_blank", "noopener,noreferrer");
      setAviso("Arte baixada. No WhatsApp, anexe a imagem ao convite que já está pronto na conversa.");
    }
  }

  return <Dialog.Root open={aberto} onOpenChange={setAberto}>
    <Dialog.Trigger asChild>
    <button type="button" onClick={abrir}
      aria-label={`Compartilhar "${evento.title}" no WhatsApp`} title="Compartilhar no WhatsApp"
      className={compacto ? "-mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-gray-100 dark:hover:bg-gray-800" : BOTAO}>
      <IconeWhatsApp tamanho={compacto ? 20 : 16} />{!compacto && "WhatsApp"}
    </button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60" />
      <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 z-[101] max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-4 text-gray-900 shadow-xl dark:bg-gray-900 dark:text-gray-100">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Dialog.Title className="text-base font-bold text-na-green-dark dark:text-emerald-400">Compartilhar no WhatsApp</Dialog.Title>
          <Dialog.Close aria-label="Fechar compartilhamento" className="rounded-lg p-2"><X size={20} /></Dialog.Close>
        </div>
        {arte ? <>
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo PNG gerado no próprio navegador */}
          <img src={arte.url} alt={`Arte de ${evento.title}`} className="mx-auto max-h-[45dvh] rounded-lg object-contain" />
          <p className="mt-3 text-sm">Compartilhe a arte com o convite e o link do evento. No celular, escolha o WhatsApp na lista de aplicativos.</p>
          <button type="button" onClick={compartilhar} className={`${BOTAO} mt-3 w-full justify-center`}><IconeWhatsApp /> Compartilhar arte e convite</button>
          <button type="button" onClick={() => baixar(arte.arquivo, arte.url)} className={`${BOTAO} mt-2 w-full justify-center`}><Download size={16} /> Baixar arte</button>
        </> : erro ? <p role="alert" className="text-sm">Não foi possível gerar a arte. Você ainda pode enviar o convite abaixo.</p>
          : <p role="status" className="flex items-center gap-2 py-6 text-sm"><Loader2 className="animate-spin" size={18} /> Preparando arte…</p>}
        <label className="mt-3 block text-sm font-semibold">
          Texto do convite
          <textarea readOnly value={texto} rows={6} className="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-gray-50 p-3 text-xs font-normal dark:border-gray-700 dark:bg-gray-800" />
        </label>
        <button type="button" onClick={copiarConvite} className={`${BOTAO} mt-2 w-full justify-center`}>
          {textoCopiado ? <Check size={16} /> : <Copy size={16} />}{textoCopiado ? "Convite copiado" : "Copiar texto do convite"}
        </button>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Se o WhatsApp mostrar só a imagem, cole este convite no campo de legenda antes de enviar.</p>
        <a href={linkTexto} target="_blank" rel="noopener noreferrer" className={`${BOTAO} mt-2 justify-center`}>Enviar somente o convite</a>
        {aviso && <p role="status" className="mt-3 text-sm">{aviso}</p>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
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
  const [celular, setCelular] = useState(false);

  useEffect(() => {
    if (!aberto || artes) return;
    let cancelado = false;
    (async () => {
      try {
        const [story, feed] = await Promise.all((["story", "feed"] as const).map((f) => gerarArteEvento(evento, f)));
        const montar = (blob: Blob, f: FormatoInstagram) => {
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
    // Folha de compartilhamento com arquivo só faz sentido no celular; no computador ela abre uma janela genérica (22/10).
    setCelular(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
  }

  function copiar(texto: string) {
    return (
      navigator.clipboard?.writeText(texto).then(
        () => true,
        () => false,
      ) ?? Promise.resolve(false)
    );
  }

  function compartilharInstagram(formato: FormatoInstagram) {
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
      setAviso(`Na lista, toque em Instagram e depois em "${formato === "story" ? "Story" : "Feed"}". ${dica}`);
      return;
    }
    // Computador: o Instagram no navegador só publica no feed (story é só pelo celular).
    baixar(arquivo, url);
    if (formato === "story") {
      setAviso("Arte baixada. O story só pode ser publicado pelo celular: abra o Portal no celular e toque em Instagram Story.");
      return;
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    setAviso('Arte baixada e legenda copiada. No Instagram, clique em "Criar", escolha a imagem baixada e cole a legenda.');
  }

  function copiarLink() {
    void copiar(evento.registrationUrl).then((ok) => {
      setLinkCopiado(ok);
      setAviso(ok ? "Link de inscrição copiado." : "Não foi possível copiar. Link: " + evento.registrationUrl);
      if (ok) setTimeout(() => setLinkCopiado(false), 2000);
    });
  }

  function outrosApps() {
    const texto = semEmoji(textoParaCanal(evento, "whatsapp").replace(/\*/g, "").replace(`\n\nInscrições: ${evento.registrationUrl}`, ""));
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
          <p className="mb-2 text-[11px] text-gray-600 dark:text-gray-400">{evento.chamadaInscricao ? "Inscrições pelo Ágora." : "Evento aberto ao público."} Escolha onde quer compartilhar.</p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <CompartilharWhatsApp evento={evento} linkTexto={linkDoCanal(evento, "whatsapp")} />
            {evento.postagemOficial ? (
              // Post oficial cadastrado pela filial: abre o post no Instagram (no celular, no aplicativo) para repostar.
              <Canal
                onClick={() => {
                  window.open(evento.postagemOficial!, "_blank", "noopener,noreferrer");
                  setAviso('No post, toque no avião de papel e em "Adicionar ao story", ou envie para alguém.');
                }}
                icone={<IconeInstagram />}
                rotulo="Instagram (post oficial)"
              />
            ) : celular ? (
              // O Instagram não deixa sites abrirem o story/feed direto: um toque abre a lista do celular com a imagem pronta.
              <>
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
              </>
            ) : null}
            <Canal
              onClick={() => {
                // O Facebook não aceita texto pronto: copia a mensagem para a pessoa colar na publicação.
                void copiar(textoParaCanal(evento, "facebook"));
                window.open(linkDoCanal(evento, "facebook"), "_blank", "noopener,noreferrer");
                setAviso("Mensagem copiada. No Facebook, toque no campo de texto e cole antes de publicar.");
              }}
              icone={<IconeFacebook />}
              rotulo="Facebook"
            />
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

          {!celular && !evento.postagemOficial && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Instagram: o aplicativo só aceita postagens vindas do celular. Abra o Portal no celular para compartilhar no story ou no feed. Se quiser, baixe a arte abaixo.
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
