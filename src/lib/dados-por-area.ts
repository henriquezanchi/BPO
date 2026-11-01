import "server-only";
import type { DirectorDashboard } from "@/lib/director-data";

/**
 * Cada área recebe só o que a tela dela usa (01/11/2026). Antes Eventos, Café e Escolástica recebiam o painel inteiro
 * da Direção e, mesmo sem mostrar, o navegador levava WhatsApp, situação de pagamento, negociações e anotações da
 * Economia, rascunhos de cobrança e despesas de todos os membros da filial.
 */
type Membro = DirectorDashboard["membros"][number];

export type DadosEventos = Pick<DirectorDashboard, "eventos" | "receptionCandidates" | "eventPaymentConfigured"> & { membros: Pick<Membro, "id" | "name" | "mercurioAtivo">[] };
export type DadosCafe = Pick<DirectorDashboard, "fortunaNaoVinculados" | "fortunaTransacoes" | "recargasFortunaPendentes">;
export type DadosEscolastica = { membros: Pick<Membro, "id" | "name" | "mercurioAtivo" | "registrationNo" | "whatsapp">[] };

export const paraEventos = (d: DirectorDashboard): DadosEventos => ({
  eventos: d.eventos,
  receptionCandidates: d.receptionCandidates,
  eventPaymentConfigured: d.eventPaymentConfigured,
  membros: d.membros.map((m) => ({ id: m.id, name: m.name, mercurioAtivo: m.mercurioAtivo })),
});

export const paraCafe = (d: DirectorDashboard): DadosCafe => ({
  fortunaNaoVinculados: d.fortunaNaoVinculados,
  fortunaTransacoes: d.fortunaTransacoes,
  recargasFortunaPendentes: d.recargasFortunaPendentes,
});

export const paraEscolastica = (d: DirectorDashboard): DadosEscolastica => ({
  membros: d.membros.map((m) => ({ id: m.id, name: m.name, mercurioAtivo: m.mercurioAtivo, registrationNo: m.registrationNo, whatsapp: m.whatsapp })),
});
