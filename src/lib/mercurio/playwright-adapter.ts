import type {
  MercurioAdapter,
  MercurioClass,
  MercurioContactChanges,
  MercurioContactData,
  MercurioMemberIdentity,
  MercurioRosterEntry,
  MercurioWriteResult,
} from "./adapter";
import { abrirFichaEmEnderecos, abrirSessaoMercurio, lerAbaEnderecos, escreverAbaEnderecos } from "./browser-session";

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
      return {
        whatsapp: dados.celularDdd && dados.celularNumero ? `${dados.celularDdd}${dados.celularNumero}` : "",
        whatsappAlt: dados.alternativoDdd && dados.alternativoNumero ? `${dados.alternativoDdd}${dados.alternativoNumero}` : "",
        email: dados.email,
        addressStreet: dados.logradouro,
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
}

/** "62991729783" -> ["62", "991729783"]. undefined se não vier número. */
function splitDddNumero(telefone: string | undefined): [string | undefined, string | undefined] {
  if (telefone === undefined) return [undefined, undefined];
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length <= 2) return [digitos, ""];
  return [digitos.slice(0, 2), digitos.slice(2)];
}
