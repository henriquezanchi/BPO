"use server";

import { marcarPresencaEvento } from "@/lib/actions/event-actions";
import { lerCodigoDaCarteirinha } from "@/lib/carteirinha";
import { db } from "@/lib/db";
import { requireEventReception } from "@/lib/event-data";

export type ResultadoLeitura = { ok: boolean; mensagem: string };

/**
 * Recepção lê a carteirinha digital (07/11/2026): confere a assinatura do QR, acha a inscrição da pessoa neste evento e
 * marca a presença pelo mesmo caminho do toque na lista (marcarPresencaEvento: mesmas travas de pagamento e horário).
 */
export async function presencaPorCarteirinha(eventId: string, codigo: string): Promise<ResultadoLeitura> {
  try {
    const { event } = await requireEventReception(eventId);
    const matricula = lerCodigoDaCarteirinha(codigo);
    if (!matricula) return { ok: false, mensagem: "Este QR não é uma carteirinha da Nova Acrópole." };
    const pessoa = await db.member.findFirst({ where: { mercurioId: matricula }, select: { id: true, name: true, mercurioAtivo: true } });
    if (!pessoa) return { ok: false, mensagem: `Matrícula ${matricula} ainda não está no Portal. Procure na lista.` };
    const nome = pessoa.name.split(" ").slice(0, 2).join(" ");
    if (!pessoa.mercurioAtivo) return { ok: false, mensagem: `${nome}: cadastro inativo na escola.` };
    if (event.source === "ulisses") return { ok: false, mensagem: `${nome} (matrícula ${matricula}). Inscrições deste evento estão no Ulisses: marque na lista abaixo.` };
    const inscricao = await db.eventRegistration.findFirst({ where: { eventId, memberId: pessoa.id, desistenciaEm: null }, select: { id: true, checkedIn: true } });
    if (!inscricao) return { ok: false, mensagem: `${nome} não está inscrito(a) neste evento.` };
    if (inscricao.checkedIn) return { ok: true, mensagem: `${nome}: presença já estava conferida.` };
    await marcarPresencaEvento("", inscricao.id, true);
    return { ok: true, mensagem: `Presença de ${nome} conferida.` };
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : "Não foi possível marcar a presença." };
  }
}
