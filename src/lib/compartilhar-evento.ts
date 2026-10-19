/**
 * Compartilhamento de eventos públicos (pedido do usuário 2026-10-19).
 *
 * Só eventos do Ulisses: são os eventos abertos ao público, com página de
 * inscrição própria no site da Nova Acrópole. Eventos internos da filial
 * (source "manual") têm público restrito e inscrição dentro do Portal, que
 * exige login — não faz sentido divulgá-los fora.
 *
 * Funções puras (sem DOM): o texto de cada canal e os links de abertura.
 */

export type EventoCompartilhavel = {
  title: string;
  date: Date;
  allDay: boolean;
  location: string | null;
  description: string | null;
  registrationUrl: string;
};

export type Canal = "whatsapp" | "instagram" | "facebook" | "telegram" | "email" | "link";

type ItemDeAgenda = {
  title: string;
  date: Date;
  allDay: boolean;
  location: string | null;
  description: string | null;
  source?: string;
  status?: string;
  registrationUrl?: string | null;
};

/** Evento público do Ulisses, publicado, com link de inscrição e ainda por acontecer. */
export function eventoCompartilhavel(item: ItemDeAgenda, agora = new Date()): EventoCompartilhavel | null {
  if (item.source !== "ulisses" || item.status !== "publicado" || !item.registrationUrl) return null;
  if (item.date.getTime() < agora.getTime() - 12 * 60 * 60 * 1000) return null;
  return {
    title: item.title,
    date: item.date,
    allDay: item.allDay,
    location: item.location,
    description: item.description,
    registrationUrl: item.registrationUrl,
  };
}

const FUSO = "America/Sao_Paulo";

/** "sábado, 25 de outubro" */
export function diaPorExtenso(data: Date): string {
  return data.toLocaleDateString("pt-BR", {
    timeZone: FUSO,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "19h" ou "19h30" (horário de Brasília). */
export function horaCurta(data: Date): string {
  const [h, m] = data
    .toLocaleTimeString("pt-BR", {
      timeZone: FUSO,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    .split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

export function quandoTexto(e: Pick<EventoCompartilhavel, "date" | "allDay">): string {
  return e.allDay ? diaPorExtenso(e.date) : `${diaPorExtenso(e.date)}, às ${horaCurta(e.date)}`;
}

/** Resumo da descrição sem cortar palavra no meio. */
export function resumo(texto: string | null, limite: number): string {
  const limpo = (texto ?? "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${corte.slice(0, ultimoEspaco > limite * 0.6 ? ultimoEspaco : limite).trimEnd()}…`;
}

/**
 * Texto de cada canal:
 *  - WhatsApp: negrito com *asteriscos*, curto, link no fim (vira prévia).
 *  - Instagram: legenda mais longa; link não é clicável na legenda, então
 *    vai escrito e o story recebe o adesivo de link.
 *  - Telegram / e-mail: texto simples.
 */
export function textoParaCanal(e: EventoCompartilhavel, canal: Canal): string {
  const quando = quandoTexto(e);
  const quandoEOnde = [`📅 ${quando}`, e.location ? `📍 ${e.location}` : null].filter(Boolean).join("\n");
  switch (canal) {
    case "whatsapp":
      return [`*${e.title}*`, quandoEOnde, resumo(e.description, 280) || null, `Inscrições: ${e.registrationUrl}`].filter(Boolean).join("\n\n");
    case "instagram":
      return [e.title, quandoEOnde, resumo(e.description, 1200) || null, `Inscrições: ${e.registrationUrl}`, "#NovaAcrópole #filosofia #EscolaDeFilosofia"]
        .filter(Boolean)
        .join("\n\n");
    case "telegram":
    case "email":
      return [e.title, `${quando}${e.location ? ` · ${e.location}` : ""}`, resumo(e.description, 600) || null, `Inscrições: ${e.registrationUrl}`]
        .filter(Boolean)
        .join("\n\n");
    default:
      return e.registrationUrl;
  }
}

/**
 * Link que abre o canal já com a postagem pronta. wa.me e t.me abrem o
 * aplicativo no celular e a versão web no computador. Instagram não tem link
 * de postagem: é feito pela folha de compartilhamento do celular (imagem) —
 * ver compartilhar-evento-botoes.tsx.
 */
export function linkDoCanal(e: EventoCompartilhavel, canal: Exclude<Canal, "instagram" | "link">): string {
  const q = encodeURIComponent;
  switch (canal) {
    case "whatsapp":
      return `https://wa.me/?text=${q(textoParaCanal(e, "whatsapp"))}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${q(e.registrationUrl)}`;
    case "telegram": {
      // O Telegram junta url + text; o texto vai sem a linha do link para não repetir.
      const texto = textoParaCanal(e, "telegram").replace(`\n\nInscrições: ${e.registrationUrl}`, "");
      return `https://t.me/share/url?url=${q(e.registrationUrl)}&text=${q(texto)}`;
    }
    case "email":
      return `mailto:?subject=${q(e.title)}&body=${q(textoParaCanal(e, "email"))}`;
  }
}

/** Nome de arquivo seguro para a arte baixada. */
export function nomeDoArquivo(e: Pick<EventoCompartilhavel, "title">, formato: "story" | "feed"): string {
  const base = e.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${base || "evento"}-${formato}.png`;
}
