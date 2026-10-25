import { normalizar } from "@/lib/profissoes";

/**
 * Secretarias da filial (pedido do usuário 2026-10-19). Funções puras:
 * catálogo e leitura das funções de dirigente do Mercúrio
 * (dirigente_funcoes.dfn_descricao, texto livre como "COLABORADORA DA
 * SECRETARIA DE ECONOMIA" ou "PRÓ SECRETÁRIA DE BIBLIOTECA") para sugerir as
 * secretarias, os responsáveis e a equipe de cada uma.
 */
export const SECRETARIAS_PADRAO = [
  "Escolástica",
  "Economia",
  "Integração",
  "Abertura de Turma",
  "Difusão e Comunicação",
  "Artes",
  "Biblioteca e Livraria",
  "Café",
  "Técnica e Manutenção",
  "Eventos",
  "Assistência Social",
  "Recepção e Portaria",
  "Esportes",
  "Voluntariado",
];

/** Secretarias que o membro pode escolher ao oferecer ajuda (Portal do Aluno), com os nomes do catálogo acima. */
export const SECRETARIAS_OFERTA = ["Economia", "Difusão e Comunicação", "Abertura de Turma", "Café", "Artes", "Técnica e Manutenção", "Escolástica"] as const;

const CANONICAS: [string, RegExp][] = [
  ["Escolástica", /ESCOLAST/],
  ["Economia", /ECONOMIA|TESOURARIA|CONTABIL|PATRIMONIO|INADIMPL|FINANC/],
  ["Integração", /INTEGRAC/],
  ["Abertura de Turma", /ABERTURA/],
  ["Difusão e Comunicação", /PROPAGANDA|DIFUS|IMAGEM|INTERNET|RELACOES PUBLICAS|COMUNICAC|FOTOGRAF|MARKETING/],
  ["Biblioteca e Livraria", /BIBLIOTEC|LIVRARIA|ARQUIVO/],
  ["Café", /CAFE/],
  ["Artes", /\bARTES?\b|ARTESANATO|POESIA/],
  ["Técnica e Manutenção", /MANUTENC|TECNICA|MARCENARIA|CONSTRUTOR/],
  ["Eventos", /EVENTO|CERIMONIAL|PRODUCAO/],
  ["Assistência Social", /ASS?ISTENCIA SOCIAL|ASS SOCIAL|ASSIST SOCIAL|OFICINAS? SOCIA/],
  ["Relações Institucionais", /REL(ACOES)? INSTITUCIONA/],
  ["Hygia", /HYGIA|HIGIA/],
  ["Seraphis", /SERAPHIS/],
  ["Fídias", /FIDIAS/],
  ["Bodhidharma", /BODHIDHARMA/],
  ["Provacionismo", /PROVACION/],
  ["Recepção e Portaria", /RECEPC|PORTARIA/],
  ["Esportes", /ESPORTE/],
  ["Programas infantojuvenis", /JANOS|MERLI[NM]|TAVOLA|CORRENTINHA|MUNDO DE SOPHIA/],
  ["Voluntariado", /VOLUNTARIADO/],
  ["Pedagogos", /PEDAGOG/],
  ["Assuntos Legais", /ASSUNTOS LEGAIS|JURIDIC/],
  ["Círculo de Amigos", /CIRCULO DE AMIGOS/],
  ["Ecologia Ativa", /ECOLOGIA/],
];

// Funções que não são de secretaria da filial: direção, cargos nacionais/regionais e chefias de grupo de FV.
const FUNCOES_FORA = new Set(["CF", "SCF", "SBF", "CN", "CE", "MN", "CZ", "SCN", "ASN", "CSN", "CMN", "SSC", "CBF", "CBR", "CMA", "CAR", "CFA", "SUB", "DN", "CCE"]);
const FORA_PELO_TEXTO = /NACIONAL|SEGURANCA|\bSN\b|CHEFE|SUB ?CHEFE|BRIGADA|GRUPO (FEMININO|MASCULINO|DE SEGURANCA)|\bBF\b|\bBM\b|MANIPULO|MANDO|COORD(ENADOR)? DE ZONA|PROFESSOR|ACOMPANHAMENTO DE RELATORIOS|ORGANIZATIVA|CONSELHO/;
const RESPONSAVEL = /^(SECRETARI[OA]|PRO ?SECRETARI[OA]|PRO SEC|SUB ?SECRETARI[OA]|COORDENADOR[A]?|COORD\b|RESPONSAVEL)/;
const PREFIXO =
  /^(?:COLABORADOR[A]?|ASSISTENTE|AUXILIAR|VOLUNTARI[OA]|MONITOR[A]?|COORDENADOR[A]?|COORD|RESPONSAVEL|PRO ?SECRETARI[OA]|PRO SEC|SUB ?SECRETARI[OA]|SECRETARI[OA])\b(?: (?:PELO|PELA|DAS|DOS|DA|DO|DE|NA|NO|EM)\b)?(?: (?:SECRETARIA|SECRETARIO|SECR|SEC|S)\b)?(?: (?:DAS|DOS|DA|DO|DE)\b)? ?/;

export type FuncaoMercurio = { matricula: string; funcao: string; descricao: string };
export type SugestaoSecretaria = { nome: string; responsaveis: FuncaoMercurio[]; equipe: FuncaoMercurio[] };

function rotulo(texto: string) {
  const t = texto.toLowerCase().replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Uma função do Mercúrio → secretaria e papel; null quando não é de secretaria da filial. */
export function lerFuncao(f: FuncaoMercurio): { secretaria: string; responsavel: boolean } | null {
  if (FUNCOES_FORA.has(f.funcao)) return null;
  const d = normalizar(f.descricao);
  if (!d || FORA_PELO_TEXTO.test(d)) return null;
  const canonica = CANONICAS.find(([, re]) => re.test(d))?.[0];
  const resto = d.replace(PREFIXO, "").replace(/^(INSTITUTO|PROGRAMA) /, "").trim();
  const secretaria = canonica ?? (resto.length >= 3 ? rotulo(resto) : null);
  if (!secretaria) return null;
  return { secretaria, responsavel: RESPONSAVEL.test(d) };
}

export function sugerirSecretarias(funcoes: FuncaoMercurio[]): SugestaoSecretaria[] {
  const mapa = new Map<string, SugestaoSecretaria>();
  for (const f of funcoes) {
    const lida = lerFuncao(f);
    if (!lida) continue;
    const s = mapa.get(lida.secretaria) ?? { nome: lida.secretaria, responsaveis: [], equipe: [] };
    (lida.responsavel ? s.responsaveis : s.equipe).push(f);
    mapa.set(lida.secretaria, s);
  }
  // Quem é responsável não aparece de novo na equipe da mesma secretaria.
  for (const s of mapa.values()) {
    const resp = new Set(s.responsaveis.map((r) => r.matricula));
    s.equipe = s.equipe.filter((e) => !resp.has(e.matricula));
  }
  return [...mapa.values()].sort((a, b) => b.responsaveis.length + b.equipe.length - (a.responsaveis.length + a.equipe.length) || a.nome.localeCompare(b.nome));
}
