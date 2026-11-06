import "server-only";
import { consultarMercurio, sqlNumero, sqlTexto } from "@/lib/mercurio-db/client";
import { consultarTudo } from "@/lib/mercurio-db/importar";
import type { LadoAntigo, PessoaAntigo } from "./tipos";

/**
 * Lê a unidade no banco de consulta do Mercúrio antigo (oinabview, só leitura). Atenção a dois limites dele:
 *  - `cadastro` traz ativos e inativos (conferido em 06/11/2026: 53 mil linhas no país; a nota de importar.ts sobre
 *    "só ativos" é de 18/10/2026, antes de virar view), então reingresso aparece como "reativar";
 *  - `cadastro` é cópia diária; `reciboc`/`reciboi` são views online. Um lançamento feito hoje aparece nos recibos na
 *    hora, mas uma alteração de cadastro só no dia seguinte (por isso o registro de itens feitos em rodar.ts).
 */
export async function lerLadoAntigo(unidade: string, desde: string, matriculasDoNovo: string[]): Promise<LadoAntigo> {
  const u = sqlTexto(unidade);
  const [cadastros, composicao, recibos, turmas, funcoes, produtos] = await Promise.all([
    consultarTudo(
      `SELECT cad_matr, cad_nome, cad_unidade, cad_situacao, cad_ingresso, cad_nivel, cad_turma, cad_cel_ddd, cad_cel_fone, cad_res_ddd, cad_res_fone, cad_email, cad_res_cidade, cad_res_uf, cad_nascimento, cad_naturalidade, cad_profissao, cad_estado_civil, cad_escolaridade, cad_rg FROM cadastro WHERE cad_unidade=${u} ORDER BY cad_matr`,
    ),
    consultarTudo(`SELECT c.cal_matr, c.cal_grupo, c.cal_valor, p.pro_descricao FROM compaluno c LEFT JOIN produtos p ON p.pro_cod=c.cal_grupo WHERE c.cal_unidade=${u} ORDER BY c.cal_matr`),
    // Sem GROUP BY (o phpMyAdmin devolveu vazio numa agregação em 04/11/2026): soma por recibo aqui.
    consultarTudo(
      `SELECT r.rec_id, r.rec_data, r.rec_status, r.rec_data_cancel, i.rei_matr, i.rei_valtotal FROM reciboc r JOIN reciboi i ON i.rei_id=r.rec_id WHERE r.rec_unidade=${u} AND r.rec_data >= ${sqlTexto(desde)} ORDER BY r.rec_id`,
    ),
    consultarMercurio(`SELECT tur_turma, tur_nivel FROM turmas WHERE tur_unidade=${u}`),
    consultarMercurio(`SELECT DISTINCT dfn_matr FROM dirigente_funcoes WHERE dfn_unidade=${u} AND dfn_atual='S'`),
    consultarTudo(`SELECT pro_cod, pro_descricao FROM produtos ORDER BY pro_cod`),
  ]);

  const daUnidade = new Set(cadastros.map((c) => c.cad_matr));
  const fora = matriculasDoNovo.filter((m) => /^\d+$/.test(m) && !daUnidade.has(m));
  const outrasUnidades = fora.length
    ? await consultarTudo(`SELECT cad_matr, cad_nome, cad_unidade, cad_situacao FROM cadastro WHERE cad_matr IN (${fora.map(sqlNumero).join(",")}) ORDER BY cad_matr`)
    : [];

  const compDe = new Map<string, PessoaAntigo["composicao"]>();
  for (const c of composicao) {
    const lista = compDe.get(c.cal_matr!) ?? [];
    lista.push({ grupo: c.cal_grupo ?? "", rotulo: (c.pro_descricao ?? c.cal_grupo ?? "").trim(), valor: Number(c.cal_valor ?? 0) });
    compDe.set(c.cal_matr!, lista);
  }

  const porRecibo = new Map<string, LadoAntigo["recibos"][number]>();
  for (const r of recibos) {
    const id = r.rec_id!;
    const atual = porRecibo.get(id) ?? {
      id,
      matricula: r.rei_matr ?? "",
      data: (r.rec_data ?? "").slice(0, 10),
      valor: 0,
      // Mesma regra de importar.ts: cancelado por status ou com data de cancelamento de verdade (>= 1900).
      cancelado: r.rec_status === "CAN" || Boolean(r.rec_data_cancel && r.rec_data_cancel >= "1900-01-01"),
    };
    atual.valor += Number(r.rei_valtotal ?? 0);
    porRecibo.set(id, atual);
  }

  return {
    unidade,
    pessoas: cadastros.map((c) => ({
      matricula: c.cad_matr!,
      nome: (c.cad_nome ?? "").trim(),
      unidade: c.cad_unidade ?? unidade,
      situacao: c.cad_situacao ?? "",
      ingresso: vazia(c.cad_ingresso)?.slice(0, 10) ?? null,
      nivel: vazia(c.cad_nivel),
      turma: vazia(c.cad_turma),
      contato: {
        whatsapp: c.cad_cel_fone ? `${c.cad_cel_ddd ?? ""}${c.cad_cel_fone}` : "",
        whatsappAlt: c.cad_res_fone ? `${c.cad_res_ddd ?? ""}${c.cad_res_fone}` : "",
        email: c.cad_email ?? "",
        cidade: c.cad_res_cidade ?? "",
        uf: c.cad_res_uf ?? "",
      },
      pessoais: {
        nascimento: vazia(c.cad_nascimento)?.slice(0, 10) ?? null,
        naturalidade: c.cad_naturalidade ?? "",
        profissao: c.cad_profissao ?? "",
        estadoCivil: c.cad_estado_civil ?? "",
        escolaridade: c.cad_escolaridade ?? "",
        rg: c.cad_rg ?? "",
        cpf: "",
      },
      composicao: compDe.get(c.cad_matr!) ?? [],
    })),
    outrasUnidades: outrasUnidades.map((c) => ({ matricula: c.cad_matr!, nome: (c.cad_nome ?? "").trim(), unidade: c.cad_unidade ?? "", situacao: c.cad_situacao ?? "" })),
    recibos: [...porRecibo.values()],
    turmas: turmas.filter((t) => t.tur_turma).map((t) => ({ nome: t.tur_turma!, nivel: vazia(t.tur_nivel) })),
    comFuncao: new Set(funcoes.map((f) => f.dfn_matr ?? "").filter(Boolean)),
    produtos: produtos.filter((p) => p.pro_cod).map((p) => ({ cod: p.pro_cod!, descricao: (p.pro_descricao ?? "").trim() })),
  };
}

/** Datas "0000-00-00" e marcadores "??" do Mercúrio contam como vazio (mesma regra de declaracoes/dados.ts). */
const vazia = (v: string | null | undefined) => (!v || v.startsWith("0000") || v === "???" || v === "??" ? null : v);
