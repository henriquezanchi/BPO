/**
 * Contrato de integração com o Mercúrio.
 *
 * O Mercúrio não tem API oficial — a leitura/escrita real é feita por
 * automação de navegador (RPA), implementada em playwright-adapter.ts
 * (reaproveitando login/navegação validados em scraper/mercurio.js, repo
 * crm-agencia-na). Esta interface isola o resto do app dessa decisão:
 * MockMercurioAdapter (dev, sem credenciais configuradas) e
 * PlaywrightMercurioAdapter (real) são intercambiáveis — ver
 * mercurio-adapter-instance.ts.
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

/** Identifica um membro de forma suficiente pra navegar até a ficha dele no Mercúrio. */
export interface MercurioMemberIdentity {
  matricula: string; // Member.mercurioId
  name: string; // usado pra achar a linha certa na lista de Ativos da filial
  filialLabel: string; // School.mercurioFilialLabel — regex-matchável contra o label do link CADASTRO
}

export interface MercurioContactChanges {
  whatsapp?: string;
  whatsappAlt?: string;
  email?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
}

export interface MercurioContactData {
  whatsapp: string;
  whatsappAlt: string;
  email: string;
  // Mercúrio não separa rua/número/complemento — vem tudo junto num
  // "Logradouro" só. addressStreet aqui carrega o texto completo desse
  // campo; separar em rua/número/complemento de verdade exigiria heurística
  // de parsing (fora de escopo por ora — quem edita pelo Portal já grava
  // estruturado daí em diante).
  addressStreet: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
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

  /** Lê os dados de contato/endereço reais direto da ficha do aluno no Mercúrio. */
  pullContactData(member: MercurioMemberIdentity): Promise<MercurioContactData>;

  /** Envia uma atualização de contato para o Mercúrio. */
  pushContactUpdate(member: MercurioMemberIdentity, changes: MercurioContactChanges): Promise<MercurioWriteResult>;
}
