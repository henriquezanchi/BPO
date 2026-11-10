/**
 * Caixa de sugestões do Portal (pedido do usuário 10/11/2026, depois do relato de um aluno que não conseguia alterar
 * o cadastro no computador). Regras puras, usadas no servidor, na tela e nos testes.
 *
 * Cada categoria tem um destino: as do Portal vão para a administração nacional (quem cuida do sistema); as da escola,
 * para a direção da filial (Chefe e Sub-Chefe). O aparelho e o navegador vão junto, para quem lê saber reproduzir um
 * problema ("só no computador", "só no iPhone").
 */
export type Destinatario = "portal" | "filial";

/**
 * Subcategorias (pedido do usuário 10/11/2026: "a pessoa pensa que o assunto ficou relacionado pelo próprio sistema").
 * Cada uma diz exatamente do que se trata e traz a pergunta-guia do campo de texto. `contexto` pede o que falta para
 * quem lê entender: a turma (aulas) ou o evento (eventos). Problema no Portal pede, em campos separados, o que a pessoa
 * tentou fazer e o que aconteceu.
 */
export type Contexto = "turma" | "evento";
export type Subcategoria = { id: string; rotulo: string; guia: string; contexto?: Contexto };

const TELAS_PORTAL: Subcategoria[] = [
  { id: "entrar", rotulo: "Entrar no Portal / senha", guia: "" },
  { id: "cadastro", rotulo: "Meus dados e cadastro", guia: "" },
  { id: "contribuicao", rotulo: "Contribuição e pagamentos", guia: "" },
  { id: "agenda", rotulo: "Agenda, eventos e inscrições", guia: "" },
  { id: "fortuna", rotulo: "Fortuna (Café)", guia: "" },
  { id: "carteirinha", rotulo: "Carteirinha", guia: "" },
  { id: "estudos", rotulo: "Área de Estudos, diário e anotações", guia: "" },
  { id: "avaliacao", rotulo: "Avaliação dos instrutores", guia: "" },
  { id: "voluntario", rotulo: "Área do Voluntário", guia: "" },
  { id: "outra_tela", rotulo: "Outra tela", guia: "" },
];

export const CATEGORIAS = [
  {
    id: "portal_problema",
    rotulo: "Algo não funciona no Portal",
    ajuda: "Um botão, campo ou tela que não responde, erro, lentidão",
    destino: "portal",
    pergunta: "Em que parte do Portal?",
    subcategorias: TELAS_PORTAL,
  },
  {
    id: "portal_ideia",
    rotulo: "Ideia para o Portal",
    ajuda: "Uma função nova ou algo que poderia ser mais simples",
    destino: "portal",
    pergunta: "Sobre que parte do Portal?",
    subcategorias: [...TELAS_PORTAL.filter((t) => t.id !== "outra_tela"), { id: "funcao_nova", rotulo: "Uma função que ainda não existe", guia: "" }].map((t) => ({
      ...t,
      guia: "O que você gostaria de conseguir fazer e por que isso ajudaria?",
    })),
  },
  {
    id: "aulas",
    rotulo: "Aulas e cursos",
    ajuda: "Conteúdo, didática, ritmo, horário, material, turma",
    destino: "filial",
    pergunta: "Sobre o quê, nas aulas?",
    subcategorias: [
      { id: "conteudo", rotulo: "Conteúdo e temas", guia: "Qual tema ou parte do conteúdo? O que poderia ser diferente?", contexto: "turma" },
      { id: "didatica", rotulo: "Didática e ritmo", guia: "O que ajudaria você a acompanhar melhor? (ritmo, exemplos, tempo para perguntas…)", contexto: "turma" },
      { id: "horario", rotulo: "Horário e duração", guia: "O que no horário ou na duração atrapalha, e o que funcionaria melhor?", contexto: "turma" },
      { id: "material", rotulo: "Material e apostilas", guia: "Qual material? O que falta ou poderia melhorar?", contexto: "turma" },
      { id: "turma", rotulo: "Convivência na turma", guia: "O que poderia aproximar mais a turma?", contexto: "turma" },
      { id: "elogio", rotulo: "Elogio às aulas", guia: "O que tem feito diferença para você?", contexto: "turma" },
    ],
  },
  {
    id: "eventos",
    rotulo: "Eventos e atividades",
    ajuda: "Palestras, cursos especiais, atividades culturais e de voluntariado",
    destino: "filial",
    pergunta: "Sobre o quê, nos eventos?",
    subcategorias: [
      { id: "evento", rotulo: "Um evento específico", guia: "O que funcionou e o que poderia ser melhor nesse evento?", contexto: "evento" },
      { id: "ideia", rotulo: "Ideia de evento ou atividade", guia: "Que tema ou atividade, e para quem seria?" },
      { id: "divulgacao", rotulo: "Divulgação e inscrições", guia: "Como você ficou sabendo (ou não) e o que facilitaria?" },
      { id: "horario", rotulo: "Dias e horários dos eventos", guia: "Que dias e horários funcionariam melhor para você?" },
    ],
  },
  {
    id: "atendimento",
    rotulo: "Atendimento e secretaria",
    ajuda: "Secretaria, contribuição, comunicação da escola, recepção",
    destino: "filial",
    pergunta: "Sobre que atendimento?",
    subcategorias: [
      { id: "secretaria", rotulo: "Secretaria e cadastro", guia: "O que você precisou e como foi o atendimento?" },
      { id: "economia", rotulo: "Contribuição e pagamentos", guia: "O que aconteceu ou o que poderia ser mais simples?" },
      { id: "comunicacao", rotulo: "Avisos e comunicação (WhatsApp, e-mail)", guia: "Que informação faltou, chegou tarde ou chegou demais?" },
      { id: "recepcao", rotulo: "Recepção na escola", guia: "Como foi a recepção e o que poderia melhorar?" },
    ],
  },
  {
    id: "espaco",
    rotulo: "Espaço da escola",
    ajuda: "Salas, limpeza, acessibilidade, café, segurança",
    destino: "filial",
    pergunta: "Que parte do espaço?",
    subcategorias: [
      { id: "sala", rotulo: "Sala de aula (cadeiras, som, luz, temperatura)", guia: "Qual sala e o que precisa de atenção?" },
      { id: "limpeza", rotulo: "Limpeza e banheiros", guia: "Onde e o que precisa de atenção?" },
      { id: "acessibilidade", rotulo: "Acessibilidade", guia: "Que dificuldade de acesso você (ou alguém) encontrou?" },
      { id: "cafe", rotulo: "Café e lanchonete", guia: "O que poderia melhorar no café?" },
      { id: "seguranca", rotulo: "Segurança e estacionamento", guia: "O que preocupa e em que horário?" },
    ],
  },
  {
    id: "outro",
    rotulo: "Outro assunto",
    ajuda: "O que não se encaixar acima",
    destino: "filial",
    pergunta: "",
    subcategorias: [] as Subcategoria[],
  },
] as const satisfies readonly { id: string; rotulo: string; ajuda: string; destino: Destinatario; pergunta: string; subcategorias: readonly Subcategoria[] }[];

export const subcategoriasDe = (cat: string): readonly Subcategoria[] => CATEGORIAS.find((c) => c.id === cat)?.subcategorias ?? [];
export const subcategoria = (cat: string, sub: string | null | undefined) => (sub ? subcategoriasDe(cat).find((s) => s.id === sub) : undefined);

export const TITULO_MIN = 4;
export const TITULO_MAX = 80;

/**
 * Confere categoria, subcategoria e assunto. Subcategoria é obrigatória onde existe; o assunto (título curto), sempre.
 * Devolve o que o servidor guarda e o contexto que ainda precisa ser conferido no banco (turma ou evento).
 */
export function lerClassificacao(d: { categoria?: unknown; subcategoria?: unknown; titulo?: unknown }):
  | { ok: true; categoria: Categoria; subcategoria: string | null; titulo: string; contexto: Contexto | null }
  | { ok: false; erro: string } {
  const cat = d.categoria;
  if (!ehCategoria(cat)) return { ok: false, erro: "Escolha uma categoria." };
  const subs = subcategoriasDe(cat);
  const sub = subs.length ? subcategoria(cat, typeof d.subcategoria === "string" ? d.subcategoria : null) : undefined;
  if (subs.length && !sub) return { ok: false, erro: `Responda: ${categoria(cat)?.pergunta}` };
  const titulo = String(d.titulo ?? "").replace(/\s+/g, " ").trim();
  if (titulo.length < TITULO_MIN) return { ok: false, erro: 'Dê um assunto em poucas palavras (ex.: "Som da sala 2 baixo").' };
  if (titulo.length > TITULO_MAX) return { ok: false, erro: `O assunto passou de ${TITULO_MAX} caracteres. O detalhe vai no texto.` };
  return { ok: true, categoria: cat, subcategoria: sub?.id ?? null, titulo, contexto: sub?.contexto ?? null };
}

/** Texto do problema no Portal a partir dos dois campos (o que tentou, o que aconteceu). */
export const textoDoProblema = (tentou: string, aconteceu: string) => `O que tentei fazer: ${tentou.trim()}\n\nO que aconteceu: ${aconteceu.trim()}`;

/** "Aulas e cursos › Didática e ritmo". */
export const rotuloCompleto = (cat: string, sub: string | null | undefined) => [categoria(cat)?.rotulo ?? cat, subcategoria(cat, sub)?.rotulo].filter(Boolean).join(" › ");

export type Categoria = (typeof CATEGORIAS)[number]["id"];
export const ehCategoria = (x: unknown): x is Categoria => CATEGORIAS.some((c) => c.id === x);
export const categoria = (id: string) => CATEGORIAS.find((c) => c.id === id);
export const destinoDa = (id: string): Destinatario => categoria(id)?.destino ?? "filial";
export const CATEGORIAS_PORTAL = CATEGORIAS.filter((c) => c.destino === "portal").map((c) => c.id) as Categoria[];
export const CATEGORIAS_FILIAL = CATEGORIAS.filter((c) => c.destino === "filial").map((c) => c.id) as Categoria[];

export const STATUS = ["nova", "em_analise", "respondida", "arquivada"] as const;
export type StatusSugestao = (typeof STATUS)[number];
export const ehStatus = (x: unknown): x is StatusSugestao => STATUS.includes(x as StatusSugestao);
/** Como quem enviou vê o andamento. */
export const ROTULO_STATUS_AUTOR: Record<StatusSugestao, string> = { nova: "Recebida", em_analise: "Em análise", respondida: "Respondida", arquivada: "Encerrada" };
/** Como quem lê vê a fila. */
export const ROTULO_STATUS: Record<StatusSugestao, string> = { nova: "Nova", em_analise: "Em análise", respondida: "Respondida", arquivada: "Arquivada" };

export const TEXTO_MIN = 10;
export const TEXTO_MAX = 2000;
export const RESPOSTA_MAX = 2000;
/** Limite por pessoa a cada 24 h, contra envio repetido por engano. */
export const LIMITE_DIA = 5;

/** Texto limpo e dentro do tamanho, ou a mensagem do que falta. */
export function lerTexto(texto: unknown): { ok: true; texto: string } | { ok: false; erro: string } {
  const t = String(texto ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length < TEXTO_MIN) return { ok: false, erro: "Escreva um pouco mais, para quem ler entender (pelo menos 10 letras)." };
  if (t.length > TEXTO_MAX) return { ok: false, erro: `O texto passou de ${TEXTO_MAX} caracteres. Resuma um pouco.` };
  return { ok: true, texto: t };
}

export type Aparelho = { tipo: "computador" | "celular" | "tablet"; sistema: string | null; navegador: string | null; largura: number | null; app: boolean };

/** Aparelho, sistema e navegador a partir do user-agent (o bastante para reproduzir um problema, sem identificar ninguém). */
export function lerAparelho(ua: string, largura?: number | null, app?: boolean): Aparelho {
  const u = ua || "";
  const ipad = /iPad/.test(u) || (/Macintosh/.test(u) && /Mobile\//.test(u));
  const tipo: Aparelho["tipo"] = ipad || /Tablet|SM-T\d/.test(u) ? "tablet" : /Mobi|iPhone|Android/.test(u) ? "celular" : "computador";
  const sistema = /iPhone|iPad|iPod/.test(u) || ipad
    ? "iOS"
    : /Android/.test(u)
      ? "Android"
      : /Windows/.test(u)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(u)
          ? "Mac"
          : /CrOS/.test(u)
            ? "ChromeOS"
            : /Linux/.test(u)
              ? "Linux"
              : null;
  const versao = (re: RegExp) => u.match(re)?.[1]?.split(".")[0];
  const navegador = /Edg\//.test(u)
    ? `Edge ${versao(/Edg\/([\d.]+)/) ?? ""}`
    : /OPR\//.test(u)
      ? `Opera ${versao(/OPR\/([\d.]+)/) ?? ""}`
      : /SamsungBrowser\//.test(u)
        ? `Samsung Internet ${versao(/SamsungBrowser\/([\d.]+)/) ?? ""}`
        : /Firefox\/|FxiOS\//.test(u)
          ? `Firefox ${versao(/(?:Firefox|FxiOS)\/([\d.]+)/) ?? ""}`
          : /CriOS\//.test(u)
            ? `Chrome ${versao(/CriOS\/([\d.]+)/) ?? ""}`
            : /Chrome\//.test(u)
              ? `Chrome ${versao(/Chrome\/([\d.]+)/) ?? ""}`
              : /Safari\//.test(u)
                ? `Safari ${versao(/Version\/([\d.]+)/) ?? ""}`
                : null;
  const l = typeof largura === "number" && Number.isFinite(largura) && largura > 0 && largura < 10000 ? Math.round(largura) : null;
  return { tipo, sistema, navegador: navegador?.trim() || null, largura: l, app: !!app };
}

export function descreverAparelho(a: Aparelho | null | undefined): string {
  if (!a) return "";
  const nome = { computador: "Computador", celular: "Celular", tablet: "Tablet" }[a.tipo];
  return [nome, a.sistema, a.navegador, a.largura ? `tela de ${a.largura}px` : null, a.app ? "app instalado" : null].filter(Boolean).join(" · ");
}

/** Quem lê o quê: categorias do Portal (administração nacional) e filiais cujas sugestões da escola a pessoa vê. */
export type AcessoSugestoes = { portal: boolean; escolas: string[] | "todas" };
export const semAcessoSugestoes = (a: AcessoSugestoes) => !a.portal && a.escolas !== "todas" && a.escolas.length === 0;

export function podeLer(a: AcessoSugestoes, s: { categoria: string; schoolId: string }): boolean {
  if (destinoDa(s.categoria) === "portal") return a.portal;
  return a.escolas === "todas" || a.escolas.includes(s.schoolId);
}
