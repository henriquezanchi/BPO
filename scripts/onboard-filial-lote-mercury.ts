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
import { mercuryGetDossier, mercuryGetPeople } from "../src/lib/mercury/client";

function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
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

  let membrosCriadosOuAtualizados = 0;
  let loginsProvisionados = 0;
  let semEmail = 0;
  let semCpf = 0;
  let comErro = 0;

  for (const ativo of ativos) {
    try {
      await new Promise((r) => setTimeout(r, 400)); // ritmo pausado — evita 429 em filiais grandes (visto ao vivo 2026-10-15)
      const dossier = await mercuryGetDossier(ativo.registrationNo);

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
      };

      const member = await db.member.upsert({
        where: { mercurioId: dossier.registrationNo },
        update: dadosComuns,
        create: { ...dadosComuns, mercurioId: dossier.registrationNo, registrationNo: dossier.registrationNo, status: "em_dia" },
      });
      membrosCriadosOuAtualizados++;

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
    `\n✅ Onboarding em lote (Mercury API) concluído: ${membrosCriadosOuAtualizados} Member(s) criado(s)/atualizado(s), ${loginsProvisionados} login(s) provisionado(s), ${semEmail} sem e-mail, ${semCpf} sem CPF legível, ${comErro} com erro.`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
