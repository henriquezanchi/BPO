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
  };
  movimento: {
    meses: { mes: string; entradas: number; saidas: number; segundoNivel: number }[]; // últimos 12, do mais antigo ao atual
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

export async function gerarResumoFilial(uniId: string, schoolId: string): Promise<ResumoFilialDados> {
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
  const dirigentesNoMercurio = (await colunasDoCadastro()).has("cad_dirigente");

  const [atualizacao, niveis, fvPro, hdDir, entradas, saidas, segundo, motivos, aniversariantes, fichasMes, atrasos, receita, turmas] = await Promise.all([
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
      `SELECT f.fic_status, COUNT(DISTINCT f.fic_matr) n FROM fichas f JOIN cadastro c ON c.cad_matr=f.fic_matr WHERE c.cad_situacao='ATI' AND c.cad_unidade=${u} AND f.fic_unidade=${u} AND f.fic_ano=${ano} AND f.fic_mes=${mes} GROUP BY f.fic_status`,
    ),
    consultarMercurio(
      `SELECT COUNT(DISTINCT f.fic_matr) pessoas, COUNT(*) meses FROM fichas f JOIN cadastro c ON c.cad_matr=f.fic_matr WHERE c.cad_situacao='ATI' AND c.cad_unidade=${u} AND f.fic_ano=${ano} AND f.fic_status='ATR'`,
    ),
    consultarMercurio(
      `SELECT DATE_FORMAT(r.rec_data,'%Y-%m') m, COUNT(DISTINCT r.rec_id) recibos, SUM(i.rei_valtotal) valor FROM reciboc r JOIN reciboi i ON i.rei_id=r.rec_id WHERE r.rec_unidade=${u} AND r.rec_data >= '${mesAnterior}-01' AND (r.rec_data_cancel IS NULL OR r.rec_data_cancel < '1900-01-01') GROUP BY m`,
    ),
    consultarMercurio(
      `SELECT t.tur_turma, t.tur_nivel, t.tur_dia, t.tur_horario, t.tur_previsao_formatura, (SELECT COUNT(*) FROM cadastro c WHERE c.cad_situacao='ATI' AND c.cad_tur_unidade=t.tur_unidade AND c.cad_turma=t.tur_turma) alunos, (SELECT COUNT(DISTINCT tm.tma_instrutor) FROM turmas_materias tm WHERE tm.tma_unidade=t.tur_unidade AND tm.tma_turma=t.tur_turma) instrutores FROM turmas t WHERE t.tur_unidade=${u} HAVING alunos > 0 ORDER BY t.tur_turma`,
    ),
  ]);

  const porNivelMap = new Map(niveis.map((x) => [x.cad_nivel ?? "??", n(x.n)]));
  const membros = [...porNivelMap.entries()].filter(([k]) => /^N[2-9]$/.test(k)).reduce((s, [, v]) => s + v, 0);
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 12 + i, 1));
    return mesStr(d.getUTCFullYear(), d.getUTCMonth() + 1);
  });
  const mapa = (rows: Record<string, string | null>[]) => new Map(rows.map((r) => [r.m ?? "", n(r.n)]));
  const [mEnt, mSai, mSeg] = [mapa(entradas), mapa(saidas), mapa(segundo)];
  const fic = new Map(fichasMes.map((f) => [f.fic_status ?? "", n(f.n)]));
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
      dirigentes: dirigentesNoMercurio ? n(hdDir[0]?.dir) : await db.member.count({ where: { schoolId, mercurioAtivo: true, isDirigente: true } }),
    },
    movimento: {
      meses: meses.map((m) => ({ mes: m, entradas: mEnt.get(m) ?? 0, saidas: mSai.get(m) ?? 0, segundoNivel: mSeg.get(m) ?? 0 })),
      motivosSaida: motivos.map((x) => ({ motivo: x.motivo ?? "Não informado", total: n(x.n) })),
    },
    aniversariantes: aniversariantes.map((a) => ({ matricula: a.cad_matr ?? "", nome: (a.cad_nome ?? "").trim(), dia: n(a.dia), nivel: a.cad_nivel ?? "" })),
    contribuicao: {
      mesAtual: { paga: fic.get("PAG") ?? 0, emBranco: fic.get("BRA") ?? 0, atrasada: fic.get("ATR") ?? 0, isenta: fic.get("INA") ?? 0 },
      pessoasComAtraso: n(atrasos[0]?.pessoas),
      mesesEmAtraso: n(atrasos[0]?.meses),
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

  await db.resumoFilial.upsert({
    where: { schoolId },
    update: { dados: dados as unknown as object, geradoEm: new Date() },
    create: { schoolId, dados: dados as unknown as object },
  });
  return dados;
}
