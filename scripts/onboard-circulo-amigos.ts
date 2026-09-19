/**
 * Onboarding do Círculo de Amigos (dentro de "COMPLEMENTAR" no Mercúrio,
 * separado da lista de Ativos — ver comentário em
 * src/lib/mercurio/browser-session.ts#abrirCirculoDeAmigos). Essas pessoas
 * TÊM matrícula e ficha reais (uni_cadfun.php), só não entram no relatório
 * mensal de Membro/Provacionista — por isso hoje aparecem no Portal (se
 * existirem como Member) sem matrícula/composição: nenhum script de
 * onboarding/sincronização olhava essa lista até agora.
 *
 * Igual a onboard-filial-lote.ts, mas: (a) lê a lista C. de Amigos em vez
 * de Ativos, (b) se já existir um Member com o MESMO NOME sem mercurioId
 * (placeholder pré-existente, caso real encontrado: Adanaielly Katiucy
 * Vitorino Silva), preenche esse registro em vez de criar duplicado, (c)
 * já sincroniza a composição na mesma sessão (não passa pelo
 * sync-composition.ts, que só sabe procurar na lista de Ativos normal).
 *
 * Uso: npx tsx --env-file=.env scripts/onboard-circulo-amigos.ts "<mercurioFilialLabel>"
 */
import { db } from "../src/lib/db";
import {
  abrirCirculoDeAmigos,
  abrirComposicao,
  abrirFichaDaListaAtivos,
  abrirSessaoMercurio,
  lerAbaEnderecos,
  lerAbaIdentificacao,
  lerAbaPessoais,
  lerCatalogoItensDisponiveis,
  lerComposicao,
  listarAtivosResumo,
  reabrirCirculoDeAmigos,
} from "../src/lib/mercurio/browser-session";
import { diaMesAnoParaData } from "../src/lib/mercurio/playwright-adapter";
import { parseLogradouro } from "../src/lib/mercurio/parse-logradouro";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const filialLabel = process.argv[2];
  if (!filialLabel) throw new Error('Uso: npx tsx scripts/onboard-circulo-amigos.ts "<mercurioFilialLabel>"');
  const filialLabelRegex = new RegExp(filialLabel, "i");

  const school = await db.school.findFirstOrThrow({ where: { mercurioFilialLabel: filialLabel } });
  console.log(`Escola: ${school.name}`);

  const { browser, page } = await abrirSessaoMercurio();
  const catalogoUniao = new Map<string, string>();
  try {
    const frameInicial = await abrirCirculoDeAmigos(page, filialLabelRegex);
    const amigos = await listarAtivosResumo(frameInicial);
    console.log(`Círculo de Amigos encontrados no Mercúrio: ${amigos.length}`);
    if (amigos.length === 0) return;

    const membrosPorMatricula = new Map((await db.member.findMany({ where: { mercurioId: { not: null } } })).map((m) => [m.mercurioId!, m]));
    const placeholdersPorNome = new Map(
      (await db.member.findMany({ where: { schoolId: school.id, mercurioId: null } })).map((m) => [m.name.trim().toUpperCase(), m]),
    );

    let processados = 0;
    for (const [i, amigo] of amigos.entries()) {
      try {
        const frameLista = i === 0 ? frameInicial : await reabrirCirculoDeAmigos(page);
        const frameFicha = await abrirFichaDaListaAtivos(page, frameLista, new RegExp(escapeRegex(amigo.nome), "i"));
        const dados = await lerAbaEnderecos(frameFicha);
        const pessoais = await lerAbaPessoais(frameFicha);
        const identificacao = await lerAbaIdentificacao(frameFicha);
        const { street, number, complement } = parseLogradouro(dados.logradouro);

        const dadosComuns = {
          schoolId: school.id,
          name: dados.nomeCompleto || amigo.nome,
          whatsapp: `${dados.celularDdd}${dados.celularNumero}` || "",
          whatsappAlt: dados.alternativoDdd && dados.alternativoNumero ? `${dados.alternativoDdd}${dados.alternativoNumero}` : null,
          email: dados.email || null,
          addressStreet: street || null,
          addressNumber: number || null,
          addressComplement: complement || null,
          addressNeighborhood: dados.bairro || null,
          addressCity: dados.cidade || null,
          addressState: dados.uf || null,
          addressZip: dados.cep || null,
          birthDate: diaMesAnoParaData(pessoais.nascimentoDia, pessoais.nascimentoMes, pessoais.nascimentoAno),
          naturalidade: pessoais.naturalidade || null,
          profession: pessoais.profissao || null,
          estadoCivil: pessoais.estadoCivil || null,
          escolaridade: pessoais.escolaridade || null,
          rgNumero: identificacao.rgNumero || null,
          rgOrgaoEmissor: identificacao.rgOrgaoEmissor || null,
          rgDataEmissao: diaMesAnoParaData(identificacao.rgEmissaoDia, identificacao.rgEmissaoMes, identificacao.rgEmissaoAno),
          mercurioId: dados.matricula,
          registrationNo: dados.matricula,
        };

        // status real vem de sync-monthly-status.ts (roda depois, olha a
        // ficha de contribuição de verdade) — "isento" aqui era suposição
        // errada (bug real encontrado: Adanaielly tinha mês pago em
        // setembro, não é isenta), então o default agora é o mesmo "em_dia"
        // de qualquer Member novo.
        const existente = membrosPorMatricula.get(dados.matricula) ?? placeholdersPorNome.get(amigo.nome.trim().toUpperCase());
        const member = existente
          ? await db.member.update({ where: { id: existente.id }, data: dadosComuns })
          : await db.member.create({ data: dadosComuns });
        console.log(`✓ ${member.name} (matrícula ${dados.matricula})${existente ? " — atualizado" : " — criado"}`);

        const frameComposicao = await abrirComposicao(page, frameFicha, dados.matricula);
        const [itens, disponiveis] = await Promise.all([lerComposicao(frameComposicao), lerCatalogoItensDisponiveis(frameComposicao)]);
        for (const item of itens) catalogoUniao.set(item.mercurioGroupId, item.label);
        for (const disponivel of disponiveis) catalogoUniao.set(disponivel.value, disponivel.label);

        const gruposAtuais = new Set(itens.map((it) => it.mercurioGroupId));
        await db.$transaction([
          ...itens.map((item) =>
            db.contributionCompositionItem.upsert({
              where: { memberId_mercurioGroupId: { memberId: member.id, mercurioGroupId: item.mercurioGroupId } },
              update: { label: item.label, amount: item.amount },
              create: { memberId: member.id, mercurioGroupId: item.mercurioGroupId, label: item.label, amount: item.amount },
            }),
          ),
          db.contributionCompositionItem.deleteMany({ where: { memberId: member.id, mercurioGroupId: { notIn: [...gruposAtuais] } } }),
        ]);

        processados++;
      } catch (e) {
        console.error(`✗ Falha em "${amigo.nome}" (matrícula ${amigo.matricula}):`, (e as Error).message);
      }
    }

    const agora = new Date();
    for (const [mercurioGroupId, label] of catalogoUniao) {
      await db.schoolCompositionCatalogItem.upsert({
        where: { schoolId_mercurioGroupId: { schoolId: school.id, mercurioGroupId } },
        update: { label, syncedAt: agora },
        create: { schoolId: school.id, mercurioGroupId, label, syncedAt: agora },
      });
    }

    console.log(`\n✅ Círculo de Amigos: ${processados}/${amigos.length} processados.`);
  } finally {
    await browser.close();
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("ERRO:", e);
    await db.$disconnect();
    process.exit(1);
  });
