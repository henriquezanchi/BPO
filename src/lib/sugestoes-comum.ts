/**
 * Caixa de sugestões do Portal (pedido do usuário 10/11/2026, depois do relato de um aluno que não conseguia alterar
 * o cadastro no computador). Regras puras, usadas no servidor, na tela e nos testes.
 *
 * Cada categoria tem um destino: as do Portal vão para a administração nacional (quem cuida do sistema); as da escola,
 * para a direção da filial (Chefe e Sub-Chefe). O aparelho e o navegador vão junto, para quem lê saber reproduzir um
 * problema ("só no computador", "só no iPhone").
 */
export type Destinatario = "portal" | "filial";

export const CATEGORIAS = [
  { id: "portal_problema", rotulo: "Algo não funciona no Portal", ajuda: "Um botão, campo ou tela que não responde, erro, lentidão", destino: "portal" },
  { id: "portal_ideia", rotulo: "Ideia para o Portal", ajuda: "Uma função nova ou algo que poderia ser mais simples", destino: "portal" },
  { id: "aulas", rotulo: "Aulas e cursos", ajuda: "Horários, temas, material, turmas", destino: "filial" },
  { id: "eventos", rotulo: "Eventos e atividades", ajuda: "Palestras, cursos especiais, atividades culturais", destino: "filial" },
  { id: "atendimento", rotulo: "Atendimento e secretaria", ajuda: "Contato, respostas, contribuição, cadastro", destino: "filial" },
  { id: "espaco", rotulo: "Espaço da escola", ajuda: "Sala, limpeza, acessibilidade, café, estacionamento", destino: "filial" },
  { id: "outro", rotulo: "Outro assunto", ajuda: "O que não se encaixar acima", destino: "filial" },
] as const satisfies readonly { id: string; rotulo: string; ajuda: string; destino: Destinatario }[];

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
