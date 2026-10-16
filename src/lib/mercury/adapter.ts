import type {
  MercurioAdapter,
  MercurioClass,
  MercurioComposition,
  MercurioContactData,
  MercurioMemberIdentity,
  MercurioPersonalData,
  MercurioReceiptContent,
  MercurioRosterEntry,
  MercurioWriteResult,
} from "@/lib/mercurio/adapter";
import { mercuryGetClasses, mercuryGetContributionPlan, mercuryGetDossier, mercuryGetReceipts } from "./client";

/**
 * Implementação da mesma interface do Mercúrio antigo (MercurioAdapter),
 * mas pela API do Mercúrio novo ("Mercury") — escolhida por escola via
 * School.sistemaRegistro (ver adapterParaEscola em mercurio/index.ts).
 *
 * Escrita ainda NÃO implementada: o Gabriel disse em 2026-10-16 que a API
 * já aceita lançamentos, mas não recebemos a documentação das rotas. Até
 * lá, toda escrita volta `retryable: true` — a tarefa fica pendente na
 * fila (nada se perde) em vez de virar falha definitiva.
 *
 * Diferenças de cobertura em relação ao RPA (limitação da API, não daqui):
 * sem endereço estruturado (só cidade/UF), sem órgão emissor/data do RG,
 * sem catálogo do que pode ser incluído na composição.
 */
const ESCRITA_PENDENTE: MercurioWriteResult = {
  ok: false,
  retryable: true,
  error: "Escrita via Mercury ainda não implementada — aguardando documentação das rotas de escrita.",
};

function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export class MercuryAdapter implements MercurioAdapter {
  async getClasses(branchId: string): Promise<MercurioClass[]> {
    const turmas = await mercuryGetClasses({ branchId });
    return turmas.map((t) => ({ mercurioClassId: t.id, name: t.name }));
  }

  async getClassRoster(mercurioClassId: string): Promise<MercurioRosterEntry[]> {
    // Sem rota por id de turma — lista as turmas e filtra.
    const turma = (await mercuryGetClasses({})).find((t) => t.id === mercurioClassId);
    if (!turma) return [];
    return [
      ...turma.instructors.map((p) => ({ mercurioMemberId: p.registrationNo, name: p.fullName, whatsapp: "", role: "professor" as const })),
      ...turma.students.map((p) => ({ mercurioMemberId: p.registrationNo, name: p.fullName, whatsapp: "", role: "aluno" as const })),
    ];
  }

  async pullContactData(member: MercurioMemberIdentity): Promise<MercurioContactData> {
    const d = await mercuryGetDossier(member.matricula);
    return {
      whatsapp: soDigitos(d.phones.primary),
      whatsappAlt: soDigitos(d.phones.alternate),
      email: d.email ?? "",
      addressStreet: "",
      addressNumber: "",
      addressComplement: "",
      addressNeighborhood: "",
      addressCity: d.city ?? "",
      addressState: d.state ?? "",
      addressZip: "",
    };
  }

  async pullPersonalData(member: MercurioMemberIdentity): Promise<MercurioPersonalData> {
    const d = await mercuryGetDossier(member.matricula);
    return {
      birthDate: d.birthDate ? new Date(d.birthDate) : null,
      naturalidade: d.placeOfBirth ?? "",
      profession: d.profession ?? "",
      estadoCivil: d.maritalStatus ?? "",
      escolaridade: d.educationLevel ?? "",
      rgNumero: d.documents.find((doc) => doc.type === "RG")?.number ?? "",
      rgOrgaoEmissor: "",
      rgDataEmissao: null,
    };
  }

  async pullComposition(member: MercurioMemberIdentity): Promise<MercurioComposition> {
    const { plan } = await mercuryGetContributionPlan(member.matricula);
    return {
      items: (plan?.components ?? []).map((c) => ({
        // Sem id estável por item na API — label serve de chave até a Mercury expor um.
        mercurioGroupId: `mercury:${c.label}`,
        label: c.label,
        amount: Number(c.value),
      })),
      availableToAdd: [],
    };
  }

  async fetchReceiptContent(member: MercurioMemberIdentity, mercurioRecId: string): Promise<MercurioReceiptContent> {
    const recibo = (await mercuryGetReceipts(member.matricula)).find((r) => r.id === mercurioRecId || r.number === mercurioRecId);
    if (!recibo) throw new Error(`Recibo ${mercurioRecId} não encontrado na Mercury pra matrícula ${member.matricula}.`);
    const [ano, mes, dia] = recibo.date.split("-");
    const rawText = [
      `RECIBO Nº ${recibo.number}`,
      `Data: ${dia}/${mes}/${ano}`,
      `Matrícula: ${member.matricula} — ${member.name}`,
      recibo.description ? `Referente a: ${recibo.description}` : null,
      `Valor: R$ ${recibo.amount.replace(".", ",")}`,
    ]
      .filter(Boolean)
      .join("\n");
    return { rawText, canceled: recibo.receiptActive === false };
  }

  async pushContactUpdate(): Promise<MercurioWriteResult> {
    return ESCRITA_PENDENTE;
  }
  async pushPersonalUpdate(): Promise<MercurioWriteResult> {
    return ESCRITA_PENDENTE;
  }
  async addCompositionItem(): Promise<MercurioWriteResult> {
    return ESCRITA_PENDENTE;
  }
  async removeCompositionItem(): Promise<MercurioWriteResult> {
    return ESCRITA_PENDENTE;
  }
  async editCompositionItemValue(): Promise<MercurioWriteResult> {
    return ESCRITA_PENDENTE;
  }
  async pushEconomicNotes(): Promise<MercurioWriteResult> {
    return ESCRITA_PENDENTE;
  }
  async launchContributionPayment(): Promise<MercurioWriteResult> {
    return ESCRITA_PENDENTE;
  }
}
