import "server-only";
import { consultarMercurio, sqlNumero, sqlTexto } from "@/lib/mercurio-db/client";
import type { DadosDeclaracao } from "./texto";

/**
 * Dados da declaração lidos na hora do banco de consulta do Mercúrio (cadastro, turmas, matérias que ministra,
 * funções, cursos e unidade). Só leitura. Quem chama confere a permissão; aqui só se garante que a matrícula é ativa
 * e da unidade pedida.
 */
export class DeclaracaoErro extends Error {}

const vazia = (v: string | null | undefined) => (!v || v.startsWith("0000") || v === "???" || v === "??" ? null : v);
const CORPOS: Record<string, string> = { BF: "Brigada Feminina", BM: "Brigada Masculina", CS: "Corpo de Segurança" };

export async function dadosDaDeclaracao(matricula: string, unidade: string): Promise<DadosDeclaracao> {
  const matr = sqlNumero(matricula);
  const uni = sqlTexto(unidade);
  const [c] = await consultarMercurio(
    `SELECT cad_matr, cad_nome, cad_sexo, cad_nivel, cad_turma, cad_unidade, cad_situacao, cad_ingresso, cad_reingresso, cad_2o_nivel, cad_formatura, cad_situacao_fv, cad_raio_fv, cad_cad_pedagogo FROM cadastro WHERE cad_matr=${matr} LIMIT 1`,
  );
  if (!c || c.cad_unidade !== unidade) throw new DeclaracaoErro("Matrícula não encontrada nesta filial.");
  if (c.cad_situacao !== "ATI") throw new DeclaracaoErro("A matrícula não está ativa no Mercúrio: não é possível declarar vínculo atual.");

  const [u, niveis, turmas, aulas, funcoes, cursos] = await Promise.all([
    consultarMercurio(`SELECT uni_nome, uni_cnpj, uni_cidade, uni_uf, uni_diretor FROM unidades WHERE uni_id=${uni} LIMIT 1`).then((r) => r[0]),
    consultarMercurio(`SELECT snv_sigla, snv_descricao FROM sig_niveis`),
    c.cad_turma ? consultarMercurio(`SELECT tur_turma, tur_dia, tur_horario, tur_inicio FROM turmas WHERE tur_unidade=${uni} AND tur_turma=${sqlTexto(c.cad_turma)} LIMIT 1`) : Promise.resolve([]),
    consultarMercurio(
      `SELECT tm.tma_inicio, t.tur_dia, t.tur_horario FROM turmas_materias tm LEFT JOIN turmas t ON t.tur_unidade=tm.tma_unidade AND t.tur_turma=tm.tma_turma WHERE tm.tma_instrutor=${matr} AND tm.tma_unidade=${uni} ORDER BY tm.tma_inicio`,
    ),
    consultarMercurio(
      `SELECT f.dfn_funcao, f.dfn_descricao, f.dfn_inicio, f.dfn_termino, f.dfn_atual, s.sdf_descricao FROM dirigente_funcoes f LEFT JOIN sig_dirigente_funcoes s ON s.sdf_sigla=f.dfn_funcao WHERE f.dfn_matr=${matr} ORDER BY f.dfn_inicio`,
    ),
    consultarMercurio(
      `SELECT s.sdu_descricao, p.dcr_data FROM cursos_integra_participa p LEFT JOIN sig_cursos_integra s ON s.sdu_id=p.dcr_curso_id WHERE p.dcr_matr=${matr} ORDER BY p.dcr_data`,
    ),
  ]);
  const nomeNivel = new Map(niveis.map((n) => [n.snv_sigla, n.snv_descricao]));
  const nivel = (sigla: string | null | undefined) => {
    const d = sigla ? nomeNivel.get(sigla) : null;
    return d && sigla !== "??" ? d.replace(/^NÍVEL (\d)$/, "Nível $1") : null;
  };
  const diretor = vazia(u?.uni_diretor) ? (await consultarMercurio(`SELECT cad_nome, cad_sexo FROM cadastro WHERE cad_matr=${sqlNumero(u!.uni_diretor!)} LIMIT 1`))[0] : null;
  const t = turmas[0];
  const fv = vazia(c.cad_situacao_fv);

  return {
    nome: c.cad_nome ?? "",
    matricula: c.cad_matr ?? matricula,
    feminino: c.cad_sexo === "F",
    unidade: { nome: u?.uni_nome ?? unidade, cnpj: u?.uni_cnpj ?? null, cidade: u?.uni_cidade ?? "", uf: u?.uni_uf ?? "" },
    ingresso: vazia(c.cad_ingresso),
    reingresso: vazia(c.cad_reingresso),
    nivel: nivel(c.cad_nivel),
    // cad_2o_nivel é a data de entrada no 2º nível; só faz sentido quando a pessoa está nele.
    nivelDesde: c.cad_nivel === "N2" ? vazia(c.cad_2o_nivel) : null,
    formatura: vazia(c.cad_formatura),
    turma: t ? { nome: t.tur_turma ?? "", dia: vazia(t.tur_dia), horario: vazia(t.tur_horario), inicio: vazia(t.tur_inicio) } : null,
    aulas: aulas.map((a) => ({ inicio: vazia(a.tma_inicio), dia: vazia(a.tur_dia), horario: vazia(a.tur_horario) })),
    pedagogo: c.cad_cad_pedagogo === "FOR" ? "formacao" : c.cad_cad_pedagogo === "INS" ? "instrutor" : null,
    funcoes: funcoes
      .map((f) => ({ nome: vazia(f.dfn_descricao) ?? vazia(f.sdf_descricao) ?? "", atual: f.dfn_atual === "S" && !vazia(f.dfn_termino), inicio: vazia(f.dfn_inicio), termino: vazia(f.dfn_termino) }))
      .filter((f) => f.nome),
    voluntariado: fv === "BRG" || fv === "PRO" ? { situacao: fv === "BRG" ? "brigadista" : "provacionista", corpo: CORPOS[c.cad_raio_fv ?? ""] ?? "" } : null,
    cursos: cursos.filter((x) => x.sdu_descricao).map((x) => ({ nome: x.sdu_descricao!, data: vazia(x.dcr_data) })),
    diretor: diretor?.cad_nome ? { nome: diretor.cad_nome, feminino: diretor.cad_sexo === "F" } : null,
  };
}

/** Nome de quem assina como "eu" (cadastro do Mercúrio; sem ele, o nome do Portal). */
export async function nomeNoMercurio(matricula: string | null): Promise<string | null> {
  if (!matricula || !/^\d+$/.test(matricula)) return null;
  const [c] = await consultarMercurio(`SELECT cad_nome FROM cadastro WHERE cad_matr=${sqlNumero(matricula)} LIMIT 1`);
  return c?.cad_nome ?? null;
}
