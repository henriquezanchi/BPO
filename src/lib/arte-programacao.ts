import { MENSAGEM_CHAVE, MESES, MESES_ABREV, SEMANA_ABREV, descricaoComHorario, type ItemProgramacao } from "@/lib/programacao-mes";

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
const MAX_ITENS = 10;

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
  const cab = [d.publico].filter(Boolean).map((s) => s!.toUpperCase());
  cab.forEach((l, i) => ctx.fillText(l, W - PAD.lado, PAD.topo + 8 + i * 28));
  espacar(ctx, 0, 1);
  ctx.textAlign = "left";

  // Medidas da lista primeiro, para distribuir os blocos na altura (como no modelo: espaço igual entre cabeçalho,
  // título, lista e rodapé quando sobra lugar).
  const yTitulo0 = PAD.topo + Math.max(alturaLogo, 60) + 64;
  const ALTURA_TITULO = 40 + 118 + 32;
  const yLista0 = yTitulo0 + ALTURA_TITULO + 48;
  let itens = d.itens.slice(0, MAX_ITENS);
  const rodapeY = H - PAD.base - 20;
  const disponivelTotal = rodapeY - 40 - yLista0;
  // Até 7 no tamanho cheio; mais do que isso, encolhe (dia até 48, título até 26, descrição até 19).
  const escala = itens.length <= 7 ? 1 : Math.max(0.8, Math.min(1, 7 / itens.length + 0.15));
  const T = { dia: Math.round(60 * escala), sub: 17, titulo: Math.round(31 * escala), desc: Math.round(22 * escala), padV: Math.round(20 * escala) };
  const colData = 150;
  const xConteudo = PAD.lado + colData + 28;
  const larguraConteudo = W - PAD.lado - xConteudo;

  const medir = (i: ItemProgramacao) => {
    ctx.font = f(900, T.titulo);
    const tit = quebrar(ctx, i.titulo, larguraConteudo - (i.tipo === "prova" ? 150 : 0), 2);
    ctx.font = f(400, T.desc);
    const desc = descricaoComHorario(i);
    const linhasDesc = desc ? quebrar(ctx, desc, larguraConteudo, 2) : [];
    const altoConteudo = tit.length * T.titulo * 1.12 + (linhasDesc.length ? 6 + linhasDesc.length * T.desc * 1.3 : 0);
    const altoData = T.dia + 6 + T.sub;
    return { tit, linhasDesc, alto: Math.max(altoConteudo, altoData) };
  };
  let medidas = itens.map(medir);
  // O que não couber vira "+ N compromissos no Portal" (nunca passa do rodapé).
  const PAD_MIN = 8;
  const somaAte = (k: number) => medidas.slice(0, k).reduce((s, m) => s + m.alto + 2 * PAD_MIN, 0);
  let cabem = medidas.length;
  while (cabem > 1 && somaAte(cabem) > disponivelTotal - (cabem < d.itens.length ? 34 : 0)) cabem--;
  itens = itens.slice(0, cabem);
  medidas = medidas.slice(0, cabem);
  const sobra = d.itens.length - itens.length;
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
  ctx.fillText(`${MESES[d.mes - 1]} ${d.ano}`.toUpperCase(), PAD.lado, y);
  espacar(ctx, 0, 1);
  y += 40;
  ctx.fillStyle = COR.branco;
  if (d.turma) {
    // Nome do grupo em destaque, encolhendo até caber em uma linha (mínimo 56 px; aí quebra em duas).
    let tam = 104;
    ctx.font = f(900, tam);
    while (tam > 56 && ctx.measureText(d.turma).width > W - 2 * PAD.lado) ctx.font = f(900, (tam -= 4));
    const linhas = quebrar(ctx, d.turma, W - 2 * PAD.lado, 2);
    const altoLinha = Math.round(tam * 1.05);
    const desloca = Math.round(((linhas.length - 1) * altoLinha) / 2);
    linhas.forEach((l, i) => ctx.fillText(l, PAD.lado, y - desloca + i * altoLinha));
    y += 118 + desloca;
    ctx.fillStyle = COR.claro;
    ctx.font = f(400, 32);
    ctx.fillText(`Programação de ${MESES[d.mes - 1]}`, PAD.lado, y);
  } else {
    ctx.font = f(900, 104);
    ctx.fillText("Programação", PAD.lado, y);
    y += 118;
    ctx.fillStyle = COR.claro;
    ctx.font = f(400, 32);
    ctx.fillText(`da nossa escola em ${MESES[d.mes - 1]}`, PAD.lado, y);
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
    // Data.
    ctx.fillStyle = COR.destaque;
    ctx.font = f(900, T.dia);
    ctx.fillText(String(i.dia).padStart(2, "0"), PAD.lado, topo - T.dia * 0.08);
    ctx.fillStyle = COR.claro;
    ctx.font = f(700, T.sub);
    espacar(ctx, 0.12, T.sub);
    ctx.fillText(`${MESES_ABREV[i.mes - 1]} · ${SEMANA_ABREV[i.semana]}`, PAD.lado, topo + T.dia + 4);
    espacar(ctx, 0, 1);
    // Conteúdo.
    let yy = topo;
    ctx.fillStyle = COR.branco;
    ctx.font = f(900, T.titulo);
    m.tit.forEach((l, n) => {
      ctx.fillText(l, xConteudo, yy);
      if (n === 0 && i.tipo === "prova") {
        // Selo "ATENÇÃO" ao lado do título.
        const largTit = ctx.measureText(l).width;
        ctx.font = f(900, 15);
        espacar(ctx, 0.12, 15);
        const largSelo = ctx.measureText("ATENÇÃO").width + 32;
        const xs = xConteudo + largTit + 18;
        const ys = yy + (T.titulo - 30) / 2 + 2;
        ctx.fillStyle = COR.destaque;
        ctx.beginPath();
        ctx.roundRect(xs, ys, largSelo, 30, 15);
        ctx.fill();
        ctx.fillStyle = COR.selo;
        ctx.fillText("ATENÇÃO", xs + 16, ys + 7);
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
