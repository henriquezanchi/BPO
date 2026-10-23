import { createHash } from "node:crypto";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  cifrarLinkPlay,
  hashEmailPlay,
  chavePlay,
  normalizarNomePlay,
  validarLinkPlay,
} from "../src/lib/acropole-play/core";
import { lerExportacaoPlay, type AlunoPlay } from "../src/lib/acropole-play/import";

const TAMANHO_MAXIMO_EXPORTACAO = 6 * 1024 * 1024;
const TAMANHO_MAXIMO_SNAPSHOT = 64 * 1024 * 1024;
const TAMANHO_LOTE = 50;
const ID_CATALOGO = "catalog";
const HASH_HEX = /^[a-f0-9]{64}$/;

type StatusCatalogo =
  | "matched_active"
  | "pending_no_active"
  | "pending_ambiguous"
  | "pending_name";

type MembroMercurio = {
  mercurioId: string;
  unidade: string;
  emailHash: string;
  nameHash: string;
};

type SnapshotMercurio = {
  base_atualizada_em: string;
  alunos: MembroMercurio[];
};

type RegistroCatalogo = {
  sourceStudentId: string;
  emailHash: string;
  nameHash: string;
  loginCiphertext: string;
  mercurioId: string | null;
  mercurioUnit: string | null;
  reconciliationStatus: StatusCatalogo;
  mercurioSnapshotAt: string;
  updatedAt: string;
};

type LinhaRelatorio = {
  sourceStudentId: string | null;
  status: StatusCatalogo | "invalid_input";
  mercurioId?: string;
};

type PlanoLinha = {
  aluno: AlunoPlay;
  sourceStudentId: string;
  emailHash: string;
  nameHash: string;
  link: string;
  status: StatusCatalogo;
  mercurioId: string | null;
  mercurioUnit: string | null;
  podeGravar: boolean;
};

type Opcoes = {
  arquivo: string;
  snapshot: string;
  aplicar: boolean;
  validarSomente: boolean;
  relatorio: string | null;
};

class ErroSeguro extends Error {}

function erroDeUso(): never {
  throw new ErroSeguro(
    'Uso: npx tsx --env-file=.env scripts/import-acropole-play.ts <exportacao.xls> --mercurio=<snapshot.json> [--apply | --validate-only] [--report=<arquivo.json|->]',
  );
}

function lerOpcoes(argv: string[]): Opcoes {
  let arquivo: string | null = null;
  let snapshot: string | null = null;
  let aplicar = false;
  let validarSomente = false;
  let relatorio: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") aplicar = true;
    else if (arg === "--validate-only") validarSomente = true;
    else if (arg.startsWith("--mercurio=")) snapshot = arg.slice("--mercurio=".length);
    else if (arg.startsWith("--report=")) relatorio = arg.slice("--report=".length);
    else if (arg === "--report") {
      const proximo = argv[++i];
      if (!proximo || proximo.startsWith("--")) erroDeUso();
      relatorio = proximo;
    } else if (arg.startsWith("--")) erroDeUso();
    else if (!arquivo) arquivo = arg;
    else erroDeUso();
  }

  if (!arquivo || !snapshot || (aplicar && validarSomente) || relatorio === "") erroDeUso();
  return { arquivo, snapshot, aplicar, validarSomente, relatorio };
}

async function lerArquivoLimitado(caminho: string, limite: number, descricao: string) {
  let tamanho: number;
  try {
    tamanho = (await stat(caminho)).size;
  } catch {
    throw new ErroSeguro(`Não foi possível abrir ${descricao}.`);
  }
  if (tamanho > limite) throw new ErroSeguro(`${descricao} excede o limite de tamanho.`);
  let bytes: Buffer;
  try {
    bytes = await readFile(caminho);
  } catch {
    throw new ErroSeguro(`Não foi possível ler ${descricao}.`);
  }
  if (bytes.length > limite) throw new ErroSeguro(`${descricao} excede o limite de tamanho.`);
  return bytes;
}

function lerSnapshot(bytes: Buffer): { membros: MembroMercurio[]; atualizadoEm: string } {
  let bruto: unknown;
  try {
    bruto = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new ErroSeguro("Snapshot Mercúrio inválido.");
  }
  if (!bruto || typeof bruto !== "object") throw new ErroSeguro("Snapshot Mercúrio inválido.");
  const snapshot = bruto as Partial<SnapshotMercurio>;
  const dataMs = typeof snapshot.base_atualizada_em === "string" ? Date.parse(snapshot.base_atualizada_em) : NaN;
  if (!Number.isFinite(dataMs) || !Array.isArray(snapshot.alunos)) {
    throw new ErroSeguro("Snapshot Mercúrio incompleto.");
  }

  const membros: MembroMercurio[] = [];
  const ids = new Set<string>();
  for (const item of snapshot.alunos) {
    if (!item || typeof item !== "object") throw new ErroSeguro("Snapshot Mercúrio inválido.");
    const membro = item as Partial<MembroMercurio>;
    if (
      typeof membro.mercurioId !== "string" ||
      !/^\d{1,20}$/.test(membro.mercurioId) ||
      typeof membro.unidade !== "string" ||
      !membro.unidade.trim() ||
      typeof membro.emailHash !== "string" ||
      !HASH_HEX.test(membro.emailHash) ||
      typeof membro.nameHash !== "string" ||
      !HASH_HEX.test(membro.nameHash)
    ) {
      throw new ErroSeguro("Snapshot Mercúrio contém uma linha inválida.");
    }
    if (ids.has(membro.mercurioId)) {
      throw new ErroSeguro("Snapshot Mercúrio tem matrícula repetida.");
    }
    ids.add(membro.mercurioId);
    membros.push({
      mercurioId: membro.mercurioId,
      unidade: membro.unidade.trim(),
      emailHash: membro.emailHash,
      nameHash: membro.nameHash,
    });
  }

  return { membros, atualizadoEm: new Date(dataMs).toISOString() };
}

function contarRepetidos(valores: string[]) {
  const contagem = new Map<string, number>();
  for (const valor of valores) {
    if (valor) contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
  }
  const repetidos = new Set([...contagem].filter(([, n]) => n > 1).map(([valor]) => valor));
  return { contagem, repetidos };
}

function linkSeguro(valor: string) {
  try {
    const link = validarLinkPlay(valor);
    const parametros = new URL(link).searchParams.getAll("crstk");
    return parametros.length === 1 && parametros[0] ? link : null;
  } catch {
    return null;
  }
}

function criarPlano(alunos: AlunoPlay[], membros: MembroMercurio[]) {
  const idsOriginais = contarRepetidos(alunos.map((a) => a.id));
  const emailsOriginais = contarRepetidos(alunos.map((a) => a.email));
  const linksCanonicos = alunos.map((a) => linkSeguro(a.link));
  const linksOriginais = contarRepetidos(
    linksCanonicos.map((link) => (link ? createHash("sha256").update(link).digest("hex") : "")),
  );
  const ativosPorEmail = new Map<string, MembroMercurio[]>();
  for (const membro of membros) {
    const lista = ativosPorEmail.get(membro.emailHash) ?? [];
    lista.push(membro);
    ativosPorEmail.set(membro.emailHash, lista);
  }

  const linhas: LinhaRelatorio[] = [];
  const planos: PlanoLinha[] = [];
  for (const [indice, aluno] of alunos.entries()) {
    const idValido = /^\d{1,20}$/.test(aluno.id);
    const emailValido = /^\S+@\S+\.\S+$/.test(aluno.email);
    const nomeNormalizado = normalizarNomePlay(aluno.nome);
    const link = linksCanonicos[indice];
    if (!idValido || !emailValido || !nomeNormalizado || !link) {
      linhas.push({ sourceStudentId: idValido ? aluno.id : null, status: "invalid_input" });
      continue;
    }

    const emailHash = hashEmailPlay(aluno.email);
    const nameHash = createHash("sha256").update(nomeNormalizado).digest("hex");
    const idDuplicado = idsOriginais.repetidos.has(aluno.id);
    const emailDuplicado = emailsOriginais.repetidos.has(aluno.email);
    const linkDuplicado = linksOriginais.repetidos.has(createHash("sha256").update(link).digest("hex"));
    const candidatos = ativosPorEmail.get(emailHash) ?? [];

    let status: StatusCatalogo;
    let mercurioId: string | null = null;
    let mercurioUnit: string | null = null;
    if (idDuplicado || emailDuplicado || linkDuplicado || candidatos.length > 1) {
      status = "pending_ambiguous";
    } else if (candidatos.length === 0) {
      status = "pending_no_active";
    } else if (candidatos[0].nameHash !== nameHash) {
      status = "pending_name";
    } else {
      status = "matched_active";
      mercurioId = candidatos[0].mercurioId;
      mercurioUnit = candidatos[0].unidade;
    }

    const podeGravar = !idDuplicado;
    planos.push({ aluno, sourceStudentId: aluno.id, emailHash, nameHash, link, status, mercurioId, mercurioUnit, podeGravar });
    linhas.push({
      sourceStudentId: aluno.id,
      status,
      ...(mercurioId ? { mercurioId } : {}),
    });
  }
  return { planos, linhas };
}

function resumir(linhas: LinhaRelatorio[]) {
  const porStatus: Record<string, number> = {};
  for (const linha of linhas) porStatus[linha.status] = (porStatus[linha.status] ?? 0) + 1;
  return porStatus;
}

function clienteSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new ErroSeguro("Supabase não está configurado para esta operação.");
  try {
    return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  } catch {
    throw new ErroSeguro("Não foi possível iniciar o cliente Supabase.");
  }
}

async function lerCatalogoExistente(supabase: SupabaseClient) {
  const existentes = new Map<string, { emailHash: string; reconciliationStatus: string }>();
  const pagina = 1000;
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("AcropolePlayStudent")
      .select("sourceStudentId,emailHash,reconciliationStatus")
      .order("sourceStudentId")
      .range(inicio, inicio + pagina - 1);
    if (error || !data) throw new ErroSeguro("Não foi possível consultar o catálogo atual.");
    for (const registro of data as { sourceStudentId: string; emailHash: string; reconciliationStatus: string }[]) {
      existentes.set(registro.sourceStudentId, {
        emailHash: registro.emailHash,
        reconciliationStatus: registro.reconciliationStatus,
      });
    }
    if (data.length < pagina) break;
  }
  return existentes;
}

function contarMudancas(planos: PlanoLinha[], existentes: Map<string, { emailHash: string; reconciliationStatus: string }>) {
  let existentesNoCatalogo = 0;
  let emailAlterado = 0;
  let promovidos = 0;
  for (const plano of planos) {
    if (!plano.podeGravar) continue;
    const anterior = existentes.get(plano.sourceStudentId);
    if (!anterior) continue;
    existentesNoCatalogo++;
    if (anterior.emailHash !== plano.emailHash) emailAlterado++;
    if (anterior.reconciliationStatus !== "matched_active" && plano.status === "matched_active") promovidos++;
  }
  return { existentesNoCatalogo, emailAlterado, promovidos };
}

async function obterChave(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("acropole_play_chave");
  if (error || typeof data !== "string") throw new ErroSeguro("Não foi possível obter a chave protegida da Acrópole Play.");
  try {
    return chavePlay(data);
  } catch {
    throw new ErroSeguro("A chave protegida da Acrópole Play está inválida.");
  }
}

async function gravarCatalogo(supabase: SupabaseClient, planos: PlanoLinha[], atualizadoEm: string) {
  const gravaveis = planos.filter((p) => p.podeGravar);
  if (!gravaveis.length) return { gravados: 0, ignoradosPorIdDuplicado: planos.length, lotes: 0 };
  const chave = await obterChave(supabase);
  const agora = new Date().toISOString();
  const registros: RegistroCatalogo[] = gravaveis.map((p) => ({
    sourceStudentId: p.sourceStudentId,
    emailHash: p.emailHash,
    nameHash: p.nameHash,
    loginCiphertext: cifrarLinkPlay(
      p.link,
      { memberId: ID_CATALOGO, sourceStudentId: p.sourceStudentId, emailHash: p.emailHash },
      chave,
    ),
    mercurioId: p.mercurioId,
    mercurioUnit: p.mercurioUnit,
    reconciliationStatus: p.status,
    mercurioSnapshotAt: atualizadoEm,
    updatedAt: agora,
  }));

  const totalLotes = Math.ceil(registros.length / TAMANHO_LOTE);
  for (let inicio = 0; inicio < registros.length; inicio += TAMANHO_LOTE) {
    const lote = registros.slice(inicio, inicio + TAMANHO_LOTE);
    const { error } = await supabase.from("AcropolePlayStudent").upsert(lote, { onConflict: "sourceStudentId" });
    if (error) {
      const loteAtual = Math.floor(inicio / TAMANHO_LOTE) + 1;
      throw new ErroSeguro(`Falha ao gravar o lote ${loteAtual} de ${totalLotes}; reexecute o importador para retomar com segurança.`);
    }
  }
  return { gravados: registros.length, ignoradosPorIdDuplicado: planos.length - gravaveis.length, lotes: totalLotes };
}

async function salvarRelatorio(caminho: string | null, arquivoOrigem: string, snapshotOrigem: string, corpo: string) {
  if (!caminho || caminho === "-") return false;
  const destino = resolve(caminho);
  const fontes = [arquivoOrigem, snapshotOrigem];
  for (const fonte of fontes) {
    try {
      if (destino === await realpath(fonte)) throw new ErroSeguro("O relatório não pode sobrescrever os arquivos de entrada.");
    } catch (error) {
      if (error instanceof ErroSeguro) throw error;
    }
  }
  try {
    await writeFile(destino, corpo, { encoding: "utf8", mode: 0o600, flag: "wx" });
  } catch {
    throw new ErroSeguro("Não foi possível criar o relatório. Escolha um caminho novo.");
  }
  return true;
}

async function main() {
  const opcoes = lerOpcoes(process.argv.slice(2));
  const arquivoBytes = await lerArquivoLimitado(opcoes.arquivo, TAMANHO_MAXIMO_EXPORTACAO, "a exportação");
  const snapshotBytes = await lerArquivoLimitado(opcoes.snapshot, TAMANHO_MAXIMO_SNAPSHOT, "o snapshot Mercúrio");
  let alunos: AlunoPlay[];
  try {
    alunos = lerExportacaoPlay(arquivoBytes);
  } catch (error) {
    throw new ErroSeguro(error instanceof Error ? error.message : "Exportação inválida.");
  }
  const snapshot = lerSnapshot(snapshotBytes);
  const { planos, linhas } = criarPlano(alunos, snapshot.membros);
  const totais = resumir(linhas);
  const modo = opcoes.aplicar ? "apply" : opcoes.validarSomente ? "validate-only" : "dry-run";

  let existentes = new Map<string, { emailHash: string; reconciliationStatus: string }>();
  const resumo = opcoes.validarSomente
    ? { mode: modo, sourceRows: alunos.length, activeSnapshotRows: snapshot.membros.length, totals: totais, wouldWrite: planos.filter((p) => p.podeGravar).length }
    : null;
  if (!opcoes.validarSomente) {
    const supabase = clienteSupabase();
    existentes = await lerCatalogoExistente(supabase);
    const mudancas = contarMudancas(planos, existentes);
    if (opcoes.aplicar) {
      const { data: config, error: configError } = await supabase.from("AcropolePlayConfig").select("enabled").eq("id", true).single();
      if (configError || !config || config.enabled) throw new ErroSeguro("Desative o acesso automático durante a importação e reative após conferir os totais.");
      const gravacao = await gravarCatalogo(supabase, planos, snapshot.atualizadoEm);
      const resultado = { mode: modo, sourceRows: alunos.length, totals: totais, ...mudancas, ...gravacao };
      if (opcoes.relatorio === "-") console.error(JSON.stringify(resultado));
      else console.log(JSON.stringify(resultado));
    } else {
      const resultado = { mode: modo, sourceRows: alunos.length, totals: totais, ...mudancas, wouldWrite: planos.filter((p) => p.podeGravar).length };
      if (opcoes.relatorio === "-") console.error(JSON.stringify(resultado));
      else console.log(JSON.stringify(resultado));
    }
  } else {
    if (opcoes.relatorio === "-") console.error(JSON.stringify(resumo));
    else console.log(JSON.stringify(resumo));
  }

  if (opcoes.relatorio) {
    const corpo = `${JSON.stringify({ mode: modo, rows: linhas }, null, 2)}\n`;
    const salvou = await salvarRelatorio(opcoes.relatorio, opcoes.arquivo, opcoes.snapshot, corpo);
    if (!salvou) process.stdout.write(corpo);
  }
}

main().catch((error: unknown) => {
  const mensagem = error instanceof ErroSeguro ? error.message : "Falha inesperada no importador. Nenhum detalhe sensível foi exibido.";
  console.error(`ERRO: ${mensagem}`);
  process.exitCode = 1;
});
