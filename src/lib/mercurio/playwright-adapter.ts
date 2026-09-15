import type {
  MercurioAdapter,
  MercurioClass,
  MercurioComposition,
  MercurioContactChanges,
  MercurioContactData,
  MercurioMemberIdentity,
  MercurioPersonalChanges,
  MercurioPersonalData,
  MercurioRosterEntry,
  MercurioWriteResult,
} from "./adapter";
import {
  abrirComposicao,
  abrirFichaDaListaAtivos,
  abrirListaAtivos,
  abrirSessaoMercurio,
  escreverAbaEnderecos,
  escreverAbaIdentificacao,
  escreverAbaPessoais,
  excluirItemComposicao,
  incluirItemComposicao,
  lerAbaEnderecos,
  lerAbaIdentificacao,
  lerAbaPessoais,
  lerCatalogoItensDisponiveis,
  lerComposicao,
} from "./browser-session";
import { parseLogradouro } from "./parse-logradouro";
import type { Page } from "playwright";

async function abrirFichaEmEnderecos(page: Page, filialLabelRegex: RegExp, nomeRegex: RegExp) {
  const frameAtivos = await abrirListaAtivos(page, filialLabelRegex);
  return abrirFichaDaListaAtivos(page, frameAtivos, nomeRegex);
}

/**
 * Implementação REAL — loga no Mercúrio de verdade via Playwright.
 *
 * getClasses/getClassRoster ainda não implementados (a navegação até
 * Turmas foi mapeada em scraper/mercurio.js mas não portada pra cá ainda —
 * o Portal por ora só precisa de leitura/escrita de contato). Chamá-los
 * lança erro explícito em vez de devolver lista vazia silenciosamente.
 */
export class PlaywrightMercurioAdapter implements MercurioAdapter {
  async getClasses(schoolMercurioId: string): Promise<MercurioClass[]> {
    throw new Error(`PlaywrightMercurioAdapter.getClasses ainda não implementado (schoolMercurioId=${schoolMercurioId}).`);
  }

  async getClassRoster(mercurioClassId: string): Promise<MercurioRosterEntry[]> {
    throw new Error(`PlaywrightMercurioAdapter.getClassRoster ainda não implementado (mercurioClassId=${mercurioClassId}).`);
  }

  async pullContactData(member: MercurioMemberIdentity): Promise<MercurioContactData> {
    const { browser, page } = await abrirSessaoMercurio();
    try {
      const frame = await abrirFichaEmEnderecos(page, new RegExp(member.filialLabel, "i"), new RegExp(member.name, "i"));
      const dados = await lerAbaEnderecos(frame);
      const { street, number, complement } = parseLogradouro(dados.logradouro);
      return {
        whatsapp: dados.celularDdd && dados.celularNumero ? `${dados.celularDdd}${dados.celularNumero}` : "",
        whatsappAlt: dados.alternativoDdd && dados.alternativoNumero ? `${dados.alternativoDdd}${dados.alternativoNumero}` : "",
        email: dados.email,
        addressStreet: street,
        addressNumber: number,
        addressComplement: complement,
        addressNeighborhood: dados.bairro,
        addressCity: dados.cidade,
        addressState: dados.uf,
        addressZip: dados.cep,
      };
    } finally {
      await browser.close();
    }
  }

  async pushContactUpdate(member: MercurioMemberIdentity, changes: MercurioContactChanges): Promise<MercurioWriteResult> {
    try {
      const { browser, page } = await abrirSessaoMercurio();
      try {
        const frame = await abrirFichaEmEnderecos(page, new RegExp(member.filialLabel, "i"), new RegExp(member.name, "i"));

        // Mercúrio só tem 1 campo de Logradouro (rua+número+complemento
        // juntos) — compõe só se pelo menos um dos 3 veio na mudança, pra
        // não sobrescrever com string vazia quando só telefone/e-mail
        // mudou.
        const logradouro =
          changes.addressStreet !== undefined || changes.addressNumber !== undefined || changes.addressComplement !== undefined
            ? [changes.addressStreet, changes.addressNumber && `, ${changes.addressNumber}`, changes.addressComplement && ` - ${changes.addressComplement}`]
                .filter(Boolean)
                .join("")
            : undefined;

        const [celularDdd, celularNumero] = splitDddNumero(changes.whatsapp);
        const [altDdd, altNumero] = splitDddNumero(changes.whatsappAlt);

        await escreverAbaEnderecos(frame, {
          logradouro,
          bairro: changes.addressNeighborhood,
          cidade: changes.addressCity,
          uf: changes.addressState,
          cep: changes.addressZip,
          email: changes.email,
          celularDdd,
          celularNumero,
          alternativoDdd: altDdd,
          alternativoNumero: altNumero,
        });
        return { ok: true };
      } finally {
        await browser.close();
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async pullPersonalData(member: MercurioMemberIdentity): Promise<MercurioPersonalData> {
    const { browser, page } = await abrirSessaoMercurio();
    try {
      const frame = await abrirFichaEmEnderecos(page, new RegExp(member.filialLabel, "i"), new RegExp(member.name, "i"));
      const pessoais = await lerAbaPessoais(frame);
      const identificacao = await lerAbaIdentificacao(frame);
      return {
        birthDate: diaMesAnoParaData(pessoais.nascimentoDia, pessoais.nascimentoMes, pessoais.nascimentoAno),
        naturalidade: pessoais.naturalidade,
        profession: pessoais.profissao,
        estadoCivil: pessoais.estadoCivil,
        escolaridade: pessoais.escolaridade,
        rgNumero: identificacao.rgNumero,
        rgOrgaoEmissor: identificacao.rgOrgaoEmissor,
        rgDataEmissao: diaMesAnoParaData(identificacao.rgEmissaoDia, identificacao.rgEmissaoMes, identificacao.rgEmissaoAno),
      };
    } finally {
      await browser.close();
    }
  }

  async pushPersonalUpdate(member: MercurioMemberIdentity, changes: MercurioPersonalChanges): Promise<MercurioWriteResult> {
    try {
      const { browser, page } = await abrirSessaoMercurio();
      try {
        const frame = await abrirFichaEmEnderecos(page, new RegExp(member.filialLabel, "i"), new RegExp(member.name, "i"));

        const pessoaisMudou =
          changes.birthDate !== undefined ||
          changes.naturalidade !== undefined ||
          changes.profession !== undefined ||
          changes.estadoCivil !== undefined ||
          changes.escolaridade !== undefined;
        if (pessoaisMudou) {
          const [nascimentoDia, nascimentoMes, nascimentoAno] = dataParaDiaMesAno(changes.birthDate);
          await escreverAbaPessoais(frame, {
            naturalidade: changes.naturalidade,
            nascimentoDia,
            nascimentoMes,
            nascimentoAno,
            estadoCivil: changes.estadoCivil,
            escolaridade: changes.escolaridade,
            profissao: changes.profession,
          });
        }

        const identificacaoMudou = changes.rgNumero !== undefined || changes.rgOrgaoEmissor !== undefined || changes.rgDataEmissao !== undefined;
        if (identificacaoMudou) {
          const [rgEmissaoDia, rgEmissaoMes, rgEmissaoAno] = dataParaDiaMesAno(changes.rgDataEmissao);
          await escreverAbaIdentificacao(frame, {
            rgNumero: changes.rgNumero,
            rgOrgaoEmissor: changes.rgOrgaoEmissor,
            rgEmissaoDia,
            rgEmissaoMes,
            rgEmissaoAno,
          });
        }

        return { ok: true };
      } finally {
        await browser.close();
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async pullComposition(member: MercurioMemberIdentity): Promise<MercurioComposition> {
    const { browser, page } = await abrirSessaoMercurio();
    try {
      const frameFicha = await abrirFichaEmEnderecos(page, new RegExp(member.filialLabel, "i"), new RegExp(member.name, "i"));
      const frame = await abrirComposicao(page, frameFicha, member.matricula);
      const [items, availableToAdd] = await Promise.all([lerComposicao(frame), lerCatalogoItensDisponiveis(frame)]);
      return { items, availableToAdd };
    } finally {
      await browser.close();
    }
  }

  async addCompositionItem(member: MercurioMemberIdentity, mercurioGroupId: string): Promise<MercurioWriteResult> {
    try {
      const { browser, page } = await abrirSessaoMercurio();
      try {
        const frameFicha = await abrirFichaEmEnderecos(page, new RegExp(member.filialLabel, "i"), new RegExp(member.name, "i"));
        const frame = await abrirComposicao(page, frameFicha, member.matricula);
        await incluirItemComposicao(frame, mercurioGroupId);
        return { ok: true };
      } finally {
        await browser.close();
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async removeCompositionItem(member: MercurioMemberIdentity, mercurioGroupId: string): Promise<MercurioWriteResult> {
    try {
      const { browser, page } = await abrirSessaoMercurio();
      try {
        const frameFicha = await abrirFichaEmEnderecos(page, new RegExp(member.filialLabel, "i"), new RegExp(member.name, "i"));
        const frame = await abrirComposicao(page, frameFicha, member.matricula);
        await excluirItemComposicao(frame, member.matricula, mercurioGroupId);
        return { ok: true };
      } finally {
        await browser.close();
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}

/**
 * "00"/"00"/"0000" é o jeito do Mercúrio dizer "data não preenchida" — não
 * é uma data válida. Devolve null nesse caso.
 */
function diaMesAnoParaData(dia: string, mes: string, ano: string): Date | null {
  const d = parseInt(dia, 10);
  const m = parseInt(mes, 10);
  const a = parseInt(ano, 10);
  if (!d || !m || !a) return null;
  return new Date(Date.UTC(a, m - 1, d));
}

/**
 * undefined = campo não mudou (não escreve nada nessa data). null = usuário
 * quer limpar a data (grava "00/00/0000", o sentinel do Mercúrio). Date =
 * grava normalmente.
 */
function dataParaDiaMesAno(data: Date | null | undefined): [string | undefined, string | undefined, string | undefined] {
  if (data === undefined) return [undefined, undefined, undefined];
  if (data === null) return ["00", "00", "0000"];
  return [
    String(data.getUTCDate()).padStart(2, "0"),
    String(data.getUTCMonth() + 1).padStart(2, "0"),
    String(data.getUTCFullYear()).padStart(4, "0"),
  ];
}

/** "62991729783" -> ["62", "991729783"]. undefined se não vier número. */
function splitDddNumero(telefone: string | undefined): [string | undefined, string | undefined] {
  if (telefone === undefined) return [undefined, undefined];
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length <= 2) return [digitos, ""];
  return [digitos.slice(0, 2), digitos.slice(2)];
}
