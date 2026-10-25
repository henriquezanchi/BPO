import "server-only";
import { PAGO, clienteNaSubconta, cobrancaNaSubconta, pixDaCobranca, situacaoDaCobranca } from "@/lib/asaas/subconta";
import { cifrarCpf, cpfValido } from "@/lib/cpf-cifrado";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * Site de matrículas (pedido do usuário 2026-10-25): cada abertura tem um link público (/matricula/<token>) aberto
 * ao criá-la e que os responsáveis podem desligar. A pessoa preenche os dados do cadastro do Mercúrio, paga a 1ª
 * contribuição (Pix, cartão ou boleto) na subconta Asaas da filial e aparece como matrícula paga na abertura.
 * Fase 1: a matrícula paga vira pendência da Escolástica para lançar no Mercúrio. Fase 2 (gravação direta) só
 * depois da liberação do João Guilherme, testada em Barra do Garças e no Universitário.
 */

export async function aberturaPorToken(token: string) {
  if (!/^[a-f0-9]{16,64}$/.test(token)) return null;
  const a = await db.aberturaTurma.findUnique({
    where: { matriculaToken: token },
    select: {
      id: true,
      titulo: true,
      primeiraAula: true,
      inicioMinuto: true,
      diaSemana: true,
      sala: true,
      capacidade: true,
      status: true,
      matriculaAberta: true,
      valorContribuicaoCentavos: true,
      schoolId: true,
    },
  });
  if (!a) return null;
  const [school, pagas] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: a.schoolId }, select: { name: true, city: true, uf: true, asaasSubaccountApiKey: true } }),
    db.matriculaOnline.count({ where: { aberturaId: a.id, status: { in: ["paga", "lancada"] } } }),
  ]);
  const encerrada = a.status === "cancelada" || a.status === "concluida";
  return {
    ...a,
    school,
    disponivel: a.matriculaAberta && !encerrada,
    pagas,
    lotada: pagas >= a.capacidade,
    cobraOnline: !!school.asaasSubaccountApiKey && (a.valorContribuicaoCentavos ?? 0) > 0,
  };
}

const opcional = z.string().trim().max(200).optional().transform((v) => v || null);
export const dadosMatricula = z.object({
  nome: z.string().trim().min(5, "Informe o nome completo.").max(150),
  email: z.string().trim().email("E-mail inválido.").max(150),
  celular: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length >= 10 && v.length <= 11, "Celular com DDD, só números."),
  cpf: z.string().transform((v) => v.replace(/\D/g, "")).refine(cpfValido, "CPF inválido."),
  nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida."),
  sexo: z.enum(["F", "M"]),
  naturalidade: opcional,
  nacionalidade: opcional,
  estadoCivil: opcional,
  rg: opcional,
  rgOrgao: opcional,
  rgEmissao: opcional,
  escolaridade: opcional,
  profissao: opcional,
  cep: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length === 8, "CEP com 8 números."),
  logradouro: z.string().trim().min(3).max(200),
  numero: z.string().trim().min(1).max(20),
  complemento: opcional,
  bairro: z.string().trim().min(2).max(100),
  cidade: z.string().trim().min(2).max(100),
  uf: z.string().trim().toUpperCase().length(2),
  comoConheceu: opcional,
  consentimento: z.literal(true, { message: "É preciso concordar com o uso dos dados para a matrícula." }),
});
export type DadosMatricula = z.input<typeof dadosMatricula>;

/** Grava a matrícula e, se a filial cobra pelo site, cria a cobrança na subconta. */
export async function criarMatricula(token: string, entrada: unknown) {
  const a = await aberturaPorToken(token);
  if (!a || !a.disponivel) throw new Error("As matrículas desta turma não estão abertas.");
  if (a.lotada) throw new Error("As vagas desta turma estão preenchidas.");
  const d = dadosMatricula.parse(entrada);
  const jaPaga = await db.matriculaOnline.findFirst({ where: { aberturaId: a.id, cpfInicio: d.cpf.slice(0, 6), email: d.email, status: { in: ["paga", "lancada"] } }, select: { id: true } });
  if (jaPaga) throw new Error("Já existe uma matrícula paga com estes dados nesta turma.");
  const valorCentavos = a.valorContribuicaoCentavos ?? 0;
  const m = await db.matriculaOnline.create({
    data: {
      aberturaId: a.id,
      schoolId: a.schoolId,
      nome: d.nome,
      email: d.email,
      celular: d.celular,
      nascimento: d.nascimento,
      sexo: d.sexo,
      naturalidade: d.naturalidade,
      nacionalidade: d.nacionalidade,
      estadoCivil: d.estadoCivil,
      rg: d.rg,
      rgOrgao: d.rgOrgao,
      rgEmissao: d.rgEmissao,
      cpfInicio: d.cpf.slice(0, 6),
      cpfCifrado: cifrarCpf(d.cpf),
      escolaridade: d.escolaridade,
      profissao: d.profissao,
      cep: d.cep,
      logradouro: d.logradouro,
      numero: d.numero,
      complemento: d.complemento,
      bairro: d.bairro,
      cidade: d.cidade,
      uf: d.uf,
      comoConheceu: d.comoConheceu,
      consentimentoEm: new Date(),
      valorCentavos,
      status: a.cobraOnline ? "aguardando_pagamento" : "aguardando_escola",
    },
  });
  if (!a.cobraOnline) {
    await pendenciaEscolastica(m.id, "Matrícula pelo site sem pagamento online: combinar a 1ª contribuição e lançar no Mercúrio");
    return { id: m.id, pagamento: null };
  }
  const apiKey = a.school.asaasSubaccountApiKey!;
  const customerId = await clienteNaSubconta(apiKey, { nome: d.nome, cpf: d.cpf, email: d.email, celular: d.celular });
  const vencimento = new Date(Date.now() + 3 * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const cobranca = await cobrancaNaSubconta(apiKey, { customerId, valor: valorCentavos / 100, descricao: `1ª contribuição · ${a.titulo}`, vencimento, referencia: `matricula:${m.id}` });
  await db.matriculaOnline.update({ where: { id: m.id }, data: { asaasCustomerId: customerId, asaasPaymentId: cobranca.id } });
  const pix = await pixDaCobranca(apiKey, cobranca.id).catch(() => null);
  return { id: m.id, pagamento: { invoiceUrl: cobranca.invoiceUrl, pixPayload: pix?.payload ?? null, pixImagem: pix?.encodedImage ?? null } };
}

async function pendenciaEscolastica(matriculaId: string, motivo: string) {
  const m = await db.matriculaOnline.findUniqueOrThrow({ where: { id: matriculaId }, select: { schoolId: true, nome: true, abertura: { select: { titulo: true } } } });
  await db.scholasticPendency.create({
    data: { schoolId: m.schoolId, tipo: "matricula_site", title: `${motivo}: ${m.nome} (${m.abertura.titulo})`, notes: `Matrícula pelo site ${matriculaId}. Dados completos na abertura de turma.`, dueDate: new Date(Date.now() + 3 * 864e5) },
  });
}

/** Confere uma cobrança no Asaas e, se paga, marca a matrícula e avisa a Escolástica. Devolve o status atual. */
export async function conferirPagamento(matriculaId: string) {
  const m = await db.matriculaOnline.findUnique({ where: { id: matriculaId }, select: { status: true, asaasPaymentId: true, school: { select: { asaasSubaccountApiKey: true } } } });
  if (!m) return null;
  if (m.status !== "aguardando_pagamento" || !m.asaasPaymentId || !m.school.asaasSubaccountApiKey) return m.status;
  const c = await situacaoDaCobranca(m.school.asaasSubaccountApiKey, m.asaasPaymentId);
  if (!PAGO.has(c.status)) return m.status;
  const marcou = await db.matriculaOnline.updateMany({ where: { id: matriculaId, status: "aguardando_pagamento" }, data: { status: "paga", pagoEm: new Date() } });
  if (marcou.count) await pendenciaEscolastica(matriculaId, "Matrícula paga pelo site: lançar no Mercúrio e na turma");
  return "paga";
}

/** Rotina (a cada 5 min): confere as matrículas aguardando pagamento dos últimos 5 dias. */
export async function conferirMatriculasPendentes() {
  const pendentes = await db.matriculaOnline.findMany({
    where: { status: "aguardando_pagamento", asaasPaymentId: { not: null }, createdAt: { gte: new Date(Date.now() - 5 * 864e5) } },
    select: { id: true },
    take: 50,
  });
  let pagas = 0;
  for (const p of pendentes) if ((await conferirPagamento(p.id).catch(() => null)) === "paga") pagas++;
  return { conferidas: pendentes.length, pagas };
}
