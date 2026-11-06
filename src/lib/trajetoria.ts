import "server-only";
import { consultarMercurio, sqlNumero } from "@/lib/mercurio-db/client";

/**
 * Minha trajetória (pedido do usuário 06/11/2026): a caminhada da própria pessoa registrada no Mercúrio — marcos,
 * funções (com alcance da filial ou nacional e participação em conselho), distinções (Machado, Tocha, Ordem ao
 * Mérito...) e as matérias que ministra. Só leitura, na hora, e só da própria matrícula (quem chama garante).
 */
export type Trajetoria = {
  nome: string;
  marcos: { data: string; titulo: string }[];
  funcoes: { nome: string; alcance: "filial" | "nacional"; unidade: string | null; conselho: boolean; inicio: string | null; termino: string | null; atual: boolean }[];
  distincoes: { nome: string; data: string | null }[];
  aulas: { materia: string; turma: string; unidade: string; desde: string | null }[];
};

const vazia = (v: string | null | undefined) => (!v || v.startsWith("0000") || v === "???" || v === "??" ? null : v);
const dia = (v: string | null | undefined) => vazia(v)?.slice(0, 10) ?? null;
const titulo = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (/^(i|ii|iii|iv|v|fv)$/.test(p) ? p.toUpperCase() : i > 0 && /^(de|da|do|das|dos|e|a|o)$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");

export async function lerTrajetoria(matricula: string): Promise<Trajetoria | null> {
  const m = sqlNumero(matricula);
  const [c] = await consultarMercurio(`SELECT cad_nome, cad_ingresso, cad_reingresso, cad_2o_nivel, cad_formatura, cad_situacao_fv, cad_cad_pedagogo FROM cadastro WHERE cad_matr=${m} LIMIT 1`);
  if (!c) return null;
  const [funcoes, distDirigente, distMembro, aulas] = await Promise.all([
    consultarMercurio(
      `SELECT f.dfn_descricao, s.sdf_descricao, f.dfn_abrangencia, f.dfn_conselho, f.dfn_inicio, f.dfn_termino, f.dfn_atual, u.uni_nome FROM dirigente_funcoes f LEFT JOIN sig_dirigente_funcoes s ON s.sdf_sigla=f.dfn_funcao LEFT JOIN unidades u ON u.uni_id=f.dfn_unidade WHERE f.dfn_matr=${m} ORDER BY f.dfn_inicio DESC`,
    ),
    consultarMercurio(`SELECT s.sdc_descricao d, c.dco_data dt FROM dirigente_condecoracoes c LEFT JOIN sig_dirigente_condecoracoes s ON s.sdc_sigla=c.dco_condecoracao WHERE c.dco_matr=${m} ORDER BY c.dco_data`),
    consultarMercurio(`SELECT s.sco_descricao d, c.con_data dt FROM condecoracoes c LEFT JOIN sig_condecoracoes s ON s.sco_sigla=c.con_condecoracao WHERE c.con_matr=${m} ORDER BY c.con_data`),
    consultarMercurio(
      `SELECT s.sma_materia, tm.tma_materia, tm.tma_turma, u.uni_nome, tm.tma_inicio FROM turmas_materias tm LEFT JOIN sig_materias s ON s.sma_sigla=tm.tma_materia LEFT JOIN unidades u ON u.uni_id=tm.tma_unidade WHERE tm.tma_instrutor=${m} ORDER BY tm.tma_inicio`,
    ),
  ]);

  const marcos = [
    dia(c.cad_ingresso) && { data: dia(c.cad_ingresso)!, titulo: "Entrou na Nova Acrópole" },
    dia(c.cad_reingresso) && dia(c.cad_reingresso) !== dia(c.cad_ingresso) && { data: dia(c.cad_reingresso)!, titulo: "Voltou à escola (reingresso)" },
    dia(c.cad_2o_nivel) && { data: dia(c.cad_2o_nivel)!, titulo: "Entrou no 2º nível" },
    dia(c.cad_formatura) && { data: dia(c.cad_formatura)!, titulo: "Concluiu o curso de Filosofia à Maneira Clássica" },
  ].filter((x): x is { data: string; titulo: string } => !!x);

  return {
    nome: titulo((c.cad_nome ?? "").trim()),
    marcos: marcos.sort((a, b) => a.data.localeCompare(b.data)),
    funcoes: funcoes
      .map((f) => ({
        nome: titulo((vazia(f.dfn_descricao) ?? vazia(f.sdf_descricao) ?? "").trim()),
        alcance: f.dfn_abrangencia === "NAC" ? ("nacional" as const) : ("filial" as const),
        unidade: f.uni_nome ? titulo(f.uni_nome.trim()) : null,
        conselho: f.dfn_conselho === "S",
        inicio: dia(f.dfn_inicio),
        termino: dia(f.dfn_termino),
        // Mesma regra das declarações: atual de verdade só sem data de término.
        atual: f.dfn_atual === "S" && !dia(f.dfn_termino),
      }))
      .filter((f) => f.nome && f.nome !== "Não Informado"),
    distincoes: [...distDirigente, ...distMembro].filter((d) => d.d && !/n[aã]o informad/i.test(d.d)).map((d) => ({ nome: titulo(d.d!.trim()), data: dia(d.dt) })),
    aulas: aulas.map((a) => ({ materia: titulo((a.sma_materia ?? a.tma_materia ?? "").trim()), turma: titulo((a.tma_turma ?? "").trim()), unidade: titulo((a.uni_nome ?? "").trim()), desde: dia(a.tma_inicio) })),
  };
}
