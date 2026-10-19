import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { consultarMercurio } from "@/lib/mercurio-db/client";
import { chaveDeGenero, classificarProfissao, normalizar, rotuloDeProfissao, type Area } from "@/lib/profissoes";

/**
 * Profissões e áreas de atuação de toda a OINAB-N (pedido do usuário
 * 2026-10-19), gerado na sincronização diária a partir do banco de consulta
 * do Mercúrio. Só pessoas ativas. Guardado em ResumoNacional("profissoes"):
 * o painel nacional usa tudo; o Relatório da Filial usa o recorte da unidade.
 */
export const REGIOES: Record<string, string> = { RCO: "Centro-Oeste", RNN: "Norte e Nordeste" };

/** Contagem [ativos, membros] — membros = 2º nível em diante (N2–N9). */
export type Par = [number, number];

export type AreaDaUnidade = {
  total: Par;
  /** Profissão (rótulo da grafia mais comum) → contagem. */
  profissoes: Record<string, Par>;
  /** Órgão/local de trabalho → contagem (só servidores públicos). */
  orgaos?: Record<string, Par>;
  /** Quantos foram classificados pelo local de trabalho, não pela profissão. */
  peloOrgao?: Par;
};

export type ResumoProfissoes = {
  geradoEm: string;
  unidades: { id: string; nome: string; cidade: string; uf: string; regiao: string }[];
  /** unidade → área → dados */
  porUnidade: Record<string, Partial<Record<Area, AreaDaUnidade>>>;
};

type Linha = Record<string, string | null>;

const somar = (alvo: Par, n: number, membro: boolean) => {
  alvo[0] += n;
  if (membro) alvo[1] += n;
};

/** O cliente do banco de consulta devolve no máximo 5.000 linhas por vez (session_max_rows). */
async function consultarEmPaginas(sql: string, tamanho = 4000): Promise<Linha[]> {
  const todas: Linha[] = [];
  for (let desde = 0; ; desde += tamanho) {
    const pagina = (await consultarMercurio(`${sql} LIMIT ${tamanho} OFFSET ${desde}`)) as Linha[];
    todas.push(...pagina);
    if (pagina.length < tamanho) return todas;
  }
}

export async function gerarResumoProfissoes(): Promise<ResumoProfissoes> {
  const [unidades, linhas] = await Promise.all([
    consultarMercurio("SELECT uni_id, uni_nome, uni_cidade, uni_uf, uni_regiao FROM unidades"),
    consultarEmPaginas(
      "SELECT cad_unidade u, IF(cad_nivel REGEXP '^N[2-9]$', 1, 0) m, UPPER(TRIM(IFNULL(cad_profissao, ''))) p, UPPER(TRIM(IFNULL(cad_empresa, ''))) e, COUNT(*) n FROM cadastro WHERE cad_situacao='ATI' GROUP BY u, m, p, e ORDER BY u, m, p, e",
    ),
  ]);

  // Rótulo de cada profissão = grafia mais frequente entre as que juntam masculino/feminino.
  const grafias = new Map<string, Map<string, number>>();
  for (const l of linhas as Linha[]) {
    const chave = chaveDeGenero(normalizar(l.p));
    const mapa = grafias.get(chave) ?? new Map<string, number>();
    mapa.set(l.p ?? "", (mapa.get(l.p ?? "") ?? 0) + Number(l.n));
    grafias.set(chave, mapa);
  }
  const rotulo = new Map([...grafias].map(([chave, mapa]) => [chave, rotuloDeProfissao([...mapa].sort((a, b) => b[1] - a[1])[0][0] || "Não informada")]));

  const porUnidade: ResumoProfissoes["porUnidade"] = {};
  for (const l of linhas as Linha[]) {
    const u = (l.u ?? "?").trim();
    const n = Number(l.n);
    const membro = l.m === "1";
    const { area, peloOrgao } = classificarProfissao(l.p, l.e);
    const daUnidade = (porUnidade[u] ??= {});
    const a = (daUnidade[area] ??= { total: [0, 0], profissoes: {} });
    somar(a.total, n, membro);
    const nomeProf = rotulo.get(chaveDeGenero(normalizar(l.p))) ?? "Não informada";
    somar((a.profissoes[nomeProf] ??= [0, 0]), n, membro);
    if (peloOrgao) somar((a.peloOrgao ??= [0, 0]), n, membro);
    const orgao = normalizar(l.e);
    if ((peloOrgao || area === "Serviço público (área não identificada)") && orgao.length > 1) somar(((a.orgaos ??= {})[rotuloDeProfissao(l.e ?? "")] ??= [0, 0]), n, membro);
  }

  const resumo: ResumoProfissoes = {
    geradoEm: new Date().toISOString(),
    unidades: (unidades as Linha[])
      .map((u) => ({ id: (u.uni_id ?? "").trim(), nome: rotuloDeProfissao(u.uni_nome ?? u.uni_id ?? ""), cidade: rotuloDeProfissao(u.uni_cidade ?? ""), uf: u.uni_uf ?? "", regiao: u.uni_regiao ?? "" }))
      .filter((u) => porUnidade[u.id])
      .concat(
        // Unidade com ativos que não aparece na tabela de unidades: entra pelo código.
        Object.keys(porUnidade)
          .filter((id) => !(unidades as Linha[]).some((u) => (u.uni_id ?? "").trim() === id))
          .map((id) => ({ id, nome: id, cidade: "", uf: "", regiao: "" })),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    porUnidade,
  };
  await db.resumoNacional.upsert({
    where: { chave: "profissoes" },
    create: { chave: "profissoes", dados: resumo as unknown as Prisma.InputJsonValue, geradoEm: new Date() },
    update: { dados: resumo as unknown as Prisma.InputJsonValue, geradoEm: new Date() },
  });
  return resumo;
}

