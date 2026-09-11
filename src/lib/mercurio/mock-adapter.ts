import type {
  MercurioAdapter,
  MercurioClass,
  MercurioContactChanges,
  MercurioRosterEntry,
  MercurioWriteResult,
} from "./adapter";

/**
 * Implementação provisória enquanto não definimos o transporte real com o
 * Mercúrio. Não deve ser usada em produção: apenas loga a intenção de
 * escrita e retorna sucesso, para que o resto do fluxo (fila de sync,
 * server actions, UI) possa ser desenvolvido e testado desde já.
 */
export class MockMercurioAdapter implements MercurioAdapter {
  async getClasses(schoolMercurioId: string): Promise<MercurioClass[]> {
    console.warn(
      `[MockMercurioAdapter] getClasses(${schoolMercurioId}) — sem integração real ainda, retornando lista vazia.`,
    );
    return [];
  }

  async getClassRoster(mercurioClassId: string): Promise<MercurioRosterEntry[]> {
    console.warn(
      `[MockMercurioAdapter] getClassRoster(${mercurioClassId}) — sem integração real ainda, retornando lista vazia.`,
    );
    return [];
  }

  async pushContactUpdate(
    mercurioMemberId: string,
    changes: MercurioContactChanges,
  ): Promise<MercurioWriteResult> {
    console.warn(
      `[MockMercurioAdapter] pushContactUpdate(${mercurioMemberId}) — simulado, nada foi escrito no Mercúrio de verdade.`,
      changes,
    );
    return { ok: true };
  }
}

export const mercurioAdapter = new MockMercurioAdapter();
