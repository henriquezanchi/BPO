import { diaPorExtenso, horaCurta, resumo, semEmoji, type EventoCompartilhavel } from "@/lib/compartilhar-evento";

/**
 * Arte do evento para o Instagram, desenhada no navegador (canvas), nas
 * medidas de cada formato: story 1080×1920 (9:16) e feed 1080×1350 (4:5).
 * Usada quando o evento não tem cartaz (com cartaz, ver cartazComoPostagem).
 * Cores e fonte da marca (Heket, Helios, Noto Sans — globals.css). No story,
 * o conteúdo fica fora das faixas de cima e de baixo que o Instagram cobre
 * com a barra de perfil e a de resposta.
 */
// "whatsapp" (1080×1080): quadrado, porque o chat corta imagens verticais na prévia (pedido do usuário 2026-10-26).
export type FormatoArte = "story" | "feed" | "whatsapp";

/** Medidas por formato. `topo`/`base`: faixas que o Instagram cobre no story. */
const MEDIDAS = {
  story: { w: 1080, h: 1920, topo: 230, base: 250, logo: 300, faixa: 230, titulo: 104, linhasTitulo: 5, data: 48, local: 40 },
  feed: { w: 1080, h: 1350, topo: 90, base: 0, logo: 280, faixa: 220, titulo: 88, linhasTitulo: 4, data: 42, local: 36 },
  whatsapp: { w: 1080, h: 1080, topo: 70, base: 0, logo: 240, faixa: 180, titulo: 76, linhasTitulo: 3, data: 38, local: 32 },
} as const;

const COR = {
  papel: "#faf7ef",
  heket: "#086357",
  heketEscuro: "#054039",
  helios: "#ffca00",
  heliosEscuro: "#806500",
  texto: "#1f2937",
  textoSuave: "#4b5563",
};

const MARGEM = 96;
const TITULO_MINIMO = 56;

/** Imagem do evento passa pelo Portal (o bucket do Ulisses não libera o canvas — ver /api/imagem-evento). */
function enderecoDaImagem(src: string) {
  return /^https:\/\/s3-sa-east-1\.amazonaws\.com\//i.test(src) ? `/api/imagem-evento?url=${encodeURIComponent(src)}` : src;
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error(`Não carregou ${src}`));
    img.src = src;
  });
}

/** Quebra o texto em linhas que cabem na largura; corta com reticências após `maxLinhas`. */
function quebrarLinhas(ctx: CanvasRenderingContext2D, texto: string, largura: number, maxLinhas: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(tentativa).width <= largura || !atual) atual = tentativa;
      else {
        linhas.push(atual);
        atual = palavra;
      }
    }
    if (atual) linhas.push(atual);
  }
  if (linhas.length <= maxLinhas) return linhas;
  const cortadas = linhas.slice(0, maxLinhas);
  let ultima = cortadas[maxLinhas - 1];
  while (ultima.length > 1 && ctx.measureText(`${ultima}…`).width > largura) ultima = ultima.slice(0, -1).trimEnd();
  cortadas[maxLinhas - 1] = `${ultima}…`;
  return cortadas;
}

function primeiraMaiuscula(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function paraBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao gerar a imagem."))), "image/png"));
}

/**
 * O próprio cartaz do evento como postagem (pedido do usuário 2026-10-22:
 * "pq não usar a própria imagem do evento?"). Feed: o cartaz inteiro, na
 * proporção dele (o Instagram aceita de 4:5 a 1,91:1; fora disso completa com
 * fundo). Story 9:16: o cartaz centralizado, dentro das faixas que o
 * Instagram cobre, sobre a própria imagem ampliada e desfocada.
 */
type LinhaFaixa = { texto: string; destaque?: boolean };

/**
 * O que falta no cartaz (pela leitura salva) vira linhas da faixa verde; sem
 * leitura, a faixa leva tudo. Cartaz completo = sem faixa.
 */
function linhasQueFaltam(e: EventoCompartilhavel): LinhaFaixa[] {
  const lido = e.cartazLeitura;
  const linhas: LinhaFaixa[] = [];
  const faltaData = !lido?.data;
  const faltaHora = !e.allDay && !lido?.horario;
  if (faltaData || faltaHora) {
    const partes = [faltaData ? primeiraMaiuscula(diaPorExtenso(e.date)) : null, faltaHora ? `às ${horaCurta(e.date)}` : null].filter(Boolean);
    linhas.push({ texto: partes.join(", "), destaque: true });
  }
  if (e.location && !lido?.local) linhas.push({ texto: e.location });
  if (!lido?.inscricao) linhas.push({ texto: `Inscrições: ${new URL(e.registrationUrl).host.replace(/^www\./, "")}` });
  return linhas;
}

/** Faixa verde Heket com texto branco (Noto Sans), como a faixa de inscrição da arte da marca. */
function desenharFaixa(ctx: CanvasRenderingContext2D, linhas: LinhaFaixa[], x: number, y: number, largura: number, escala: number) {
  const familia = getComputedStyle(document.body).fontFamily || "Arial, sans-serif";
  const pad = Math.round(36 * escala);
  const tamDestaque = Math.round(46 * escala);
  const tam = Math.round(36 * escala);
  const passo = (l: LinhaFaixa) => Math.round((l.destaque ? tamDestaque : tam) * 1.35);
  const altura = pad * 2 + linhas.reduce((s, l) => s + passo(l), 0) - Math.round(tam * 0.35);
  ctx.fillStyle = COR.heket;
  ctx.fillRect(x, y, largura, altura);
  ctx.fillStyle = COR.helios;
  ctx.fillRect(x, y, largura, Math.max(4, Math.round(8 * escala)));
  let cursor = y + pad;
  for (const l of linhas) {
    const px = l.destaque ? tamDestaque : tam;
    cursor += px;
    ctx.font = `${l.destaque ? 700 : 400} ${px}px ${familia}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(quebrarLinhas(ctx, l.texto, largura - pad * 2, 1)[0], x + pad, cursor);
    cursor += passo(l) - px;
  }
  return altura;
}

function alturaDaFaixa(linhas: LinhaFaixa[], escala: number) {
  if (!linhas.length) return 0;
  const pad = Math.round(36 * escala);
  const tamDestaque = Math.round(46 * escala);
  const tam = Math.round(36 * escala);
  return pad * 2 + linhas.reduce((s, l) => s + Math.round((l.destaque ? tamDestaque : tam) * 1.35), 0) - Math.round(tam * 0.35);
}

function cartazComoPostagem(foto: HTMLImageElement, formato: FormatoArte, e: EventoCompartilhavel): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Navegador sem suporte a desenho (canvas).");
  const proporcao = foto.width / foto.height;
  if (formato === "feed") {
    const p = Math.min(1.91, Math.max(0.8, proporcao));
    canvas.width = 1080;
    canvas.height = Math.round(1080 / p);
  } else if (formato === "whatsapp") {
    canvas.width = 1080;
    canvas.height = 1080;
  } else {
    canvas.width = 1080;
    canvas.height = 1920;
  }
  const { width: W, height: H } = canvas;
  // Fundo: a própria imagem cobrindo tudo, desfocada e escurecida (sem filtro no navegador, só escurece).
  const cobre = Math.max(W / foto.width, H / foto.height);
  ctx.filter = "blur(48px)";
  ctx.drawImage(foto, (W - foto.width * cobre) / 2, (H - foto.height * cobre) / 2, foto.width * cobre, foto.height * cobre);
  ctx.filter = "none";
  ctx.fillStyle = "rgba(5, 32, 28, 0.45)";
  ctx.fillRect(0, 0, W, H);
  // Cartaz inteiro por cima; no story, fora das faixas de cima e de baixo, com a faixa verde logo abaixo.
  const linhas = linhasQueFaltam(e);
  const topo = formato === "story" ? MEDIDAS.story.topo : 0;
  const base = formato === "story" ? MEDIDAS.story.base : 0;
  const margem = formato === "story" ? 48 : 0;
  // Story e WhatsApp: a faixa com o que falta fica abaixo do cartaz, sem cobri-lo.
  const faixaStory = formato !== "feed" && linhas.length ? alturaDaFaixa(linhas, 1) : 0;
  const caixaW = W - margem * 2;
  const caixaH = H - topo - base - faixaStory;
  const escala = Math.min(caixaW / foto.width, caixaH / foto.height);
  const w = Math.round(foto.width * escala);
  const h = Math.round(foto.height * escala);
  const x = Math.round((W - w) / 2);
  const y = Math.round(topo + (caixaH - h) / 2);
  ctx.save();
  if (formato === "story") {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 40;
  }
  ctx.drawImage(foto, x, y, w, h);
  ctx.restore();
  // O que falta no cartaz: no story, logo abaixo dele; no feed, por cima da parte de baixo.
  if (linhas.length) {
    if (formato === "story") desenharFaixa(ctx, linhas, x, y + h, w, Math.min(1, w / 1000));
    else if (formato === "whatsapp") desenharFaixa(ctx, linhas, 0, H - faixaStory, W, 1);
    else {
      const escala = W / 1080;
      desenharFaixa(ctx, linhas, 0, H - alturaDaFaixa(linhas, escala), W, escala);
    }
  }
  return paraBlob(canvas);
}

export async function gerarArteEvento(e: EventoCompartilhavel, formato: FormatoArte): Promise<Blob> {
  // Com cartaz do evento, ele é a postagem; sem cartaz (ou se não carregar), a arte montada abaixo.
  if (e.imagem) {
    const cartaz = await carregarImagem(enderecoDaImagem(e.imagem)).catch(() => null);
    if (cartaz) return cartazComoPostagem(cartaz, formato, e);
  }
  const m = MEDIDAS[formato];
  const canvas = document.createElement("canvas");
  canvas.width = m.w;
  canvas.height = m.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Navegador sem suporte a desenho (canvas).");

  // Mesma família que o Portal já carregou (next/font), com reserva.
  const familia = getComputedStyle(document.body).fontFamily || "Arial, sans-serif";
  const fonte = (peso: number, px: number) => `${peso} ${px}px ${familia}`;
  await Promise.all([document.fonts.load(fonte(700, 80)), document.fonts.load(fonte(400, 40))]).catch(() => {});
  const espacar = (px: number) => {
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  };
  const larguraUtil = m.w - MARGEM * 2;
  const story = formato === "story";

  // --- Medir antes de desenhar: o título encolhe até tudo caber acima da faixa.
  const [logo, foto] = await Promise.all([
    carregarImagem("/na-logo.png").catch(() => null),
    e.imagem ? carregarImagem(enderecoDaImagem(e.imagem)).catch(() => null) : Promise.resolve(null),
  ]);
  // Com imagem do evento, o logo encolhe para sobrar espaço para ela.
  const larguraLogo = foto ? Math.round(m.logo * 0.72) : m.logo;
  const alturaLogo = logo ? (logo.height / logo.width) * larguraLogo : 0;
  const yFaixa = m.h - m.base - m.faixa;
  const yChamada = m.topo + alturaLogo + (story ? 80 : 56) + 10 + (story ? 56 : 44);
  const yFoto = yChamada + (story ? 44 : 32);


  ctx.font = fonte(400, m.local);
  const linhasLocal = e.location ? quebrarLinhas(ctx, e.location, larguraUtil, 2) : [];
  const passoData = Math.round(m.data * 1.35);
  const passoLocal = Math.round(m.local * 1.45);
  const valor = e.valorTexto ?? (e.interno && e.price !== undefined
    ? e.price === 0 ? "Entrada gratuita" : e.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null);
  const espacoAntesData = foto ? (story ? 88 : 72) : story ? 110 : 90;
  const alturaInfo = m.data + (e.allDay ? 0 : passoData) + (linhasLocal.length + (valor ? 1 : 0)) * passoLocal;
  const folgaFaixa = story ? 90 : 70;
  // Imagem do evento (pedido do usuário 2026-10-22) logo abaixo da chamada, inteira (sem cortar o cartaz).
  // Ocupa só o espaço que sobra depois de reservar duas linhas de título, a data e o local.
  const reservaTitulo = 2 * Math.round((story ? 84 : 72) * 1.12);
  const gapFoto = story ? 40 : 30;
  const sobraParaFoto = yFaixa - folgaFaixa - alturaInfo - espacoAntesData - reservaTitulo - gapFoto - yFoto;
  const alturaMaxFoto = Math.min(story ? 620 : 340, sobraParaFoto);
  const usarFoto = foto && alturaMaxFoto >= 160;
  const escalaFoto = usarFoto ? Math.min(larguraUtil / foto.width, alturaMaxFoto / foto.height) : 0;
  const fotoW = usarFoto ? Math.round(foto.width * escalaFoto) : 0;
  const fotoH = usarFoto ? Math.round(foto.height * escalaFoto) : 0;
  const yInicioTitulo = (usarFoto ? yFoto + fotoH : yChamada) + gapFoto;
  const alturaParaTitulo = yFaixa - folgaFaixa - alturaInfo - espacoAntesData - yInicioTitulo;

  let tamTitulo: number = m.titulo;
  let linhasTitulo: string[] = [];
  for (; tamTitulo >= TITULO_MINIMO; tamTitulo -= 4) {
    ctx.font = fonte(700, tamTitulo);
    linhasTitulo = quebrarLinhas(ctx, e.title, larguraUtil, 99);
    const cabemLinhas = Math.min(m.linhasTitulo, Math.floor(alturaParaTitulo / Math.round(tamTitulo * 1.12)));
    if (linhasTitulo.length <= cabemLinhas) break;
  }
  tamTitulo = Math.max(tamTitulo, TITULO_MINIMO);
  const entrelinhaTitulo = Math.round(tamTitulo * 1.12);
  ctx.font = fonte(700, tamTitulo);
  linhasTitulo = quebrarLinhas(ctx, e.title, larguraUtil, Math.max(1, Math.min(m.linhasTitulo, Math.floor(alturaParaTitulo / entrelinhaTitulo))));

  // --- Desenho.
  ctx.fillStyle = COR.papel;
  ctx.fillRect(0, 0, m.w, m.h);
  ctx.textBaseline = "alphabetic";

  if (logo) ctx.drawImage(logo, MARGEM, m.topo, larguraLogo, alturaLogo);

  // Filete Helios + chamada.
  const yFilete = m.topo + alturaLogo + (story ? 80 : 56);
  ctx.fillStyle = COR.helios;
  ctx.fillRect(MARGEM, yFilete, 120, 10);
  ctx.fillStyle = COR.heliosEscuro;
  ctx.font = fonte(700, story ? 34 : 30);
  espacar(4);
  ctx.fillText(e.chamada ?? (e.interno ? "ENCONTRO DA ESCOLA" : "EVENTO ABERTO AO PÚBLICO"), MARGEM, yChamada);
  espacar(0);

  if (usarFoto && foto) {
    const x = MARGEM + Math.round((larguraUtil - fotoW) / 2);
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, yFoto, fotoW, fotoH, 24);
    else ctx.rect(x, yFoto, fotoW, fotoH);
    ctx.clip();
    ctx.drawImage(foto, x, yFoto, fotoW, fotoH);
    ctx.restore();
  }

  let y = yInicioTitulo;
  ctx.fillStyle = COR.heketEscuro;
  ctx.font = fonte(700, tamTitulo);
  for (const linha of linhasTitulo) {
    y += entrelinhaTitulo;
    ctx.fillText(linha, MARGEM, y);
  }

  // Quando e onde.
  y += espacoAntesData;
  ctx.fillStyle = COR.texto;
  ctx.font = fonte(700, m.data);
  ctx.fillText(primeiraMaiuscula(diaPorExtenso(e.date)), MARGEM, y);
  if (!e.allDay) {
    y += passoData;
    ctx.font = fonte(400, m.data);
    ctx.fillText(`às ${horaCurta(e.date)}`, MARGEM, y);
  }
  ctx.fillStyle = COR.textoSuave;
  ctx.font = fonte(400, m.local);
  for (const linha of linhasLocal) {
    y += passoLocal;
    ctx.fillText(linha, MARGEM, y);
  }

  if (valor) {
    y += passoLocal;
    ctx.font = fonte(700, m.local);
    ctx.fillStyle = COR.heket;
    ctx.fillText(valor, MARGEM, y);
  }

  // A arte do WhatsApp (feed) leva só os dados visuais. O convite completo
  // acompanha o arquivo como texto; a descrição desenhada fica só no story.
  if (story && e.description) {
    const entrelinha = 52;
    const cabem = Math.min(6, Math.floor((yFaixa - folgaFaixa - (y + 60)) / entrelinha));
    if (cabem >= 2) {
      ctx.font = fonte(400, 36);
      ctx.fillStyle = COR.textoSuave;
      y += 60;
      for (const linha of quebrarLinhas(ctx, resumo(semEmoji(e.description), 400), larguraUtil, cabem)) {
        y += entrelinha;
        ctx.fillText(linha, MARGEM, y);
      }
    }
  }

  // Faixa de inscrição (verde Heket) até o pé da imagem.
  ctx.fillStyle = COR.heket;
  ctx.fillRect(0, yFaixa, m.w, m.h - yFaixa);
  ctx.fillStyle = COR.helios;
  ctx.font = fonte(700, story ? 34 : 30);
  espacar(4);
  ctx.fillText(e.chamadaInscricao ?? (e.interno ? "CONFIRME NO PORTAL" : "INSCRIÇÕES"), MARGEM, yFaixa + (story ? 90 : 86));
  espacar(0);
  ctx.fillStyle = "#ffffff";
  ctx.font = fonte(700, story ? 44 : 40);
  const site = new URL(e.registrationUrl).host.replace(/^www\./, "");
  ctx.fillText(quebrarLinhas(ctx, site, larguraUtil, 1)[0], MARGEM, yFaixa + (story ? 154 : 146));

  return paraBlob(canvas);
}
