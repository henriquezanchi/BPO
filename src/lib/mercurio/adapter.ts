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
  // Mercúrio guarda rua+número+complemento como 1 campo de texto livre só
  // ("Logradouro") — já vem separado aqui via heurística best-effort (ver
  // parse-logradouro.ts). Endereços por quadra/lote ou fora do padrão
  // comum caem inteiros em addressStreet, com number/complement vazios.
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
}

// "Mais Dados" (abas PESSOAIS + IDENTIFICAÇÃO). estadoCivil/escolaridade
// usam os CÓDIGOS do Mercúrio (ver personal-data-options.ts), não texto.
export interface MercurioPersonalChanges {
  birthDate?: Date | null;
  naturalidade?: string;
  profession?: string;
  estadoCivil?: string;
  escolaridade?: string;
  rgNumero?: string;
  rgOrgaoEmissor?: string;
  rgDataEmissao?: Date | null;
}

export interface MercurioPersonalData {
  birthDate: Date | null;
  naturalidade: string;
  profession: string;
  estadoCivil: string;
  escolaridade: string;
  rgNumero: string;
  rgOrgaoEmissor: string;
  rgDataEmissao: Date | null;
}

// "Minha Contribuição" (tesoura/tes_conedit.php). Cada item vem com o
// mercurioGroupId ("grp" na URL de lá) — precisa pra editar/excluir depois.
export interface MercurioCompositionItem {
  mercurioGroupId: string;
  label: string;
  amount: number;
}

/** Um tipo de item ainda não presente na composição do aluno, disponível pra incluir. */
export interface MercurioCatalogItem {
  value: string;
  label: string;
}

export interface MercurioComposition {
  items: MercurioCompositionItem[];
  availableToAdd: MercurioCatalogItem[];
}

export interface MercurioReceiptContent {
  rawText: string;
  canceled: boolean;
}

export interface MercurioWriteResult {
  ok: boolean;
  error?: string;
  /** true = falhou por trava de concorrência (RodadaEmAndamentoError), não por erro real — vale tentar de novo depois, não é falha definitiva. */
  retryable?: boolean;
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

  /** Lê RG/nascimento/profissão/naturalidade/escolaridade/estado civil ("Mais Dados"). */
  pullPersonalData(member: MercurioMemberIdentity): Promise<MercurioPersonalData>;

  /** Envia uma atualização de "Mais Dados" para o Mercúrio. */
  pushPersonalUpdate(member: MercurioMemberIdentity, changes: MercurioPersonalChanges): Promise<MercurioWriteResult>;

  /** Lê a composição das contribuições (itens + catálogo do que ainda pode ser incluído). */
  pullComposition(member: MercurioMemberIdentity): Promise<MercurioComposition>;

  /** Inclui um item da composição pelo código do catálogo (MercurioCatalogItem.value). */
  addCompositionItem(member: MercurioMemberIdentity, mercurioGroupId: string): Promise<MercurioWriteResult>;

  /** Remove um item da composição pelo mercurioGroupId. */
  removeCompositionItem(member: MercurioMemberIdentity, mercurioGroupId: string): Promise<MercurioWriteResult>;

  /** Busca o conteúdo (documento) de um recibo específico pelo id — 1 chamada cara, sob demanda. */
  fetchReceiptContent(member: MercurioMemberIdentity, mercurioRecId: string): Promise<MercurioReceiptContent>;
}
