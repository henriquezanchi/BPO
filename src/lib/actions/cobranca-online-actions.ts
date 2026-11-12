"use server";

import { areasNaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { ehDonoDoSistema } from "@/lib/dono-do-sistema";
import { TIPOS_CHAVE, type TipoChave, chaveDaPropriaEscola, pedirSaque, saldoDaConta, validarChave } from "@/lib/asaas/saque";
import { chavePixDaEscola, definirRepasseCartao, gravarChavePix } from "@/lib/spread";
import { marcarContatoAtendido } from "@/lib/whatsapp/conversa";
import { revalidatePath } from "next/cache";

/** Economia → Cobrança on-line (12/11/2026): a filial escolhe se repassa a taxa do cartão ao aluno. */
export async function escolherRepasseCartao(schoolId: string, repassa: boolean) {
  const eu = await getAuthenticatedMember();
  if (!eu) return { ok: false as const, error: "Entre no Portal de novo." };
  const pode = ehDonoDoSistema(eu) || (await areasNaFilial(eu, schoolId)).includes("economia");
  if (!pode) return { ok: false as const, error: "Só a Economia e a direção da filial mudam esta opção." };
  await definirRepasseCartao(schoolId, !!repassa);
  revalidatePath("/economia");
  return { ok: true as const };
}

/** "Já lancei no Mercúrio": fecha o lançamento automático que parou para conferência humana (lib/problemas-pagamento.ts). */
export async function marcarLancadoAMao(tarefaId: string) {
  const eu = await getAuthenticatedMember();
  if (!eu) return { ok: false as const, error: "Entre no Portal de novo." };
  const tarefa = await db.mercurioSyncTask.findUnique({ where: { id: tarefaId }, select: { status: true, taskType: true, member: { select: { schoolId: true } } } });
  if (!tarefa || tarefa.taskType !== "lancar_contribuicao_paga") return { ok: false as const, error: "Lançamento não encontrado." };
  const pode = ehDonoDoSistema(eu) || (await areasNaFilial(eu, tarefa.member.schoolId)).includes("economia");
  if (!pode) return { ok: false as const, error: "Só a Economia e a direção da filial fazem isso." };
  if (tarefa.status !== "falhou") return { ok: true as const };
  const quando = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await db.mercurioSyncTask.update({
    where: { id: tarefaId },
    data: { status: "sincronizado", syncedAt: new Date(), lastError: `Lançado à mão no Mercúrio por ${eu.name} (matrícula ${eu.mercurioId ?? "?"}) em ${quando}.` },
  });
  revalidatePath("/economia");
  return { ok: true as const };
}

// ─────────────── Saldo e saque (12/11/2026; regras em lib/asaas/saque.ts) ───────────────

async function podeEconomia(schoolId: string) {
  const eu = await getAuthenticatedMember();
  if (!eu) return null;
  return ehDonoDoSistema(eu) || (await areasNaFilial(eu, schoolId)).includes("economia") ? eu : null;
}

export async function cadastrarChavePix(schoolId: string, tipo: TipoChave, chave: string) {
  const eu = await podeEconomia(schoolId);
  if (!eu) return { ok: false as const, error: "Só a Economia e a direção da filial cadastram a chave." };
  if (!(tipo in TIPOS_CHAVE)) return { ok: false as const, error: "Tipo de chave inválido." };
  const v = validarChave(tipo, chave);
  if (!v.ok) return { ok: false as const, error: v.erro };
  const escola = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { cnpj: true } });
  const propria = chaveDaPropriaEscola(tipo, v.chave, escola.cnpj);
  await gravarChavePix(schoolId, { tipo, chave: v.chave, aprovada: propria, cadastradaPor: `${eu.name} (${eu.mercurioId ?? "?"})`, em: new Date().toISOString() });
  revalidatePath("/economia");
  return { ok: true as const, aprovada: propria };
}

export async function aprovarChavePix(schoolId: string) {
  const eu = await getAuthenticatedMember();
  if (!eu || !ehDonoDoSistema(eu)) return { ok: false as const, error: "Só o administrador do Portal aprova chaves que não são o CNPJ da escola." };
  const chave = await chavePixDaEscola(schoolId);
  if (!chave) return { ok: false as const, error: "Nenhuma chave cadastrada." };
  await gravarChavePix(schoolId, { ...chave, aprovada: true, aprovadaPor: `${eu.name} (${eu.mercurioId ?? "?"})` });
  revalidatePath("/economia");
  return { ok: true as const };
}

export async function solicitarSaque(schoolId: string, valor: number) {
  const eu = await podeEconomia(schoolId);
  if (!eu) return { ok: false as const, error: "Só a Economia e a direção da filial pedem saque." };
  const v = Math.round(Number(valor) * 100) / 100;
  if (!(v > 0)) return { ok: false as const, error: "Informe o valor do saque." };
  const escola = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, asaasSubaccountApiKey: true } });
  if (!escola.asaasSubaccountApiKey) return { ok: false as const, error: "A conta Asaas da filial não está ligada ao Portal." };
  const chave = await chavePixDaEscola(schoolId);
  if (!chave) return { ok: false as const, error: "Cadastre antes a chave Pix da escola." };
  if (!chave.aprovada) return { ok: false as const, error: "A chave Pix ainda espera a aprovação do administrador do Portal." };
  const saldo = await saldoDaConta(escola.asaasSubaccountApiKey).catch(() => null);
  if (saldo === null) return { ok: false as const, error: "Não deu para consultar o saldo agora. Tente de novo em alguns minutos." };
  if (v > saldo) return { ok: false as const, error: `O saldo disponível é ${saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.` };
  try {
    await pedirSaque({ schoolId, apiKey: escola.asaasSubaccountApiKey, valor: v, chave, pedidoPor: `${eu.name} (${eu.mercurioId ?? "?"})`, escola: escola.name });
  } catch (e) {
    revalidatePath("/economia");
    return { ok: false as const, error: `O Asaas recusou o saque: ${(e as Error).message.replace(/^Asaas: /, "")}` };
  }
  revalidatePath("/economia");
  return { ok: true as const };
}

/** Pedido de contato vindo do WhatsApp ("Falar com a Economia") já atendido. */
export async function contatoAtendido(schoolId: string, memberId: string) {
  const eu = await podeEconomia(schoolId);
  if (!eu) return { ok: false as const, error: "Só a Economia e a direção da filial fazem isso." };
  await marcarContatoAtendido(schoolId, memberId);
  revalidatePath("/economia");
  return { ok: true as const };
}
