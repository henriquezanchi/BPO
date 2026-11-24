import { MENSAGEM_CHAVE, MESES_ABREV, SEMANA_ABREV, rotuloDoPeriodo, type ItemProgramacao } from "@/lib/programacao-mes";

/**
 * Arte "Programação" do mês, 1080×1350 (4:5), no guia da marca (17/11/2026; modelo da Turma Hilárion):
 * fundo Verde Heket, datas em Amarelo Helios, texto branco e verde claro, círculos Turquesa Kefer no canto, Noto Sans
 * (900 nos títulos, 400 no texto, 700 nos rótulos), logotipo branco. Desenhada no navegador (canvas), como a arte
 * dos eventos (lib/arte-evento.ts).
 */
const W = 1080;
const H = 1350;
const COR = { fundo: "#086357", destaque: "#FFCA00", branco: "#FFFFFF", claro: "#B2DFD9", kefer: "#009485", selo: "#062F29" };
const PAD = { topo: 72, lado: 80, base: 64 };
/** Selo ao lado do título: "ATENÇÃO" na prova; o motivo do cancelamento (ex.: "RECESSO") na reunião cancelada. */
const seloDe = (i: ItemProgramacao) => (i.tipo === "prova" ? "ATENÇÃO" : i.tipo === "cancelada" ? (i.descricao || "Cancelada").toUpperCase().slice(0, 18) : null);
const MAX_ITENS = 14;

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error(`Não carregou ${src}`));
    img.src = src;
  });
}

/** Versão branca (negativa) do logotipo: a marca e "NOVA ACRÓPOLE", sem a linha "Escola de Filosofia". */
function logoBranco(img: HTMLImageElement): HTMLCanvasElement {
  const altura = Math.round(img.height * 0.8);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = altura;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0, img.width, altura, 0, 0, img.width, altura);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = COR.branco;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number, maxLinhas: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const p of texto.split(/\s+/).filter(Boolean)) {
    const t = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(t).width <= largura || !atual) atual = t;
    else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length > maxLinhas) {
    const corte = linhas.slice(0, maxLinhas);
    let ultima = corte[maxLinhas - 1];
    while (ultima && ctx.measureText(`${ultima}…`).width > largura) ultima = ultima.replace(/\s*\S+$/, "");
    corte[maxLinhas - 1] = `${ultima}…`;
    return corte;
  }
  return linhas;
}

function espacar(ctx: CanvasRenderingContext2D, em: number, px: number) {
  // letterSpacing existe nos navegadores atuais; nos antigos, o texto sai sem espaçamento extra.
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${(em * px).toFixed(2)}px`;
}

export async function gerarArteProgramacao(d: {
  turma: string | null;
  publico: string;
  ano: number;
  mes: number;
  itens: ItemProgramacao[];
  rodapeDireita: string;
  /** AAAA-MM-DD no fuso da filial: dias anteriores saem riscados e semiapagados (24/11/2026). */
  hoje?: string;
  /** Quantos meses a partir de ano/mes (24/11/2026); padrão 1. */
  meses?: number;
  /** Presencial/online e sala ou link (24/11/2026), no cabeçalho à direita. */
  onde?: string | null;
}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const familia = getComputedStyle(document.body).fontFamily || "'Noto Sans', Arial, sans-serif";
  const f = (peso: number, px: number) => `${peso} ${px}px ${familia}`;
  await Promise.all([document.fonts.load(f(900, 100)), document.fonts.load(f(700, 20)), document.fonts.load(f(400, 30))]).catch(() => {});

  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, W, H);

  // Círculos concêntricos no canto superior direito, cortados pela borda e longe do texto.
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = COR.kefer;
  ctx.lineWidth = 2;
  for (let r = 120; r <= 520; r += 100) {
    ctx.beginPath();
    ctx.arc(W + 40, 120, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Cabeçalho: logotipo à esquerda; turma e público à direita.
  const logo = await carregar("/na-logo.png").then(logoBranco).catch(() => null);
  const larguraLogo = 190;
  const alturaLogo = logo ? Math.round((logo.height / logo.width) * larguraLogo) : 0;
  if (logo) ctx.drawImage(logo, PAD.lado, PAD.topo, larguraLogo, alturaLogo);
  ctx.textBaseline = "top";
  ctx.textAlign = "right";
  ctx.fillStyle = COR.claro;
  ctx.font = f(700, 18);
  espacar(ctx, 0.18, 18);
  // Com turma, o nome dela vira o título grande (pedido do usuário 24/11/2026) e sai do cabeçalho.
  const cab = [d.publico, d.onde].filter(Boolean).map((s) => s!.toUpperCase());
  cab.forEach((l, i) => ctx.fillText(l, W - PAD.lado, PAD.topo + 8 + i * 28));
  espacar(ctx, 0, 1);
  ctx.textAlign = "left";

  // Medidas da lista primeiro, para distribuir os blocos na altura (como no modelo: espaço igual entre cabeçalho,
  // título, lista e rodapé quando sobra lugar).
  const yTitulo0 = PAD.topo + Math.max(alturaLogo, 60) + 64;
  // Título grande = nome da turma (24/11/2026): encolhe até caber em uma linha; abaixo de 64 px, vai para duas linhas
  // menores e o bloco do título cresce, para não invadir o mês acima nem a lista abaixo.
  const titulo = (() => {
    if (!d.turma) return { linhas: ["Programação"], tam: 104, altoLinha: 118 };
    let tam = 104;
    ctx.font = f(900, tam);
    while (tam > 64 && ctx.measureText(d.turma).width > W - 2 * PAD.lado) ctx.font = f(900, (tam -= 4));
    if (ctx.measureText(d.turma).width <= W - 2 * PAD.lado) return { linhas: [d.turma], tam, altoLinha: 118 };
    ctx.font = f(900, 58);
    return { linhas: quebrar(ctx, d.turma, W - 2 * PAD.lado, 2), tam: 58, altoLinha: 66 };
  })();
  const ALTURA_TITULO = 40 + (titulo.linhas.length > 1 ? 72 + (titulo.linhas.length - 1) * titulo.altoLinha : 118) + 32;
  const yLista0 = yTitulo0 + ALTURA_TITULO + 48;
  const rodapeY = H - PAD.base - 20;
  const disponivelTotal = rodapeY - 40 - yLista0;
  const colData = 150;
  const xConteudo = PAD.lado + colData + 28;
  const larguraConteudo = W - PAD.lado - xConteudo;
  const PAD_MIN = 8;

  type Medida = { tit: string[]; linhasDesc: string[]; alto: number };
  type Tamanhos = { dia: number; sub: number; titulo: number; desc: number; padV: number };
  const tamanhos = (escala: number): Tamanhos => ({ dia: Math.round(60 * escala), sub: Math.round(17 * Math.max(0.85, escala)), titulo: Math.round(31 * escala), desc: Math.round(22 * escala), padV: Math.round(20 * escala) });
  // Compacto (24/11/2026): descrição numa linha só e até 3 apresentações, para caber o período inteiro sem espremer.
  const medir = (i: ItemProgramacao, T: Tamanhos, compacto: boolean): Medida => {
    ctx.font = f(900, T.titulo);
    const selo = seloDe(i);
    const tit = quebrar(ctx, i.titulo, larguraConteudo - (selo ? (i.tipo === "prova" ? 150 : 230) : 0), compacto ? 1 : 2);
    ctx.font = f(400, T.desc);
    // Horário fica junto da data (24/11/2026), não no fim da descrição.
    const desc = i.tipo === "cancelada" ? null : i.descricao;
    // Apresentações dos pedagogos (24/11/2026): uma por linha, até 4 (3 no compacto), para o nome e o tema ficarem legíveis.
    const linhasDesc = !desc ? [] : desc.includes(" — ") ? desc.split("; ").slice(0, compacto ? 3 : 4).map((l) => quebrar(ctx, l, larguraConteudo, 1)[0]) : quebrar(ctx, desc, larguraConteudo, compacto ? 1 : 2);
    const altoConteudo = tit.length * T.titulo * 1.12 + (linhasDesc.length ? 6 + linhasDesc.length * T.desc * 1.3 : 0);
    const altoData = T.dia + 6 + T.sub + (i.horario ? T.sub + 6 : 0);
    return { tit, linhasDesc, alto: Math.max(altoConteudo, altoData) };
  };
  const cabeTudo = (ms: Medida[]) => ms.reduce((s, m) => s + m.alto + 2 * PAD_MIN, 0) <= disponivelTotal;

  // Quando não cabe tudo (24/11/2026): primeiro saem os compromissos já passados; depois o formato fica compacto
  // (letra menor, um resumo por item); só por último entra o "+ N compromissos no Portal".
  const futuros = d.hoje ? d.itens.filter((i) => i.data >= d.hoje!) : d.itens;
  const tentativas: { lista: ItemProgramacao[]; escala: number; compacto: boolean }[] = [
    { lista: d.itens, escala: 1, compacto: false },
    { lista: futuros, escala: 1, compacto: false },
    { lista: futuros, escala: 0.86, compacto: true },
    { lista: futuros, escala: 0.74, compacto: true },
  ];
  let escolha = tentativas[tentativas.length - 1];
  for (const t of tentativas) {
    if (t.lista.length <= MAX_ITENS && cabeTudo(t.lista.slice(0, MAX_ITENS).map((i) => medir(i, tamanhos(t.escala), t.compacto)))) { escolha = t; break; }
  }
  const T = tamanhos(escolha.escala);
  let itens = escolha.lista.slice(0, MAX_ITENS);
  let medidas = itens.map((i) => medir(i, T, escolha.compacto));
  // O que ainda não couber vira "+ N compromissos no Portal" (nunca passa do rodapé).
  const somaAte = (k: number) => medidas.slice(0, k).reduce((s, m) => s + m.alto + 2 * PAD_MIN, 0);
  let cabem = medidas.length;
  while (cabem > 1 && somaAte(cabem) > disponivelTotal - (cabem < escolha.lista.length ? 34 : 0)) cabem--;
  itens = itens.slice(0, cabem);
  medidas = medidas.slice(0, cabem);
  const sobra = escolha.lista.length - itens.length;
  const disponivel = disponivelTotal - (sobra ? 34 : 0);
  const totalConteudo = medidas.reduce((s, m) => s + m.alto, 0);
  const padV = Math.max(8, Math.min(T.padV, (disponivel - totalConteudo) / Math.max(1, itens.length) / 2));
  const folga = Math.max(0, disponivel - (totalConteudo + 2 * padV * itens.length));
  const extra = Math.min(folga / 3, 90);

  // Título.
  let y = yTitulo0 + extra;
  ctx.fillStyle = COR.destaque;
  ctx.font = f(700, 22);
  espacar(ctx, 0.22, 22);
  ctx.fillText(rotuloDoPeriodo(d.ano, d.mes, d.meses ?? 1).cabecalho.toUpperCase(), PAD.lado, y);
  espacar(ctx, 0, 1);
  y += 40;
  ctx.fillStyle = COR.branco;
  if (d.turma) {
    ctx.font = f(900, titulo.tam);
    // Linhas para baixo a partir do mês (nunca sobre ele); o bloco do título cresce com as linhas extras.
    titulo.linhas.forEach((l, i) => ctx.fillText(l, PAD.lado, y + i * titulo.altoLinha));
    y += titulo.linhas.length > 1 ? 72 + (titulo.linhas.length - 1) * titulo.altoLinha : 118;
    ctx.fillStyle = COR.claro;
    ctx.font = f(400, 32);
    ctx.fillText(`Programação de ${rotuloDoPeriodo(d.ano, d.mes, d.meses ?? 1).curto}`, PAD.lado, y);
  } else {
    ctx.font = f(900, 104);
    ctx.fillText("Programação", PAD.lado, y);
    y += 118;
    ctx.fillStyle = COR.claro;
    ctx.font = f(400, 32);
    ctx.fillText(`da nossa escola em ${rotuloDoPeriodo(d.ano, d.mes, d.meses ?? 1).curto}`, PAD.lado, y);
  }
  y = yLista0 + 2 * extra;

  const linhaDivisoria = (yy: number) => {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = COR.claro;
    ctx.fillRect(PAD.lado, yy, W - 2 * PAD.lado, 2);
    ctx.restore();
  };

  linhaDivisoria(y);
  itens.forEach((i, k) => {
    const m = medidas[k];
    const topo = y + padV;
    // Dia já passado (24/11/2026): meio apagado, com ✓ no título; só a agenda futura fica "aberta".
    const passado = !!d.hoje && i.data < d.hoje;
    const cancelada = i.tipo === "cancelada";
    ctx.save();
    if (passado || cancelada) ctx.globalAlpha = 0.55;
    // Data.
    ctx.fillStyle = COR.destaque;
    ctx.font = f(900, T.dia);
    ctx.fillText(String(i.dia).padStart(2, "0"), PAD.lado, topo - T.dia * 0.08);
    ctx.fillStyle = COR.claro;
    ctx.font = f(700, T.sub);
    espacar(ctx, 0.12, T.sub);
    ctx.fillText(`${MESES_ABREV[i.mes - 1]} · ${SEMANA_ABREV[i.semana]}`, PAD.lado, topo + T.dia + 4);
    espacar(ctx, 0, 1);
    if (i.horario) {
      ctx.fillStyle = COR.destaque;
      ctx.font = f(700, T.sub + 2);
      ctx.fillText(i.horario, PAD.lado, topo + T.dia + 4 + T.sub + 6);
    }
    // Conteúdo.
    let yy = topo;
    ctx.fillStyle = COR.branco;
    ctx.font = f(900, T.titulo);
    m.tit.forEach((l, n) => {
      ctx.fillText(l, xConteudo, yy);
      if (passado && !cancelada && n === 0) {
        // Já aconteceu (24/11/2026): ✓ ao lado do título, sem risco; a linha fica só meio apagada.
        const larg = ctx.measureText(l).width;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.fillStyle = COR.destaque;
        ctx.font = f(900, T.titulo);
        ctx.fillText("✓", xConteudo + larg + 14, yy);
        ctx.restore();
      }
      const selo = seloDe(i);
      if (n === 0 && selo) {
        // Selo ao lado do título: "ATENÇÃO" na prova; o motivo ("RECESSO") na reunião cancelada.
        const largTit = ctx.measureText(l).width;
        ctx.font = f(900, 15);
        espacar(ctx, 0.12, 15);
        const largSelo = ctx.measureText(selo).width + 32;
        const xs = xConteudo + largTit + 18;
        const ys = yy + (T.titulo - 30) / 2 + 2;
        ctx.fillStyle = COR.destaque;
        ctx.beginPath();
        ctx.roundRect(xs, ys, largSelo, 30, 15);
        ctx.fill();
        ctx.fillStyle = COR.selo;
        ctx.fillText(selo, xs + 16, ys + 7);
        espacar(ctx, 0, 1);
        ctx.fillStyle = COR.branco;
        ctx.font = f(900, T.titulo);
      }
      yy += T.titulo * 1.12;
    });
    if (m.linhasDesc.length) {
      yy += 6;
      ctx.fillStyle = COR.claro;
      ctx.font = f(400, T.desc);
      m.linhasDesc.forEach((l) => {
        ctx.fillText(l, xConteudo, yy);
        yy += T.desc * 1.3;
      });
    }
    ctx.restore();
    y = topo + m.alto + padV;
    linhaDivisoria(y);
  });
  if (sobra) {
    ctx.fillStyle = COR.claro;
    ctx.font = f(400, 20);
    ctx.fillText(`+ ${sobra} ${sobra === 1 ? "compromisso" : "compromissos"} no Portal`, PAD.lado, y + 14);
  }

  // Rodapé.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COR.branco;
  ctx.font = f(700, 20);
  ctx.fillText(MENSAGEM_CHAVE, PAD.lado, H - PAD.base);
  ctx.textAlign = "right";
  ctx.fillStyle = COR.claro;
  ctx.font = f(400, 20);
  ctx.fillText(d.rodapeDireita, W - PAD.lado, H - PAD.base);

  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao gerar a imagem."))), "image/png"));
}
