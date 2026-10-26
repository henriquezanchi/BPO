import { db } from "@/lib/db";
import { colunasDoCadastro, consultarMercurio, sqlTexto } from "./client";

/**
 * Resumo diário da filial pro Relatório do Painel do Diretor (pedido do
 * usuário 2026-10-19: visão rápida pro maior gestor da filial, além da
 * economia). Lê a filial INTEIRA no banco de consulta do Mercúrio — não só
 * quem tem conta no Portal — e grava em ResumoFilial. Só ativos
 * (cad_situacao='ATI'), exceto onde a conta é justamente de desligados.
 */

const NIVEIS: Record<string, string> = {
  N1: "Nível 1",
  PP: "Pré-provacionistas",
  CA: "Círculo de Amigos",
  JN: "Janos",
  TA: "Távolas",
  CO: "Correntinha",
};

const n = (v: string | null | undefined) => Number(v ?? 0) || 0;

export interface ResumoFilialDados {
  atualizacaoMercurio: string | null;
  mesReferencia: string; // "2026-10"
  pessoas: {
    ativos: number;
    membros: number; // N2 em diante
    porNivel: { nivel: string; rotulo: string; total: number }[];
    fv: number;
    provacionistas: number;
    hd: number;
    dirigentes: number;
    /** Ativos que tinham saído e voltaram (cad_recuperado='S', 26/10/2026). Ausente em resumos antigos. */
    recuperados?: number;
  };
  movimento: {
    // últimos 12, do mais antigo ao atual; recuperados = reingressos no mês (quem saiu e voltou, fora quem só entrou)
    meses: { mes: string; entradas: number; saidas: number; segundoNivel: number; recuperados?: number }[];
    motivosSaida: { motivo: string; total: number }[]; // últimos 3 meses
  };
  aniversariantes: { matricula: string; nome: string; dia: number; nivel: string }[];
  contribuicao: {
    mesAtual: { paga: number; emBranco: number; atrasada: number; isenta: number };
    pessoasComAtraso: number; // ativos com algum mês em atraso no ano
    mesesEmAtraso: number;
  };
  receita: { mes: string; valor: number; recibos: number }[]; // mês anterior e atual
  turmas: {
    total: number;
    lista: { turma: string; nivel: string; dia: string; horario: string; alunos: number; instrutores: number; previsaoFormatura: string | null }[];
  };
}

/** O cliente do banco de consulta devolve no máximo 5.000 linhas por vez (session_max_rows). */
export async function emPaginas(sql: string, tamanho = 4000) {
  const todas: Record<string, string | null>[] = [];
  for (let desde = 0; ; desde += tamanho) {
    const pagina = await consultarMercurio(`${sql} LIMIT ${tamanho} OFFSET ${desde}`);
    todas.push(...pagina);
    if (pagina.length < tamanho) return todas;
  }
}

/**
 * Gera e grava o resumo de uma unidade do Mercúrio. Com `schoolId` (filial aberta no Portal) grava em
 * ResumoFilial; sem ele (unidade da OINAB-N ainda fora do Portal, 2026-10-25) grava em ResumoNacional
 * com a chave "unidade:<id>".
 */
export async function gerarResumoFilial(uniId: string, schoolId: string | null, unidade?: { nome: string; cidade: string; uf: string }): Promise<ResumoFilialDados> {
  const u = sqlTexto(uniId);
  const agora = new Date();
  const fusoBR = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const hoje = fusoBR(agora);
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const mesStr = (a: number, m: number) => `${a}-${String(m).padStart(2, "0")}`;
  const inicio12 = new Date(Date.UTC(ano, mes - 12, 1)).toISOString().slice(0, 10);
  const mesAnterior = mes === 1 ? mesStr(ano - 1, 12) : mesStr(ano, mes - 1);
  // Sem cad_dirigente na view (desde 24/10/2026), conta os dirigentes que o Portal já conhece.
  const colunas = await colunasDoCadastro();
  const dirigentesNoMercurio = colunas.has("cad_dirigente");
  const recuperadosNoMercurio = colunas.has("cad_recuperado");

  const [atualizacao, niveis, fvPro, hdDir, entradas, saidas, segundo, motivos, aniversariantes, fichasMes, atrasosFicha, receita, turmas, recibosOnline, recuperados, reingressos] = await Promise.all([
    consultarMercurio("SELECT MAX(data) d FROM `atualização`").catch(() => [{ d: null }]),
    consultarMercurio(`SELECT cad_nivel, COUNT(*) n FROM cadastro WHERE cad_situacao='ATI' AND cad_unidade=${u} GROUP BY cad_nivel`),
    consultarMercurio(`SELECT cad_situacao_fv, COUNT(*) n FROM cadastro WHERE cad_situacao='ATI' AND cad_unidade=${u} AND cad_situacao_fv IN ('BRG','PRO') GROUP BY cad_situacao_fv`),
    consultarMercurio(`SELECT SUM(cad_machado IN ('HDA','HDR')) hd, ${dirigentesNoMercurio ? "SUM(cad_dirigente='S')" : "NULL"} dir FROM cadastro WHERE cad_situacao='ATI' AND cad_unidade=${u}`),
    consultarMercurio(`SELECT DATE_FORMAT(cad_ingresso,'%Y-%m') m, COUNT(*) n FROM cadastro WHERE cad_unidade=${u} AND cad_ingresso >= '${inicio12}' GROUP BY m`),
    consultarMercurio(`SELECT DATE_FORMAT(cad_baixa,'%Y-%m') m, COUNT(*) n FROM cadastro WHERE cad_unidade=${u} AND cad_situacao='INA' AND cad_baixa >= '${inicio12}' GROUP BY m`),
    consultarMercurio(`SELECT DATE_FORMAT(cad_2o_nivel,'%Y-%m') m, COUNT(*) n FROM cadastro WHERE cad_unidade=${u} AND cad_2o_nivel >= '${inicio12}' GROUP BY m`),
    consultarMercurio(
      `SELECT COALESCE(s.smb_descricao, 'Não informado') motivo, COUNT(*) n FROM cadastro c LEFT JOIN sig_motivo_baixa s ON s.smb_cod=c.cad_cod_baixa WHERE c.cad_unidade=${u} AND c.cad_situacao='INA' AND c.cad_baixa >= '${new Date(Date.UTC(ano, mes - 3, 1)).toISOString().slice(0, 10)}' GROUP BY motivo ORDER BY n DESC LIMIT 6`,
    ),
    consultarMercurio(`SELECT cad_matr, cad_nome, DAY(cad_nascimento) dia, cad_nivel FROM cadastro WHERE cad_situacao='ATI' AND cad_unidade=${u} AND MONTH(cad_nascimento)=${mes} ORDER BY dia, cad_nome`),
    consultarMercurio(
      `SELECT f.fic_matr, f.fic_status FROM fichas f JOIN cadastro c ON c.cad_matr=f.fic_matr WHERE c.cad_situacao='ATI' AND c.cad_unidade=${u} AND f.fic_unidade=${u} AND f.fic_ano=${ano} AND f.fic_mes=${mes}`,
    ),
    emPaginas(
      `SELECT f.fic_matr, f.fic_mes FROM fichas f JOIN cadastro c ON c.cad_matr=f.fic_matr WHERE c.cad_situacao='ATI' AND c.cad_unidade=${u} AND f.fic_ano=${ano} AND f.fic_status='ATR' ORDER BY f.fic_matr, f.fic_mes`,
    ),
    consultarMercurio(
      `SELECT DATE_FORMAT(r.rec_data,'%Y-%m') m, COUNT(DISTINCT r.rec_id) recibos, SUM(i.rei_valtotal) valor FROM reciboc r JOIN reciboi i ON i.rei_id=r.rec_id WHERE r.rec_unidade=${u} AND r.rec_data >= '${mesAnterior}-01' AND (r.rec_data_cancel IS NULL OR r.rec_data_cancel < '1900-01-01') GROUP BY m`,
    ),
    consultarMercurio(
      `SELECT t.tur_turma, t.tur_nivel, t.tur_dia, t.tur_horario, t.tur_previsao_formatura, (SELECT COUNT(*) FROM cadastro c WHERE c.cad_situacao='ATI' AND c.cad_tur_unidade=t.tur_unidade AND c.cad_turma=t.tur_turma) alunos, (SELECT COUNT(DISTINCT tm.tma_instrutor) FROM turmas_materias tm WHERE tm.tma_unidade=t.tur_unidade AND tm.tma_turma=t.tur_turma) instrutores FROM turmas t WHERE t.tur_unidade=${u} HAVING alunos > 0 ORDER BY t.tur_turma`,
    ),
    // Recibos são view ao vivo; fichas é cópia (desde 17/10/2026). Mês com recibo válido de contribuição conta como pago,
    // a mesma regra da importação (importar.ts): produto da composição da pessoa (compaluno) ou "CONTRIBUI…".
    emPaginas(
      `SELECT DISTINCT i.rei_matr, i.rei_mes FROM reciboi i JOIN reciboc r ON r.rec_id=i.rei_id JOIN cadastro c ON c.cad_matr=i.rei_matr LEFT JOIN produtos p ON p.pro_cod=i.rei_produto WHERE c.cad_situacao='ATI' AND c.cad_unidade=${u} AND i.rei_ano=${ano} AND i.rei_mes<=${mes} AND r.rec_status<>'CAN' AND (r.rec_data_cancel IS NULL OR r.rec_data_cancel < '1900-01-01') AND (p.pro_descricao LIKE 'CONTRIBUI%' OR EXISTS (SELECT 1 FROM compaluno ca WHERE ca.cal_matr=i.rei_matr AND ca.cal_grupo=i.rei_produto)) ORDER BY i.rei_matr, i.rei_mes`,
    ),
    // Recuperados (pedido do usuário 2026-10-26): ativos que saíram e voltaram; reingressos por mês (sem quem entrou e "reingressou" no mesmo dia).
    recuperadosNoMercurio ? consultarMercurio(`SELECT SUM(cad_recuperado='S') n FROM cadastro WHERE cad_situacao='ATI' AND cad_unidade=${u}`) : Promise.resolve([{ n: null }]),
    consultarMercurio(`SELECT DATE_FORMAT(cad_reingresso,'%Y-%m') m, COUNT(*) n FROM cadastro WHERE cad_unidade=${u} AND cad_reingresso >= '${inicio12}' AND (cad_ingresso IS NULL OR cad_reingresso <> cad_ingresso) GROUP BY m`),
  ]);
  const pagoOnline = new Set(recibosOnline.map((r) => `${r.rei_matr}-${n(r.rei_mes)}`));
  const statusMes = new Map(fichasMes.map((f) => [f.fic_matr ?? "", f.fic_status ?? ""]));
  for (const r of recibosOnline) if (n(r.rei_mes) === mes) statusMes.set(r.rei_matr ?? "", "PAG");
  const contaMes = (st: string) => [...statusMes.values()].filter((x) => x === st).length;
  const atrasos = atrasosFicha.filter((a) => !pagoOnline.has(`${a.fic_matr}-${n(a.fic_mes)}`));

  const porNivelMap = new Map(niveis.map((x) => [x.cad_nivel ?? "??", n(x.n)]));
  const membros = [...porNivelMap.entries()].filter(([k]) => /^N[2-9]$/.test(k)).reduce((s, [, v]) => s + v, 0);
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 12 + i, 1));
    return mesStr(d.getUTCFullYear(), d.getUTCMonth() + 1);
  });
  const mapa = (rows: Record<string, string | null>[]) => new Map(rows.map((r) => [r.m ?? "", n(r.n)]));
  const [mEnt, mSai, mSeg, mRec] = [mapa(entradas), mapa(saidas), mapa(segundo), mapa(reingressos)];
  const rec = new Map(receita.map((r) => [r.m ?? "", r]));

  const dados: ResumoFilialDados = {
    atualizacaoMercurio: atualizacao[0]?.d ?? null,
    mesReferencia: mesStr(ano, mes),
    pessoas: {
      ativos: [...porNivelMap.values()].reduce((s, v) => s + v, 0),
      membros,
      porNivel: [
        { nivel: "N2+", rotulo: "Membros (2º nível em diante)", total: membros },
        ...Object.entries(NIVEIS).map(([nivel, rotulo]) => ({ nivel, rotulo, total: porNivelMap.get(nivel) ?? 0 })),
      ].filter((x) => x.total > 0),
      fv: n(fvPro.find((x) => x.cad_situacao_fv === "BRG")?.n),
      provacionistas: n(fvPro.find((x) => x.cad_situacao_fv === "PRO")?.n),
      hd: n(hdDir[0]?.hd),
      dirigentes: dirigentesNoMercurio ? n(hdDir[0]?.dir) : schoolId ? await db.member.count({ where: { schoolId, mercurioAtivo: true, isDirigente: true } }) : 0,
      ...(recuperadosNoMercurio ? { recuperados: n(recuperados[0]?.n) } : {}),
    },
    movimento: {
      meses: meses.map((m) => ({ mes: m, entradas: mEnt.get(m) ?? 0, saidas: mSai.get(m) ?? 0, segundoNivel: mSeg.get(m) ?? 0, recuperados: mRec.get(m) ?? 0 })),
      motivosSaida: motivos.map((x) => ({ motivo: x.motivo ?? "Não informado", total: n(x.n) })),
    },
    aniversariantes: aniversariantes.map((a) => ({ matricula: a.cad_matr ?? "", nome: (a.cad_nome ?? "").trim(), dia: n(a.dia), nivel: a.cad_nivel ?? "" })),
    contribuicao: {
      mesAtual: { paga: contaMes("PAG"), emBranco: contaMes("BRA"), atrasada: contaMes("ATR"), isenta: contaMes("INA") },
      pessoasComAtraso: new Set(atrasos.map((a) => a.fic_matr)).size,
      mesesEmAtraso: atrasos.length,
    },
    receita: [mesAnterior, mesStr(ano, mes)].map((m) => ({ mes: m, valor: Math.round(Number(rec.get(m)?.valor ?? 0) * 100) / 100, recibos: n(rec.get(m)?.recibos) })),
    turmas: {
      total: turmas.length,
      lista: turmas.map((t) => ({
        turma: t.tur_turma ?? "",
        nivel: t.tur_nivel ?? "",
        dia: (t.tur_dia ?? "").toLowerCase(),
        horario: (t.tur_horario ?? "").slice(0, 5),
        alunos: n(t.alunos),
        instrutores: n(t.instrutores),
        previsaoFormatura: t.tur_previsao_formatura && t.tur_previsao_formatura > "1900" ? t.tur_previsao_formatura : null,
      })),
    },
  };

  if (schoolId) {
    await db.resumoFilial.upsert({
      where: { schoolId },
      update: { dados: dados as unknown as object, geradoEm: new Date() },
      create: { schoolId, dados: dados as unknown as object },
    });
  } else {
    const comUnidade = { ...dados, unidade: { id: uniId, ...unidade } };
    await db.resumoNacional.upsert({
      where: { chave: `unidade:${uniId}` },
      update: { dados: comUnidade as unknown as object, geradoEm: new Date() },
      create: { chave: `unidade:${uniId}`, dados: comUnidade as unknown as object },
    });
  }
  return dados;
}
