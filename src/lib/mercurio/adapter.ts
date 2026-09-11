/**
 * Contrato de integração com o Mercúrio.
 *
 * Ainda não sabemos qual transporte o Mercúrio realmente expõe (API HTTP,
 * acesso direto ao banco, ou apenas a UI web para automação via RPA). Esta
 * interface isola o resto do app dessa decisão: qualquer implementação
 * (MockMercurioAdapter, um futuro RpaMercurioAdapter, ApiMercurioAdapter...)
 * pode ser trocada sem tocar nos server actions que a consomem.
 */
export interface MercurioClass {
  mercurioClassId: string;
  name: string;
}

export interface MercurioRosterEntry {
  mercurioMemberId: string;
  name: string;
  whatsapp: string;
  email?: string;
  role: "aluno" | "professor";
}

export interface MercurioContactChanges {
  whatsapp?: string;
  email?: string;
  address?: string;
}

export interface MercurioWriteResult {
  ok: boolean;
  error?: string;
}

export interface MercurioAdapter {
  /** Lista as turmas de uma escola conforme cadastradas no Mercúrio. */
  getClasses(schoolMercurioId: string): Promise<MercurioClass[]>;

  /** Lista os membros de uma turma e seus papéis (aluno/professor). */
  getClassRoster(mercurioClassId: string): Promise<MercurioRosterEntry[]>;

  /**
   * Envia uma atualização de contato para o Mercúrio.
   * Só existe de fato quando confirmarmos que o Mercúrio aceita escrita
   * (ver nota em sync-queue.ts). Até lá, implementações podem apenas
   * registrar a intenção sem aplicá-la.
   */
  pushContactUpdate(
    mercurioMemberId: string,
    changes: MercurioContactChanges,
  ): Promise<MercurioWriteResult>;
}
