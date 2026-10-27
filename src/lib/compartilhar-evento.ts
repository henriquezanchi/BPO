/**
 * Compartilhamento de eventos públicos (pedido do usuário 2026-10-19).
 *
 * Eventos do Ulisses usam a página pública de inscrição da Nova Acrópole.
 * Eventos internos da filial têm convite com descrição e link direto para
 * a Agenda do Portal; continuam restritos à conta e ao público do evento.
 *
 * Funções puras (sem DOM): o texto de cada canal e os links de abertura.
 */

export type EventoCompartilhavel = {
  interno?: boolean;
  price?: number;
  title: string;
  date: Date;
  allDay: boolean;
  location: string | null;
  description: string | null;
  registrationUrl: string;
  /** Imagem do evento (Ulisses), desenhada na arte. */
  imagem?: string | null;
  /** Post oficial no Instagram, quando a filial cadastrou (compartilha esse em vez de criar outro). */
  postagemOficial?: string | null;
  /** O que já está escrito no cartaz (leitura por IA); null = não lido, a faixa leva tudo. */
  cartazLeitura?: { data: boolean; horario: boolean; local: boolean; inscricao: boolean } | null;
  /** Evento do Ágora (2026-10-27): rótulo do topo da arte ("EVENTO NACIONAL"), valor em texto e chamada da inscrição. */
  chamada?: string;
  valorTexto?: string | null;
  chamadaInscricao?: string;
};

export type Canal = "whatsapp" | "instagram" | "facebook" | "telegram" | "email" | "link";

type ItemDeAgenda = {
  id: string;
  title: string;
  date: Date;
  allDay: boolean;
  location: string | null;
  description: string | null;
  source?: string;
  status?: string;
  registrationUrl?: string | null;
  posterUrl?: string | null;
  postagemOficial?: string | null;
  cartazLeitura?: EventoCompartilhavel["cartazLeitura"];
  price?: number;
  participantInstructions?: string | null;
  lancheCompartilhado?: boolean;
  scope?: string;
  agora?: { inscrito: boolean; valor: string | null; prazo: string | null };
};

/** Evento público do Ulisses, publicado, com link de inscrição e ainda por acontecer. */
export function eventoCompartilhavel(item: ItemDeAgenda, agora = new Date()): EventoCompartilhavel | null {
  // Evento do Ágora (2026-10-27): inscrição no Ágora, com o valor de lá; não é "da escola" nem "aberto ao público".
  if (item.source === "agora" && item.status === "publicado" && item.registrationUrl && item.date.getTime() >= agora.getTime() - 12 * 60 * 60 * 1000) {
    return {
      title: item.title,
      date: item.date,
      allDay: item.allDay,
      location: item.location,
      description: item.description,
      registrationUrl: item.registrationUrl,
      imagem: item.posterUrl ?? null,
      chamada: item.scope === "nacional" ? "EVENTO NACIONAL" : "EVENTO REGIONAL",
      valorTexto: item.agora?.valor ? `Inscrição: ${item.agora.valor}` : null,
      chamadaInscricao: "INSCRIÇÕES NO ÁGORA",
    };
  }
  if (item.source !== "ulisses" || item.status !== "publicado" || !item.registrationUrl) return null;
  if (item.date.getTime() < agora.getTime() - 12 * 60 * 60 * 1000) return null;
  return {
    title: item.title,
    date: item.date,
    allDay: item.allDay,
    location: item.location,
    description: item.description,
    registrationUrl: item.registrationUrl,
    imagem: item.posterUrl ?? null,
    postagemOficial: item.postagemOficial ?? null,
    cartazLeitura: item.cartazLeitura ?? null,
  };
}

/**
 * O WhatsApp no computador (Windows) troca por "?" os emojis que vêm num
 * link wa.me (22/10/2026: 📅 e 📍 chegaram como "�"). Tira os emojis fora do
 * plano básico, inclusive os que vêm na descrição do Ulisses.
 */
export function semEmoji(texto: string): string {
  return texto
    .replace(/[\u{10000}-\u{10FFFF}]|\p{Extended_Pictographic}|[\uD800-\uDFFF\uFFFD\uFE0E\uFE0F\u200D\u20E3]/gu, "")
    .split("\n")
    .map((l) => l.replace(/^[ \t]+/, "").replace(/[ \t]{2,}/g, " "))
    .join("\n");
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

/** "19h" ou "19h30" (fuso America/Sao_Paulo, o mesmo usado no cadastro do evento). */
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

/**
 * Botão do WhatsApp nos cartões da Agenda (pedido do usuário 2026-10-22): evento público
 * do Ulisses usa o texto completo com o link de inscrição; evento interno manda os dados
 * e o endereço do Portal, onde a inscrição é feita (exige login).
 */
export function urlDoEventoNoPortal(id: string, urlPortal: string): string {
  const url = new URL(urlPortal);
  url.searchParams.set("evento", id);
  return url.toString();
}

export function linkWhatsAppDoEvento(item: ItemDeAgenda, urlPortal: string): string {
  const publico = eventoCompartilhavel(item);
  if (publico) return linkDoCanal(publico, "whatsapp");
  // Sem frase em primeira pessoa (pedido do usuário 2026-10-25): os dados e a descrição do evento.
  const linhas = [
    `*${semEmoji(item.title).replace(/\*/g, "").trim()}*`,
    quandoTexto(item),
    item.location ?? null,
    "",
    textoCompleto(item.description) || null,
    "",
    item.price === 0 ? "Entrada gratuita." : item.price !== undefined && item.price > 0
      ? `Valor: ${item.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.` : null,
    item.lancheCompartilhado ? "Lanche compartilhado: leve algo para partilhar." : null,
    item.participantInstructions?.trim() ? `Orientações: ${item.participantInstructions.trim()}` : null,
    "",
    "Veja os detalhes e confirme sua participação no Portal (entre com sua conta Nova Acrópole):",
    urlDoEventoNoPortal(item.id, urlPortal),
  ];
  return `https://wa.me/?text=${encodeURIComponent(semEmoji(linhas.filter((l) => l !== null).join("\n")))}`;
}

export function quandoTexto(e: Pick<EventoCompartilhavel, "date" | "allDay">): string {
  return e.allDay ? diaPorExtenso(e.date) : `${diaPorExtenso(e.date)}, às ${horaCurta(e.date)}`;
}

/** Descrição inteira, só com espaços e linhas em branco arrumados (nada cortado). */
export function textoCompleto(texto: string | null): string {
  return (texto ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
 *  - WhatsApp: negrito com *asteriscos*, descrição inteira, link no fim (vira prévia).
 *  - Instagram: legenda mais longa; link não é clicável na legenda, então
 *    vai escrito e o story recebe o adesivo de link.
 *  - Telegram / e-mail: texto simples.
 */
export function textoParaCanal(e: EventoCompartilhavel, canal: Canal): string {
  const quando = quandoTexto(e);
  const quandoEOnde = [`📅 ${quando}`, e.location ? `📍 ${e.location}` : null].filter(Boolean).join("\n");
  switch (canal) {
    case "whatsapp":
      // Sem emoji (o WhatsApp do computador os troca por "?"). Sem frase em primeira pessoa e com a descrição
      // inteira (pedido do usuário 2026-10-25: faltavam as palestras e o texto vinha cortado).
      return semEmoji(
        [
          `*${e.title}*\n${quando}${e.location ? `\n${e.location}` : ""}${e.valorTexto ? `\n${e.valorTexto}` : ""}`,
          textoCompleto(e.description ? semEmoji(e.description) : null) || null,
          `${e.chamadaInscricao ? "Inscrições no Ágora" : "Inscrições"}: ${e.registrationUrl}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      );
    case "instagram":
      return [e.title, quandoEOnde, resumo(e.description, 1200) || null, `Inscrições: ${e.registrationUrl}`, "#NovaAcrópole #filosofia #EscolaDeFilosofia"]
        .filter(Boolean)
        .join("\n\n");
    case "facebook":
      // O Facebook não aceita texto pronto no link (só o endereço): este texto vai copiado para colar.
      return semEmoji([`${e.title}\n${quandoTexto(e)}${e.location ? `\n${e.location}` : ""}`, textoCompleto(e.description) || null].filter(Boolean).join("\n\n"));
    case "telegram":
    case "email":
      return [e.title, `${quando}${e.location ? ` · ${e.location}` : ""}`, textoCompleto(e.description) || null, `Inscrições: ${e.registrationUrl}`]
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
