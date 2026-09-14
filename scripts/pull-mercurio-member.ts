/**
 * Puxa os dados reais de contato/endereço de um membro direto do Mercúrio
 * (via o adapter REAL da aplicação, src/lib/mercurio) e atualiza o registro
 * dele no banco do Portal. Usa o mesmo código de produção que o Portal usa
 * (mercurioAdapter), não um script à parte — valida a integração de
 * verdade, não uma cópia dela.
 *
 * Uso: npx tsx --env-file=.env scripts/pull-mercurio-member.ts <mercurioId>
 */
import { db } from "../src/lib/db";
import { mercurioAdapter } from "../src/lib/mercurio";

async function main() {
  const mercurioId = process.argv[2];
  if (!mercurioId) throw new Error("Uso: npx tsx --env-file=.env scripts/pull-mercurio-member.ts <mercurioId>");

  const member = await db.member.findUniqueOrThrow({ where: { mercurioId }, include: { school: true } });
  if (!member.school.mercurioFilialLabel) throw new Error(`Escola "${member.school.name}" sem mercurioFilialLabel configurado.`);

  console.log(`Puxando dados reais do Mercúrio pra ${member.name} (matrícula ${mercurioId})...`);
  const dados = await mercurioAdapter.pullContactData({
    matricula: mercurioId,
    name: member.name,
    filialLabel: member.school.mercurioFilialLabel,
  });
  console.log("Dados recebidos:", dados);

  const atualizado = await db.member.update({
    where: { id: member.id },
    data: {
      whatsapp: dados.whatsapp || member.whatsapp,
      whatsappAlt: dados.whatsappAlt || null,
      email: dados.email || member.email,
      addressStreet: dados.addressStreet || null,
      addressNumber: dados.addressNumber || null,
      addressComplement: dados.addressComplement || null,
      addressNeighborhood: dados.addressNeighborhood || null,
      addressCity: dados.addressCity || null,
      addressState: dados.addressState || null,
      addressZip: dados.addressZip || null,
    },
  });

  console.log("\n✅ Contato/endereço atualizado com dado real do Mercúrio:");
  console.log(JSON.stringify(atualizado, null, 2));

  console.log("\nPuxando 'Mais Dados' (RG, nascimento, profissão...)...");
  const pessoais = await mercurioAdapter.pullPersonalData({
    matricula: mercurioId,
    name: member.name,
    filialLabel: member.school.mercurioFilialLabel,
  });
  console.log("Dados recebidos:", pessoais);

  const atualizadoPessoais = await db.member.update({
    where: { id: member.id },
    data: {
      birthDate: pessoais.birthDate,
      naturalidade: pessoais.naturalidade || null,
      profession: pessoais.profession || null,
      estadoCivil: pessoais.estadoCivil || null,
      escolaridade: pessoais.escolaridade || null,
      rgNumero: pessoais.rgNumero || null,
      rgOrgaoEmissor: pessoais.rgOrgaoEmissor || null,
      rgDataEmissao: pessoais.rgDataEmissao,
    },
  });

  console.log("\n✅ Mais Dados atualizado com dado real do Mercúrio:");
  console.log(JSON.stringify(atualizadoPessoais, null, 2));
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
