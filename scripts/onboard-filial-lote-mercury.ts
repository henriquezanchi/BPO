/**
 * Onboarding em lote de uma filial inteira via Mercury API (não RPA) —
 * mesmo objetivo de onboard-filial-lote.ts, mas sem sessão de navegador
 * nem trava de concorrência: 1 chamada pra listar ativos + 1 chamada de
 * /dossier por pessoa (people.read + people.pii), bem mais rápido.
 *
 * Diferença real de cobertura de dados em relação à versão RPA (não é
 * paridade completa, ver ambas comentadas abaixo):
 * - /dossier NÃO traz endereço estruturado (rua/número/bairro/CEP) — só
 *   cidade/UF. addressStreet/Number/Complement/Neighborhood/Zip ficam null
 *   aqui; uma passada futura de onboard-filial-lote.ts (RPA) ainda serve
 *   pra completar isso se algum dia precisar.
 * - /dossier traz o NÚMERO do RG mas não órgão emissor nem data de
 *   emissão — ficam null também.
 *
 * CPF vem em documents[] SEM o zero à esquerda (confirmado ao vivo
 * 2026-10-15 contra a matrícula 21596 — bug de armazenamento do lado do
 * Mercúrio, CPF virou número em algum ponto) — sempre completa com
 * padStart(11, "0") antes de derivar a senha inicial, senão a senha fica
 * errada pra quem tem CPF começando com 0.
 *
 * Uso: npx tsx --env-file=.env scripts/onboard-filial-lote-mercury.ts <mercuryBranchId>
 */
import { db } from "../src/lib/db";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { provisionarLoginComSenha } from "../src/lib/mercurio/auth-provisioning";
import {
  mercuryGetBranchStaff,
  mercuryGetContributions,
  mercuryGetDossier,
  mercuryGetInstructors,
  mercuryGetPeople,
  type MercuryMonthStatus,
} from "../src/lib/mercury/client";
import type { ContributionMonthStatus } from "@prisma/client";

function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

// "cancelado" não existe no nosso enum — cobrança cancelada = nada confirmado no mês.
const STATUS_MES: Record<MercuryMonthStatus, ContributionMonthStatus> = {
  pago: "paga",
  em_branco: "em_branco",
  atrasado: "atrasado",
  isento: "isento",
  cancelado: "em_branco",
};

function isoParaBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function main() {
  const branchId = process.argv[2];
  if (!branchId) throw new Error("Uso: npx tsx --env-file=.env scripts/onboard-filial-lote-mercury.ts <mercuryBranchId>");

  const school = await db.school.findFirstOrThrow({ where: { mercuryBranchId: branchId } });
  console.log(`Escola: ${school.name}`);

  const ativos = await mercuryGetPeople({ branchId, active: true });
  console.log(`Ativos encontrados na Mercury API: ${ativos.length}`);

  const { data: authData, error: erroListaAuth } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (erroListaAuth) throw erroListaAuth;

  const instrutores = await mercuryGetInstructors({ branchId });
  // Qualquer um em /instructors conta como instrutor (mesmo critério da lista
  // "Integração > Pedagogos" do RPA). O campo `pedagogue` da API é bem mais
  // restrito (visto ao vivo 2026-10-16: 6 de 48 em Universitário) — não usar.
  const pedagogos = new Set(instrutores.map((i) => i.registrationNo));

  const staff = await mercuryGetBranchStaff(branchId);
  const cargosPorMatricula = new Map<string, Set<string>>();
  for (const r of staff.roles) {
    if (!r.registrationNo || r.role === "Não informado") continue;
    if (!cargosPorMatricula.has(r.registrationNo)) cargosPorMatricula.set(r.registrationNo, new Set());
    cargosPorMatricula.get(r.registrationNo)!.add(r.role);
  }
  console.log(`Pedagogos: ${pedagogos.size} · Pessoas com cargo: ${cargosPorMatricula.size}`);

  const anoAtual = new Date().getFullYear();

  let membrosCriadosOuAtualizados = 0;
  let loginsProvisionados = 0;
  let jaTinhamLogin = 0;
  let semEmail = 0;
  let semCpf = 0;
  let comErro = 0;

  for (const ativo of ativos) {
    try {
      await new Promise((r) => setTimeout(r, 400)); // ritmo pausado — evita 429 em filiais grandes (visto ao vivo 2026-10-15)
      const dossier = await mercuryGetDossier(ativo.registrationNo);
      const contribuicoes = await mercuryGetContributions(ativo.registrationNo, anoAtual);

      const dadosComuns = {
        schoolId: school.id,
        name: dossier.fullName,
        whatsapp: soDigitos(dossier.phones.primary),
        whatsappAlt: dossier.phones.alternate ? soDigitos(dossier.phones.alternate) : null,
        email: dossier.email,
        addressCity: dossier.city,
        addressState: dossier.state,
        birthDate: dossier.birthDate ? new Date(dossier.birthDate) : null,
        naturalidade: dossier.placeOfBirth,
        profession: dossier.profession,
        estadoCivil: dossier.maritalStatus,
        escolaridade: dossier.educationLevel,
        rgNumero: dossier.documents.find((d) => d.type === "RG")?.number ?? null,
        mercurioAtivo: true,
        mercurioAtivoSync: new Date(),
        isPedagogo: pedagogos.has(dossier.registrationNo),
        pedagogoSyncedAt: new Date(),
        cargos: [...(cargosPorMatricula.get(dossier.registrationNo) ?? [])],
      };

      const member = await db.member.upsert({
        where: { mercurioId: dossier.registrationNo },
        update: dadosComuns,
        create: { ...dadosComuns, mercurioId: dossier.registrationNo, registrationNo: dossier.registrationNo, status: "em_dia" },
      });
      membrosCriadosOuAtualizados++;

      for (const m of contribuicoes.months) {
        const dados = {
          status: STATUS_MES[m.status],
          registeredAtBR: m.paidOn ? isoParaBR(m.paidOn) : null,
          syncedAt: new Date(),
        };
        await db.contributionMonthlyStatus.upsert({
          where: { memberId_year_month: { memberId: member.id, year: contribuicoes.year, month: m.month } },
          update: dados,
          create: { ...dados, memberId: member.id, year: contribuicoes.year, month: m.month },
        });
      }

      // Mesma regra de sync-monthly-status.ts: nunca sobrescreve "negociando"
      // (registrado à mão, sem sinal disso no Mercúrio).
      if (member.status !== "negociando") {
        const temAtraso = contribuicoes.months.some((m) => m.status === "atrasado");
        const novoStatus = temAtraso ? "atrasado" : contribuicoes.standing === "ISENTO" ? "isento" : "em_dia";
        if (novoStatus !== member.status) await db.member.update({ where: { id: member.id }, data: { status: novoStatus } });
      }

      // Já tem login (ou é dependente de quem tem): NÃO mexe — provisionar de
      // novo redefine a senha pro padrão do CPF, apagando a que o membro escolheu.
      if (member.authUserId || member.responsavelId) {
        jaTinhamLogin++;
        continue;
      }

      if (!member.email) {
        console.log(`⚠ ${member.name}: sem e-mail no Mercúrio — Member ok, login NÃO provisionado.`);
        semEmail++;
        continue;
      }

      const cpfBruto = dossier.documents.find((d) => d.type === "CPF")?.number ?? "";
      const cpf = soDigitos(cpfBruto).padStart(11, "0");
      if (cpf.length < 11 || cpf === "0".repeat(11)) {
        console.log(`⚠ ${member.name}: CPF ausente/incompleto no Mercúrio — login NÃO provisionado.`);
        semCpf++;
        continue;
      }

      const senhaInicial = cpf.slice(0, 6);
      const { criado } = await provisionarLoginComSenha(member.id, member.email, senhaInicial, authData.users);
      console.log(`✓ ${member.name} (${member.email}): login ${criado ? "criado" : "atualizado"}.`);
      loginsProvisionados++;
    } catch (e) {
      comErro++;
      console.error(`✗ Falha em "${ativo.fullName}" (matrícula ${ativo.registrationNo}):`, (e as Error).message);
    }
  }

  console.log(
    `\n✅ Onboarding em lote (Mercury API) concluído: ${membrosCriadosOuAtualizados} Member(s) criado(s)/atualizado(s), ${loginsProvisionados} login(s) novo(s), ${jaTinhamLogin} já tinham login (senha preservada), ${semEmail} sem e-mail, ${semCpf} sem CPF legível, ${comErro} com erro.`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
