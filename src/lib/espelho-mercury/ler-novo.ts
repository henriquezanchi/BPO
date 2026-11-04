import "server-only";
import {
  mercuryGetBranchMovements,
  mercuryGetBranchStaff,
  mercuryGetClasses,
  mercuryGetContributionPlan,
  mercuryGetContributions,
  mercuryGetDossier,
  mercuryGetPeople,
  mercuryGetReceipts,
  type MercuryPerson,
} from "@/lib/mercury/client";
import type { LadoNovo, PessoaNovo } from "./tipos";

/**
 * Lê a filial no Mercúrio novo (API externa, só leitura) e reduz ao formato de tipos.ts. Ativos: tudo (dossiê,
 * recibos, composição; contribuições só de quem tem recibo do `desde` em diante). Inativos: só quem mudou desde
 * `desde` menos um dia (para pegar inativações). ~3 chamadas por pessoa; o cliente espera e repete em 429 (120/min).
 *
 * Erro passageiro faz a rodada inteira falhar (e tentar na noite seguinte): ler pela metade faria pendências
 * sumirem como "resolvidas". Só 403/404 (dado que a chave não enxerga) contam como "o novo não informa".
 * `prazo`: hora-limite; passou dela, para antes de estourar o tempo da rotina.
 */
export async function lerLadoNovo(branchId: string, desde: string, opcoes: { hoje?: Date; prazo?: number } = {}): Promise<LadoNovo> {
  const hoje = opcoes.hoje ?? new Date();
  const umDiaAntes = new Date(new Date(`${desde}T00:00:00Z`).getTime() - 86_400_000).toISOString();
  const [ativos, mudaram] = await Promise.all([
    mercuryGetPeople({ branchId, active: true, limit: 100 }),
    mercuryGetPeople({ branchId, active: false, updatedSince: umDiaAntes, limit: 100 }),
  ]);
  // A chave enxerga filiais de outros países: confere a filial de cada um (client.ts).
  const daFilial = (p: MercuryPerson) => !p.branch || p.branch.id === branchId;
  const anos = anosEntre(Number(desde.slice(0, 4)), hoje.getUTCFullYear());

  const pessoas: PessoaNovo[] = [];
  for (const p of [...ativos.filter(daFilial), ...mudaram.filter(daFilial)]) {
    if (opcoes.prazo && Date.now() > opcoes.prazo) throw new Error(`Leitura do Mercúrio novo não coube no tempo da rotina (${pessoas.length} pessoas lidas). Dividir a rodada.`);
    pessoas.push(await lerPessoa(p, anos, desde));
  }

  const [classes, staff, movimentos] = await Promise.all([
    mercuryGetClasses({ branchId, limit: 100 }),
    mercuryGetBranchStaff(branchId).catch(semAcesso),
    lerMovimentos(branchId, desde, hoje),
  ]);

  return {
    pessoas,
    turmas: classes.filter((c) => c.branch?.id === branchId).map((c) => ({ nome: c.name, nivel: c.level?.code ?? null, diaSemana: c.weekDay, hora: c.startTime, ativa: c.status === "EM_ANDAMENTO" })),
    movimentos,
    cargos: (staff?.roles ?? []).map((r) => ({ matricula: r.registrationNo, nome: r.fullName, cargo: r.role })),
  };
}

async function lerPessoa(p: MercuryPerson, anos: number[], desde: string): Promise<PessoaNovo> {
  const m = p.registrationNo;
  const [dossie, recibos, plano] = await Promise.all([
    mercuryGetDossier(m).catch(semAcesso),
    mercuryGetReceipts(m),
    p.active ? mercuryGetContributionPlan(m).catch(semAcesso) : Promise.resolve(null),
  ]);
  // Meses pagos só servem para classificar recibo novo (contribuição x avulso).
  const contribuicoes = recibos.some((r) => r.date.slice(0, 10) >= desde) ? await Promise.all(anos.map((ano) => mercuryGetContributions(m, ano))) : [];
  const doc = (tipo: string) => dossie?.documents.find((d) => d.type.toUpperCase() === tipo)?.number ?? null;

  return {
    matricula: m,
    nome: p.fullName,
    ativo: p.active,
    ingresso: dia(p.admissionDate),
    nivel: p.level?.code ?? null,
    turma: p.class?.name ?? null,
    inativacao: dossie?.deactivation ? { em: dia(dossie.deactivation.at), motivo: dossie.deactivation.reason } : null,
    contato: dossie ? { whatsapp: dossie.phones.primary, whatsappAlt: dossie.phones.alternate, email: dossie.email, cidade: dossie.city, uf: dossie.state } : null,
    pessoais: dossie
      ? { nascimento: dia(dossie.birthDate), naturalidade: dossie.placeOfBirth, profissao: dossie.profession, estadoCivil: dossie.maritalStatus, escolaridade: dossie.educationLevel, rg: doc("RG"), cpf: doc("CPF") }
      : null,
    // Sem plano (ou campo "não modelado" em coverage) não compara: ausência no novo não apaga o antigo.
    composicao: plano?.plan && !plano.coverage?.plan ? plano.plan.components.map((c) => ({ rotulo: c.label, valor: Number(c.value) })).filter((c) => Number.isFinite(c.valor)) : null,
    recibos: recibos.map((r) => ({ id: r.id, numero: r.number, data: r.date.slice(0, 10), valor: Number(r.amount), descricao: r.description, ativo: r.receiptActive !== false })),
    mesesPagos: contribuicoes
      .flatMap((c) => c.months.filter((x) => x.status === "pago" && x.paidOn).map((x) => ({ ano: c.year, mes: x.month, valor: Number(x.amount ?? 0), pagoEm: x.paidOn!.slice(0, 10) }))),
  };
}

async function lerMovimentos(branchId: string, desde: string, hoje: Date) {
  const meses: { ano: number; mes: number }[] = [];
  let [ano, mes] = desde.split("-").map(Number);
  while (ano < hoje.getUTCFullYear() || (ano === hoje.getUTCFullYear() && mes <= hoje.getUTCMonth() + 1)) {
    meses.push({ ano, mes });
    if (++mes > 12) [ano, mes] = [ano + 1, 1];
  }
  const lidos = await Promise.all(meses.map((m) => mercuryGetBranchMovements(branchId, m.ano, m.mes).catch(semAcesso)));
  return lidos.filter((x) => x !== null).map((x) => ({ ano: x.year, mes: x.month, linhas: x.rows.map((r) => ({ rubrica: r.rubrica, tipo: r.type, entradas: Number(r.entradas) || 0, saidas: Number(r.saidas) || 0 })) }));
}

/** 403/404 = a chave não enxerga esse dado: "não informado". Qualquer outro erro sobe. */
function semAcesso(e: unknown): null {
  if (e instanceof Error && /HTTP (403|404)/.test(e.message)) return null;
  throw e;
}

const dia = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);
const anosEntre = (de: number, ate: number) => Array.from({ length: Math.max(1, ate - de + 1) }, (_, i) => de + i);
