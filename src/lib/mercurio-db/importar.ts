import { db } from "@/lib/db";
import { parseLogradouro } from "@/lib/mercurio/parse-logradouro";
import type { ContributionMonthStatus } from "@prisma/client";
import { consultarMercurio, sqlNumero, sqlTexto } from "./client";

/**
 * Importa/sincroniza membros a partir do banco de consulta do Mercúrio
 * (cópia diária). Substitui as LEITURAS do scraper: cadastro, situação
 * mensal, composição, cargos e instrutores — numa rodada por filial, sem
 * abrir ficha por ficha. Escrita no Mercúrio continua via fila/RPA.
 *
 * A tabela `cadastro` só traz membros ATIVOS (confirmado 2026-10-18: 7933
 * linhas, todas cad_situacao='ATI') — quem some dela saiu da escola.
 */

type Linha = Record<string, string | null>;

const LOTE = 4000;

/** Pagina por LIMIT/OFFSET — o phpMyAdmin devolve no máx. 5000 linhas por chamada. */
async function consultarTudo(sql: string): Promise<Linha[]> {
  const todas: Linha[] = [];
  for (let offset = 0; ; offset += LOTE) {
    const lote = await consultarMercurio(`${sql} LIMIT ${LOTE} OFFSET ${offset}`);
    todas.push(...lote);
    if (lote.length < LOTE) return todas;
  }
}

function dataOuNull(s: string | null | undefined): Date | null {
  if (!s || s.startsWith("0000")) return null;
  const d = new Date(`${s.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function textoOuNull(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t && t !== "???" ? t : null;
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
export function nomeProprio(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

const STATUS_FICHA: Record<string, ContributionMonthStatus> = { PAG: "paga", BRA: "em_branco", ATR: "atrasado", INA: "isento" };

/** Cargos que liberam testadores na própria filial (siglas de sig_dirigente_funcoes). */
const CARGOS_LIBERADORES = new Set(["CF", "SBF", "SCF", "CCE"]);
const CARGOS_SUBCHEFE = new Set(["SBF", "SCF"]);

/** Cria (se preciso) a School ligada a uma unidade do Mercúrio. Não mexe em portalAberto de escola já existente. */
export async function garantirEscola(uniId: string, opcoes: { portalAberto?: boolean } = {}) {
  const existente = await db.school.findUnique({ where: { mercurioUnidade: uniId } });
  if (existente) return existente;

  const [u] = await consultarMercurio(`SELECT uni_nome, uni_cidade, uni_cnpj, uni_ddd, uni_fone, uni_fundacao FROM unidades WHERE uni_id=${sqlTexto(uniId)}`);
  if (!u) throw new Error(`Unidade ${uniId} não existe no banco do Mercúrio.`);
  const nome = nomeProprio(u.uni_nome ?? uniId);
  return db.school.create({
    data: {
      name: `Nova Acrópole - ${nome}`,
      city: nome,
      mercurioUnidade: uniId,
      portalAberto: opcoes.portalAberto ?? false,
      cnpj: textoOuNull(u.uni_cnpj),
      telefoneUnidade: u.uni_fone ? `${u.uni_ddd ?? ""}${u.uni_fone}` : null,
      fundacao: dataOuNull(u.uni_fundacao),
    },
  });
}

/**
 * Sincroniza uma filial. `matriculas` limita a quem importar (ex: primeiro
 * acesso de 1 pessoa); sem ela, atualiza só quem JÁ tem Member local
 * (rodada diária — não cria cadastro de quem nunca entrou no Portal).
 */
export async function sincronizarUnidade(uniId: string, opcoes: { matriculas?: string[]; ano?: number } = {}) {
  const school = await garantirEscola(uniId);
  const ano = opcoes.ano ?? new Date().getFullYear();

  const filtroMatr = opcoes.matriculas?.length ? ` AND cad_matr IN (${opcoes.matriculas.map(sqlNumero).join(",")})` : "";
  const cadastros = await consultarTudo(`SELECT * FROM cadastro WHERE cad_unidade=${sqlTexto(uniId)}${filtroMatr} ORDER BY cad_matr`);

  const conhecidos = new Set(
    (await db.member.findMany({ where: { mercurioId: { in: cadastros.map((c) => c.cad_matr!) } }, select: { mercurioId: true } })).map((m) => m.mercurioId),
  );
  const alvo = opcoes.matriculas?.length ? cadastros : cadastros.filter((c) => conhecidos.has(c.cad_matr));
  if (!alvo.length) return { school, importados: 0 };

  const lista = alvo.map((c) => sqlNumero(c.cad_matr!)).join(",");
  const [unidade] = await consultarMercurio(`SELECT uni_diretor, uni_subchefe FROM unidades WHERE uni_id=${sqlTexto(uniId)}`);
  const fichas = await consultarTudo(`SELECT fic_matr, fic_mes, fic_status, fic_recibo, fic_datapg FROM fichas WHERE fic_ano=${sqlNumero(ano)} AND fic_matr IN (${lista}) ORDER BY fic_matr, fic_mes`);
  const composicao = await consultarTudo(
    `SELECT c.cal_matr, c.cal_grupo, c.cal_valor, p.pro_descricao FROM compaluno c LEFT JOIN produtos p ON p.pro_cod=c.cal_grupo WHERE c.cal_unidade=${sqlTexto(uniId)} AND c.cal_matr IN (${lista}) ORDER BY c.cal_matr`,
  );
  const funcoes = await consultarTudo(`SELECT dfn_matr, dfn_funcao, dfn_descricao FROM dirigente_funcoes WHERE dfn_atual='S' AND dfn_matr IN (${lista}) ORDER BY dfn_matr`);

  // Recibos dos meses pagos — gravados JÁ com o conteúdo (rawText), pra
  // tela "Situação da Contribuição" abrir o comprovante na hora, sem fila
  // do scraper nem acesso ao banco a partir do site.
  const idsRecibo = [...new Set(fichas.map((f) => f.fic_recibo).filter((r): r is string => !!r && r !== "0"))];
  const recibos = idsRecibo.length
    ? await consultarTudo(`SELECT rec_id, rec_data, rec_status, rec_data_cancel, rec_interessado FROM reciboc WHERE rec_id IN (${idsRecibo.map(sqlNumero).join(",")}) ORDER BY rec_id`)
    : [];
  const itensRecibo = idsRecibo.length
    ? await consultarTudo(
        `SELECT i.rei_id, i.rei_item, i.rei_valtotal, i.rei_mes, i.rei_ano, p.pro_descricao FROM reciboi i LEFT JOIN produtos p ON p.pro_cod=i.rei_produto WHERE i.rei_id IN (${idsRecibo.map(sqlNumero).join(",")}) ORDER BY i.rei_id, i.rei_item`,
      )
    : [];

  const porMatr = <T extends Linha>(linhas: T[], chave: string) => {
    const m = new Map<string, T[]>();
    for (const l of linhas) m.set(l[chave]!, [...(m.get(l[chave]!) ?? []), l]);
    return m;
  };
  const fichasPor = porMatr(fichas, "fic_matr");
  const composicaoPor = porMatr(composicao, "cal_matr");
  const funcoesPor = porMatr(funcoes, "dfn_matr");
  const reciboPorId = new Map(recibos.map((r) => [r.rec_id!, r]));
  const itensPorRecibo = porMatr(itensRecibo, "rei_id");

  for (const c of alvo) {
    const matr = c.cad_matr!;
    const minhasFuncoes = funcoesPor.get(matr) ?? [];
    const siglas = new Set(minhasFuncoes.map((f) => f.dfn_funcao ?? ""));
    const cargos = [...new Set(minhasFuncoes.map((f) => (f.dfn_descricao ?? "").trim()).filter(Boolean))];
    const textoCargos = cargos.join(" ").toUpperCase();
    const isDiretor = unidade?.uni_diretor === matr;
    const isSubChefe = unidade?.uni_subchefe === matr || [...siglas].some((s) => CARGOS_SUBCHEFE.has(s));
    const nivel = c.cad_nivel ?? "";
    const { street, number, complement } = parseLogradouro(c.cad_res_logradouro ?? "");
    const cep = c.cad_res_cep && c.cad_res_cep !== "0" ? c.cad_res_cep.padStart(8, "0") : null;
    const celular = c.cad_cel_fone ? `${c.cad_cel_ddd ?? ""}${c.cad_cel_fone}` : c.cad_res_fone ? `${c.cad_res_ddd ?? ""}${c.cad_res_fone}` : "";

    const dados = {
      schoolId: school.id,
      registrationNo: matr,
      name: (c.cad_nome ?? "").trim(),
      whatsapp: celular.replace(/\D/g, ""),
      email: textoOuNull(c.cad_email)?.toLowerCase() ?? null,
      addressStreet: textoOuNull(street),
      addressNumber: textoOuNull(number),
      addressComplement: textoOuNull(complement),
      addressNeighborhood: textoOuNull(c.cad_res_bairro),
      addressCity: textoOuNull(c.cad_res_cidade),
      addressState: textoOuNull(c.cad_res_uf),
      addressZip: cep,
      birthDate: dataOuNull(c.cad_nascimento),
      naturalidade: textoOuNull(c.cad_naturalidade),
      profession: textoOuNull(c.cad_profissao),
      estadoCivil: textoOuNull(c.cad_estado_civil),
      escolaridade: textoOuNull(c.cad_escolaridade),
      rgNumero: textoOuNull(c.cad_rg),
      rgOrgaoEmissor: textoOuNull(c.cad_orgao_expedidor),
      rgDataEmissao: dataOuNull(c.cad_rg_emissao),
      dataEntradaEscola: dataOuNull(c.cad_ingresso),
      dataSegundoNivel: dataOuNull(c.cad_2o_nivel),
      mercurioAtivo: true,
      mercurioAtivoSync: new Date(),
      isPedagogo: textoOuNull(c.cad_pedagogo) !== null,
      pedagogoSyncedAt: new Date(),
      isDiretor,
      isSubChefe,
      direcaoSyncedAt: new Date(),
      isSecretarioEscolastica: textoCargos.includes("ESCOLÁST") || textoCargos.includes("ESCOLAST"),
      isSecretarioEconomia: textoCargos.includes("ECONOMIA"),
      cargos,
      liberaTestadores: isDiretor || isSubChefe || [...siglas].some((s) => CARGOS_LIBERADORES.has(s)),
      isProvacionista: nivel === "PP",
      isMembroPrograma: /^N\d$/.test(nivel),
      isCirculoDeAmigos: nivel === "CA",
      isCorrentinha: nivel === "CO",
      isTavolas: nivel === "TA",
      isJanos: nivel === "JN",
      perfilGruposSyncedAt: new Date(),
    };

    const member = await db.member.upsert({
      where: { mercurioId: matr },
      update: dados,
      create: { ...dados, mercurioId: matr, status: "em_dia" },
    });

    const meses = fichasPor.get(matr) ?? [];
    for (const f of meses) {
      const status = STATUS_FICHA[f.fic_status ?? ""] ?? "em_branco";
      const paga = dataOuNull(f.fic_datapg);
      const d = {
        status,
        registeredAtBR: paga ? paga.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null,
        mercurioRecId: f.fic_recibo && f.fic_recibo !== "0" ? f.fic_recibo : null,
        syncedAt: new Date(),
      };
      await db.contributionMonthlyStatus.upsert({
        where: { memberId_year_month: { memberId: member.id, year: ano, month: Number(f.fic_mes) } },
        update: d,
        create: { ...d, memberId: member.id, year: ano, month: Number(f.fic_mes) },
      });
    }
    for (const recId of new Set(meses.map((f) => f.fic_recibo).filter((r): r is string => !!r && r !== "0"))) {
      const cab = reciboPorId.get(recId);
      if (!cab) continue;
      const linhas = itensPorRecibo.get(recId) ?? [];
      const total = linhas.reduce((s, l) => s + Number(l.rei_valtotal ?? 0), 0);
      const emissao = dataOuNull(cab.rec_data) ?? new Date();
      const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const rawText = [
        `NOVA ACRÓPOLE — ${school.name.replace(/^Nova Acrópole - /, "").toUpperCase()}`,
        `RECIBO Nº ${recId}`,
        `Data: ${emissao.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`,
        `Recebemos de: ${(cab.rec_interessado ?? c.cad_nome ?? "").trim()} (matrícula ${matr})`,
        "",
        ...linhas.map((l) => `${(l.pro_descricao ?? "ITEM").trim().padEnd(40, " ")} ${String(l.rei_mes).padStart(2, "0")}/${l.rei_ano}  R$ ${brl(Number(l.rei_valtotal ?? 0)).padStart(10, " ")}`),
        "".padEnd(68, "-"),
        `${"TOTAL".padEnd(50, " ")}R$ ${brl(total).padStart(10, " ")}`,
      ].join("\n");
      const cancelado = dataOuNull(cab.rec_data_cancel) !== null;
      const resumo = linhas.length ? `${(linhas[0].pro_descricao ?? "").trim()}${linhas.length > 1 ? ` +${linhas.length - 1} itens` : ""}` : null;
      const d = { memberId: member.id, issuedAt: emissao, amount: total, rawText, canceled: cancelado, probablyCanceled: cancelado, itemsSummary: resumo, fetchedAt: new Date() };
      await db.contributionReceipt.upsert({ where: { mercurioRecId: recId }, update: d, create: { ...d, mercurioRecId: recId } });
    }

    if (meses.length && member.status !== "negociando") {
      const novo = meses.some((f) => f.fic_status === "ATR") ? "atrasado" : meses.every((f) => f.fic_status === "INA") ? "isento" : "em_dia";
      if (novo !== member.status) await db.member.update({ where: { id: member.id }, data: { status: novo } });
    }

    const itens = composicaoPor.get(matr) ?? [];
    const grupos = new Set<string>();
    for (const it of itens) {
      const grupo = it.cal_grupo!;
      if (grupos.has(grupo)) continue;
      grupos.add(grupo);
      const d = { label: (it.pro_descricao ?? `ITEM ${grupo}`).trim(), amount: Number(it.cal_valor ?? 0) };
      await db.contributionCompositionItem.upsert({
        where: { memberId_mercurioGroupId: { memberId: member.id, mercurioGroupId: grupo } },
        update: d,
        create: { ...d, memberId: member.id, mercurioGroupId: grupo },
      });
    }
    // Item incluído pelo membro no Portal pode ainda estar a caminho do
    // Mercúrio (fila) — só remove o que veio do próprio Mercúrio.
    await db.contributionCompositionItem.deleteMany({ where: { memberId: member.id, addedViaPortal: false, mercurioGroupId: { notIn: [...grupos] } } });
  }

  if (!opcoes.matriculas?.length) {
    // Rodada da filial inteira: quem tinha Member local e sumiu do cadastro saiu da escola.
    const ativos = new Set(cadastros.map((c) => c.cad_matr));
    const locais = await db.member.findMany({ where: { schoolId: school.id, mercurioAtivo: true, mercurioId: { not: null } }, select: { id: true, mercurioId: true } });
    const sairam = locais.filter((m) => !ativos.has(m.mercurioId!)).map((m) => m.id);
    if (sairam.length) await db.member.updateMany({ where: { id: { in: sairam } }, data: { mercurioAtivo: false, mercurioAtivoSync: new Date() } });

    const catalogo = await consultarMercurio(
      `SELECT DISTINCT c.cal_grupo, p.pro_descricao FROM compaluno c JOIN produtos p ON p.pro_cod=c.cal_grupo WHERE c.cal_unidade=${sqlTexto(uniId)}`,
    );
    for (const item of catalogo) {
      await db.schoolCompositionCatalogItem.upsert({
        where: { schoolId_mercurioGroupId: { schoolId: school.id, mercurioGroupId: item.cal_grupo! } },
        update: { label: (item.pro_descricao ?? "").trim(), syncedAt: new Date() },
        create: { schoolId: school.id, mercurioGroupId: item.cal_grupo!, label: (item.pro_descricao ?? "").trim() },
      });
    }
  }

  return { school, importados: alvo.length };
}

/** Importa 1 pessoa (primeiro acesso). Devolve o Member já gravado. */
export async function importarMembro(matricula: string) {
  const [c] = await consultarMercurio(`SELECT cad_unidade FROM cadastro WHERE cad_matr=${sqlNumero(matricula)}`);
  if (!c?.cad_unidade) throw new Error(`Matrícula ${matricula} não encontrada entre os ativos do Mercúrio.`);
  await sincronizarUnidade(c.cad_unidade, { matriculas: [matricula] });
  return db.member.findUniqueOrThrow({ where: { mercurioId: matricula }, include: { school: true } });
}
