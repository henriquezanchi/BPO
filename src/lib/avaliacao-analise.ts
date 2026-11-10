import { MINIMO_RESPOSTAS, type Pergunta } from "./avaliacao-comum";

/**
 * Painel de análise da avaliação dos instrutores (pedido do usuário 10/11/2026: "além dos dados, sugerir informações
 * pelo cruzamento dos dados, para ajudar o professor a melhorar as aulas e a direção/Escolástica a orientar").
 *
 * Cálculo puro sobre as respostas anônimas de uma rodada. Funciona com qualquer questionário da filial:
 *  - nota do instrutor = a 1ª pergunta de escala da parte do instrutor; recomendação = a 1ª escala da parte geral;
 *  - cruza a recomendação com cada pergunta de escolha da parte geral (mesma resposta, então o cruzamento vale);
 *  - separa o que parece ser do instrutor (abaixo da escola em todas as turmas dele) do que parece ser da turma
 *    (todos os instrutores da turma abaixo da escola);
 *  - nunca mostra recorte com menos de MINIMO_RESPOSTAS respostas (anonimato).
 */
export type RespostaAnalise = {
  parte: string;
  classGroupId: string | null;
  turmaNome: string | null;
  instrutorMatr: string | null;
  instrutorNome: string | null;
  respostas: unknown;
};

export type Tom = "positivo" | "atencao" | "neutro";
export type Achado = { tom: Tom; titulo: string; texto: string };

const num = (v: unknown) => (v === null || v === undefined || v === "" ? NaN : Number(v));
const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const desvio = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
const f1 = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const valorDe = (r: RespostaAnalise, id: string) => (r.respostas && typeof r.respostas === "object" ? (r.respostas as Record<string, unknown>)[id] : undefined);

/** Diferença que vale comentar: 10% da amplitude da escala (1 ponto numa escala de 1 a 10). */
const relevante = (p: Pergunta) => ((p.max ?? 10) - (p.min ?? 0)) * 0.1;
/** Nota baixa: na metade de baixo da escala. */
const baixa = (p: Pergunta, v: number) => v <= (p.min ?? 0) + ((p.max ?? 10) - (p.min ?? 0)) / 2;

export type Grupo = { id: string; rotulo: string; total: number; media: number | null; desvio: number | null; baixas: number };

function agrupar(rs: RespostaAnalise[], p: Pergunta, chave: (r: RespostaAnalise) => string | null, rotulo: (r: RespostaAnalise) => string): Grupo[] {
  const g = new Map<string, { rotulo: string; notas: number[] }>();
  for (const r of rs) {
    const k = chave(r);
    const v = num(valorDe(r, p.id));
    if (!k || !Number.isFinite(v)) continue;
    const x = g.get(k) ?? { rotulo: rotulo(r), notas: [] };
    x.notas.push(v);
    g.set(k, x);
  }
  return [...g.entries()].map(([id, x]) => {
    const ok = x.notas.length >= MINIMO_RESPOSTAS;
    return { id, rotulo: x.rotulo, total: x.notas.length, media: ok ? media(x.notas) : null, desvio: ok ? desvio(x.notas) : null, baixas: ok ? x.notas.filter((v) => baixa(p, v)).length : 0 };
  });
}

export type Analise = {
  nota: { pergunta: Pergunta; escola: number | null; total: number; porInstrutor: Grupo[]; porTurma: Grupo[] } | null;
  recomendacao: { pergunta: Pergunta; escola: number | null; total: number; nps: number | null; porTurma: Grupo[] } | null;
  cruzamentos: { pergunta: Pergunta; linhas: { opcao: string; total: number; media: number | null }[] }[];
  achadosDirecao: Achado[];
};

export function analisarRodada(perguntas: Pergunta[], respostas: RespostaAnalise[]): Analise {
  const inst = respostas.filter((r) => r.parte === "instrutor");
  const geral = respostas.filter((r) => r.parte === "geral");
  const pNota = perguntas.find((p) => p.parte === "instrutor" && p.tipo === "escala");
  const pRec = perguntas.find((p) => p.parte === "geral" && p.tipo === "escala");
  const achados: Achado[] = [];

  let nota: Analise["nota"] = null;
  if (pNota) {
    const notas = inst.map((r) => num(valorDe(r, pNota.id))).filter(Number.isFinite);
    const escola = notas.length >= MINIMO_RESPOSTAS ? media(notas) : null;
    const porInstrutor = agrupar(inst, pNota, (r) => r.instrutorMatr, (r) => r.instrutorNome ?? "—");
    const porTurma = agrupar(inst, pNota, (r) => r.classGroupId, (r) => r.turmaNome ?? "—");
    nota = { pergunta: pNota, escola, total: notas.length, porInstrutor, porTurma };

    if (escola !== null) {
      const d = relevante(pNota);
      // Instrutor × turma: o que é do instrutor e o que é da turma.
      const celulas = agrupar(inst, pNota, (r) => (r.instrutorMatr && r.classGroupId ? `${r.instrutorMatr}|${r.classGroupId}` : null), (r) => `${r.instrutorNome ?? "—"}|${r.turmaNome ?? "—"}`).filter(
        (c) => c.media !== null,
      );
      const turmasBaixas = porTurma.filter((t) => t.media !== null && t.media <= escola - d);
      for (const t of turmasBaixas) {
        const daTurma = celulas.filter((c) => c.id.endsWith(`|${t.id}`));
        if (daTurma.length >= 2 && daTurma.every((c) => c.media! <= escola - d / 2))
          achados.push({
            tom: "atencao",
            titulo: `${t.rotulo}: a turma toda avalia abaixo`,
            texto: `Todos os instrutores de ${t.rotulo} ficaram abaixo da média da escola (${f1(t.media!)} contra ${f1(escola)}). Quando isso acontece com instrutores diferentes, a causa costuma ser da turma (horário, sala, momento do curso, integração entre os alunos), não de um instrutor. Vale uma conversa com a turma.`,
          });
      }
      for (const i of porInstrutor.filter((x) => x.media !== null)) {
        const suas = celulas.filter((c) => c.id.startsWith(`${i.id}|`));
        const nome = i.rotulo;
        if (suas.length >= 2) {
          const melhor = suas.reduce((a, b) => (b.media! > a.media! ? b : a));
          const pior = suas.reduce((a, b) => (b.media! < a.media! ? b : a));
          if (melhor.media! - pior.media! >= 2 * d)
            achados.push({
              tom: "neutro",
              titulo: `${nome}: resultado muda de uma turma para outra`,
              texto: `Média ${f1(melhor.media!)} em ${melhor.rotulo.split("|")[1]} e ${f1(pior.media!)} em ${pior.rotulo.split("|")[1]}. O que funciona numa turma pode ser levado para a outra; vale perguntar ao instrutor o que é diferente entre elas.`,
            });
          else if (suas.every((c) => c.media! <= escola - d))
            achados.push({
              tom: "atencao",
              titulo: `${nome}: abaixo da escola em todas as turmas`,
              texto: `Média ${f1(i.media!)} (escola ${f1(escola)}), abaixo em todas as turmas em que dá aula. Como se repete em turmas diferentes, vale um acompanhamento pedagógico: assistir a uma aula e conversar sobre os comentários dos alunos.`,
            });
        } else if (i.media! <= escola - d)
          achados.push({ tom: "atencao", titulo: `${nome}: abaixo da média da escola`, texto: `Média ${f1(i.media!)} contra ${f1(escola)} da escola. Os comentários dos alunos ajudam a entender o porquê.` });
        if (i.media! >= escola + d)
          achados.push({
            tom: "positivo",
            titulo: `${nome}: bem acima da média`,
            texto: `Média ${f1(i.media!)} contra ${f1(escola)} da escola. Pode valer pedir que compartilhe com os outros instrutores como prepara e conduz as aulas.`,
          });
        if (i.desvio !== null && i.desvio >= 2 * d && i.total >= 5)
          achados.push({
            tom: "neutro",
            titulo: `${nome}: opiniões divididas`,
            texto: `As notas variam muito entre os alunos (${i.baixas} de ${i.total} na metade de baixo da escala). Parte da turma está bem atendida e parte não: ritmo, profundidade ou linguagem podem não servir a todos.`,
          });
      }
      const totalBaixas = inst.filter((r) => Number.isFinite(num(valorDe(r, pNota.id))) && baixa(pNota, num(valorDe(r, pNota.id)))).length;
      if (notas.length >= 10 && totalBaixas / notas.length >= 0.15)
        achados.push({
          tom: "atencao",
          titulo: "Notas baixas acima do esperado",
          texto: `${Math.round((totalBaixas / notas.length) * 100)}% das avaliações de instrutor ficaram na metade de baixo da escala. Vale olhar os comentários juntos, para ver se o motivo se repete.`,
        });
    }
  }

  let recomendacao: Analise["recomendacao"] = null;
  const cruzamentos: Analise["cruzamentos"] = [];
  if (pRec) {
    const vals = geral.map((r) => num(valorDe(r, pRec.id))).filter(Number.isFinite);
    const escola = vals.length >= MINIMO_RESPOSTAS ? media(vals) : null;
    const nps = pRec.min === 0 && pRec.max === 10 && vals.length >= MINIMO_RESPOSTAS ? Math.round(((vals.filter((v) => v >= 9).length - vals.filter((v) => v <= 6).length) / vals.length) * 100) : null;
    const porTurma = agrupar(geral, pRec, (r) => r.classGroupId, (r) => r.turmaNome ?? "—");
    recomendacao = { pergunta: pRec, escola, total: vals.length, nps, porTurma };

    // Recomendação × cada pergunta de escolha da parte geral (mesma resposta).
    for (const p of perguntas.filter((x) => x.parte === "geral" && x.tipo === "escolha")) {
      const linhas = (p.opcoes ?? []).map((o) => {
        const vs = geral.filter((r) => valorDe(r, p.id) === o).map((r) => num(valorDe(r, pRec.id))).filter(Number.isFinite);
        return { opcao: o, total: vs.length, media: vs.length >= MINIMO_RESPOSTAS ? media(vs) : null };
      });
      const comMedia = linhas.filter((l) => l.media !== null);
      if (comMedia.length < 2) continue;
      cruzamentos.push({ pergunta: p, linhas });
      const alto = comMedia.reduce((a, b) => (b.media! > a.media! ? b : a));
      const baixo = comMedia.reduce((a, b) => (b.media! < a.media! ? b : a));
      if (alto.media! - baixo.media! >= 1.5 * relevante(pRec))
        achados.push({
          tom: "atencao",
          titulo: `Recomendação muda conforme "${p.texto.replace(/\?$/, "")}"`,
          texto: `Quem respondeu "${baixo.opcao}" dá ${f1(baixo.media!)} de recomendação; quem respondeu "${alto.opcao}", ${f1(alto.media!)} (${baixo.total} e ${alto.total} respostas). É um bom ponto de partida para entender o que faz o aluno recomendar a escola.`,
        });
    }

    // Nota dos instrutores × recomendação, turma a turma.
    if (nota && escola !== null) {
      const pares = nota.porTurma
        .filter((t) => t.media !== null)
        .map((t) => ({ t, r: porTurma.find((x) => x.id === t.id)?.media ?? null }))
        .filter((x) => x.r !== null) as { t: Grupo; r: number }[];
      if (pares.length >= 4) {
        const c = correlacao(
          pares.map((x) => x.t.media!),
          pares.map((x) => x.r),
        );
        if (c !== null && c >= 0.6)
          achados.push({
            tom: "neutro",
            titulo: "Onde o instrutor é bem avaliado, a escola é mais recomendada",
            texto: `Turma a turma, a nota dos instrutores acompanha a recomendação da escola (correlação ${f1(c)}). O trabalho em sala pesa diretamente em quanto os alunos indicam a Nova Acrópole.`,
          });
      }
      for (const t of porTurma.filter((x) => x.media !== null && x.media <= escola - relevante(pRec)))
        achados.push({ tom: "atencao", titulo: `${t.rotulo}: recomenda menos a escola`, texto: `Recomendação ${f1(t.media!)} contra ${f1(escola)} da escola. Veja os motivos escritos dessa turma.` });
    }
  }

  // Positivos primeiro? Não: o que pede ação primeiro, depois o neutro, depois o que vai bem.
  const ordem: Record<Tom, number> = { atencao: 0, neutro: 1, positivo: 2 };
  achados.sort((a, b) => ordem[a.tom] - ordem[b.tom]);
  return { nota, recomendacao, cruzamentos, achadosDirecao: achados };
}

export function correlacao(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const mx = media(xs);
  const my = media(ys);
  let n = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    n += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? n / Math.sqrt(dx * dy) : null;
}

/** Achados para o próprio instrutor: comparação com a escola, por turma, dispersão e notas baixas. Sem citar colegas. */
export function achadosDoInstrutor(analise: Analise, matricula: string, respostas: RespostaAnalise[]): Achado[] {
  const n = analise.nota;
  if (!n || n.escola === null) return [];
  const eu = n.porInstrutor.find((i) => i.id === matricula);
  if (!eu || eu.media === null) return [];
  const p = n.pergunta;
  const d = relevante(p);
  const r: Achado[] = [];
  const dif = eu.media - n.escola;
  r.push(
    dif >= d
      ? { tom: "positivo", titulo: "Acima da média da escola", texto: `Sua média foi ${f1(eu.media)}; a da escola, ${f1(n.escola)}. Os alunos reconhecem o seu trabalho.` }
      : dif <= -d
        ? { tom: "atencao", titulo: "Abaixo da média da escola", texto: `Sua média foi ${f1(eu.media)}; a da escola, ${f1(n.escola)}. Os comentários abaixo e as sugestões ajudam a ver por onde começar.` }
        : { tom: "neutro", titulo: "Na média da escola", texto: `Sua média foi ${f1(eu.media)}; a da escola, ${f1(n.escola)}.` },
  );
  const minhas = respostas.filter((x) => x.parte === "instrutor" && x.instrutorMatr === matricula);
  const porTurma = agrupar(minhas, p, (x) => x.classGroupId, (x) => x.turmaNome ?? "—").filter((t) => t.media !== null);
  if (porTurma.length >= 2) {
    const melhor = porTurma.reduce((a, b) => (b.media! > a.media! ? b : a));
    const pior = porTurma.reduce((a, b) => (b.media! < a.media! ? b : a));
    if (melhor.media! - pior.media! >= 2 * d)
      r.push({
        tom: "neutro",
        titulo: "Diferença entre as suas turmas",
        texto: `${f1(melhor.media!)} em ${melhor.rotulo} e ${f1(pior.media!)} em ${pior.rotulo}. Vale pensar no que muda entre as duas: horário, ritmo, exemplos, momento do curso.`,
      });
  }
  if (eu.desvio !== null && eu.desvio >= 2 * d && eu.total >= 5)
    r.push({
      tom: "neutro",
      titulo: "Opiniões divididas",
      texto: `${eu.baixas} de ${eu.total} notas ficaram na metade de baixo da escala, e as outras bem acima. Parte dos alunos está bem atendida e parte não: ritmo, profundidade e linguagem podem não estar servindo a todos.`,
    });
  return r;
}

/** Comentários escritos de uma parte (e, se indicado, só de um instrutor), para a IA e para a leitura. */
export function comentarios(perguntas: Pergunta[], respostas: RespostaAnalise[], filtro: { parte?: "instrutor" | "geral"; instrutorMatr?: string } = {}) {
  const ps = perguntas.filter((p) => p.tipo === "texto" && (!filtro.parte || p.parte === filtro.parte));
  const out: { pergunta: string; texto: string }[] = [];
  for (const r of respostas) {
    if (filtro.parte && r.parte !== filtro.parte) continue;
    if (filtro.instrutorMatr && r.instrutorMatr !== filtro.instrutorMatr) continue;
    for (const p of ps) {
      if (p.parte !== r.parte) continue;
      const t = String(valorDe(r, p.id) ?? "").trim();
      if (t.length >= 3) out.push({ pergunta: p.texto, texto: t.slice(0, 600) });
    }
  }
  return out;
}
