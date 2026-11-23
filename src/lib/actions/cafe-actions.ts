"use server";

import { areasNaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { FortunaErro, fortunaCancelarVenda, fortunaGetClient, fortunaProdutosDoCaixa, fortunaVender, type FortunaVendaResultado } from "@/lib/fortuna/client";
import { alunoDaSessao, aparelhoAtual, ativarAparelho, buscarAlunos, confirmarAluno, desligarAparelho } from "@/lib/quiosque";
import { revalidatePath } from "next/cache";

/**
 * Autoatendimento na lanchonete (23/11/2026): a pessoa lê o QR do caixa, escolhe os produtos no Portal e paga com o
 * próprio saldo do Fortuna; ela mesma pega o produto. O Fortuna recalcula preço, confere saldo e estoque e debita uma vez
 * (Idempotency-Key). O Portal guarda as últimas compras de cada pessoa (ResumoNacional "cafe:compras:<memberId>") só para
 * permitir o cancelamento dentro da janela e mostrar o comprovante; nada de cartão ou senha passa por aqui.
 */
const chaveCompras = (memberId: string) => `cafe:compras:${memberId}`;
type CompraGuardada = { invoiceId: number; em: string; total: string; caixa: string };

function mensagem(e: unknown) {
  if (e instanceof FortunaErro) {
    if (e.status === 402) return "Saldo insuficiente nesta lanchonete. Recarregue pelo Portal e tente de novo.";
    if (e.status === 409) return /estoque/i.test(e.message) ? (e.message.split(" - ").pop() ?? "Produto sem estoque.") : "Algum produto não está mais disponível. Atualize a tela.";
    if (e.status === 404 || e.status === 403) return "O autoatendimento ainda não está liberado neste caixa.";
  }
  return "Não deu para concluir a compra agora. Nada foi cobrado; tente de novo.";
}

type Compra = { ok: true; venda: FortunaVendaResultado } | { ok: false; error: string };

export async function comprarNoCafe(cashierId: number, itens: { productId: number; amount: number }[], chave: string): Promise<Compra> {
  const eu = await getAuthenticatedMember();
  if (!eu || !eu.mercurioAtivo) return { ok: false, error: "Entre no Portal de novo." };
  if (!eu.fortunaClientId) return { ok: false, error: "Sua conta ainda não está ligada ao Fortuna. Fale com a secretaria." };
  return vender({ id: eu.id, fortunaClientId: eu.fortunaClientId }, cashierId, itens, chave);
}

/** Núcleo da compra (celular e quiosque): valida o pedido, vende no Fortuna e guarda para o comprovante e o cancelamento. */
async function vender(eu: { id: string; fortunaClientId: number }, cashierId: number, itens: { productId: number; amount: number }[], chave: string): Promise<Compra> {
  const lista = (Array.isArray(itens) ? itens : []).filter((i) => Number.isInteger(i.productId) && Number.isInteger(i.amount) && i.amount > 0);
  if (!lista.length) return { ok: false, error: "Escolha ao menos um produto." };
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(chave)) return { ok: false, error: "Pedido inválido. Atualize a tela." };
  try {
    // A chave leva a pessoa: duas pessoas nunca colidem, e o mesmo toque repetido não cobra duas vezes.
    const venda = await fortunaVender(eu.fortunaClientId, cashierId, lista, `portal-cafe-${eu.id}-${chave}`.slice(0, 128));
    const linha = await db.resumoNacional.findUnique({ where: { chave: chaveCompras(eu.id) } });
    const anteriores = ((linha?.dados as { compras?: CompraGuardada[] } | null)?.compras ?? []).filter((c) => c.invoiceId !== venda.invoiceId);
    const compras = [{ invoiceId: venda.invoiceId, em: venda.saleDate, total: venda.total, caixa: venda.cashier.title }, ...anteriores].slice(0, 20);
    await db.resumoNacional.upsert({ where: { chave: chaveCompras(eu.id) }, update: { dados: { compras }, geradoEm: new Date() }, create: { chave: chaveCompras(eu.id), dados: { compras } } });
    return { ok: true, venda };
  } catch (e) {
    console.error("Autoatendimento: compra recusada:", (e as Error).message);
    return { ok: false, error: mensagem(e) };
  }
}

/** Cancela uma compra da própria pessoa, dentro da janela do Fortuna (10 min): o saldo volta. */
export async function cancelarCompraCafe(invoiceId: number): Promise<{ ok: boolean; error?: string }> {
  const eu = await getAuthenticatedMember();
  if (!eu) return { ok: false, error: "Entre no Portal de novo." };
  return cancelar(eu.id, invoiceId);
}

async function cancelar(memberId: string, invoiceId: number): Promise<{ ok: boolean; error?: string }> {
  const eu = { id: memberId };
  const linha = await db.resumoNacional.findUnique({ where: { chave: chaveCompras(eu.id) } });
  const minha = ((linha?.dados as { compras?: CompraGuardada[] } | null)?.compras ?? []).some((c) => c.invoiceId === invoiceId);
  if (!minha) return { ok: false, error: "Compra não encontrada." };
  try {
    await fortunaCancelarVenda(invoiceId);
    return { ok: true };
  } catch (e) {
    if (e instanceof FortunaErro && e.status === 409) return { ok: false, error: "O prazo para cancelar acabou. Fale com o responsável pela lanchonete." };
    return { ok: false, error: "Não deu para cancelar agora. Tente de novo." };
  }
}

// ─────────────── Quiosque da lanchonete (23/11/2026; regras em lib/quiosque.ts) ───────────────

/** Área do Café: este navegador passa a ser o quiosque do caixa informado. */
export async function ativarQuiosque(cashierId: number) {
  const eu = await getAuthenticatedMember();
  if (!eu) return { ok: false as const, error: "Entre no Portal de novo." };
  if (!(await areasNaFilial(eu, eu.schoolId)).includes("cafe")) return { ok: false as const, error: "Só a área do Café ativa o quiosque." };
  if (!Number.isInteger(cashierId) || cashierId <= 0) return { ok: false as const, error: "Informe o número do caixa no Fortuna." };
  const caixa = await fortunaProdutosDoCaixa(cashierId).catch(() => null);
  await ativarAparelho({ schoolId: eu.schoolId, cashierId, nome: caixa?.cashier.title ?? `Caixa nº ${cashierId}`, ativadoPor: `${eu.name} (${eu.mercurioId ?? "?"})` });
  return { ok: true as const };
}

export async function desligarQuiosque(id: string) {
  const eu = await getAuthenticatedMember();
  if (!eu || !(await areasNaFilial(eu, eu.schoolId)).includes("cafe")) return { ok: false as const, error: "Só a área do Café desliga o quiosque." };
  await desligarAparelho(eu.schoolId, id);
  revalidatePath("/voluntario/cafe");
  return { ok: true as const };
}

export async function buscarNoQuiosque(texto: string) {
  const a = await aparelhoAtual();
  if (!a) return { ok: false as const, error: "Este aparelho não é mais um quiosque." };
  return { ok: true as const, alunos: await buscarAlunos(a, String(texto ?? "").slice(0, 60)) };
}

export async function confirmarNoQuiosque(ref: string, digitos: string) {
  const a = await aparelhoAtual();
  if (!a) return { ok: false as const, error: "Este aparelho não é mais um quiosque." };
  try {
    const r = await confirmarAluno(a, ref, String(digitos ?? ""));
    const cliente = await fortunaGetClient(r.fortunaClientId).catch(() => null);
    const branchId = await fortunaProdutosDoCaixa(a.cashierId).then((c) => c.cashier.branchId).catch(() => null);
    const saldo = cliente && branchId !== null ? Number(cliente.balance.find((b) => b.branchId === branchId)?.amount ?? 0) : null;
    return { ok: true as const, sessao: r.sessao, nome: r.nome, saldo };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function comprarNoQuiosque(sessao: string, itens: { productId: number; amount: number }[], chave: string): Promise<Compra> {
  const a = await aparelhoAtual();
  if (!a) return { ok: false, error: "Este aparelho não é mais um quiosque." };
  try {
    const m = await alunoDaSessao(a, sessao);
    return vender(m, a.cashierId, itens, chave);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cancelarNoQuiosque(sessao: string, invoiceId: number) {
  const a = await aparelhoAtual();
  if (!a) return { ok: false, error: "Este aparelho não é mais um quiosque." };
  try {
    const m = await alunoDaSessao(a, sessao);
    return cancelar(m.id, invoiceId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
