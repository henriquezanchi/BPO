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

/**
 * Implementação usada quando as credenciais do Mercúrio (MERCURIO_SUPABASE_URL
 * etc., ver .env.example) não estão configuradas — dev local sem acesso ao
 * scraper, CI, etc. Não deve ser usada em produção: apenas loga a intenção
 * e retorna sucesso/vazio, pra que o resto do fluxo (fila de sync, server
 * actions, UI) continue testável sem depender do Mercúrio real.
 */
export class MockMercurioAdapter implements MercurioAdapter {
  async getClasses(schoolMercurioId: string): Promise<MercurioClass[]> {
    console.warn(`[MockMercurioAdapter] getClasses(${schoolMercurioId}) — sem integração real ainda, retornando lista vazia.`);
    return [];
  }

  async getClassRoster(mercurioClassId: string): Promise<MercurioRosterEntry[]> {
    console.warn(`[MockMercurioAdapter] getClassRoster(${mercurioClassId}) — sem integração real ainda, retornando lista vazia.`);
    return [];
  }

  async pullContactData(member: MercurioMemberIdentity): Promise<MercurioContactData> {
    console.warn(`[MockMercurioAdapter] pullContactData(${member.matricula}) — credenciais do Mercúrio não configuradas, devolvendo vazio.`);
    return {
      whatsapp: "",
      whatsappAlt: "",
      email: "",
      addressStreet: "",
      addressNumber: "",
      addressComplement: "",
      addressNeighborhood: "",
      addressCity: "",
      addressState: "",
      addressZip: "",
    };
  }

  async pushContactUpdate(member: MercurioMemberIdentity, changes: MercurioContactChanges): Promise<MercurioWriteResult> {
    console.warn(`[MockMercurioAdapter] pushContactUpdate(${member.matricula}) — simulado, nada foi escrito no Mercúrio de verdade.`, changes);
    return { ok: true };
  }

  async pullPersonalData(member: MercurioMemberIdentity): Promise<MercurioPersonalData> {
    console.warn(`[MockMercurioAdapter] pullPersonalData(${member.matricula}) — credenciais do Mercúrio não configuradas, devolvendo vazio.`);
    return {
      birthDate: null,
      naturalidade: "",
      profession: "",
      estadoCivil: "",
      escolaridade: "",
      rgNumero: "",
      rgOrgaoEmissor: "",
      rgDataEmissao: null,
    };
  }

  async pushPersonalUpdate(member: MercurioMemberIdentity, changes: MercurioPersonalChanges): Promise<MercurioWriteResult> {
    console.warn(`[MockMercurioAdapter] pushPersonalUpdate(${member.matricula}) — simulado, nada foi escrito no Mercúrio de verdade.`, changes);
    return { ok: true };
  }

  async pullComposition(member: MercurioMemberIdentity): Promise<MercurioComposition> {
    console.warn(`[MockMercurioAdapter] pullComposition(${member.matricula}) — credenciais do Mercúrio não configuradas, devolvendo vazio.`);
    return { items: [], availableToAdd: [] };
  }

  async addCompositionItem(member: MercurioMemberIdentity, mercurioGroupId: string): Promise<MercurioWriteResult> {
    console.warn(`[MockMercurioAdapter] addCompositionItem(${member.matricula}, ${mercurioGroupId}) — simulado.`);
    return { ok: true };
  }

  async removeCompositionItem(member: MercurioMemberIdentity, mercurioGroupId: string): Promise<MercurioWriteResult> {
    console.warn(`[MockMercurioAdapter] removeCompositionItem(${member.matricula}, ${mercurioGroupId}) — simulado.`);
    return { ok: true };
  }
}
