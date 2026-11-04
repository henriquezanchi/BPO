import { db } from "@/lib/db";
import { notificarErroSuporte } from "@/lib/error-notify";
import type { MercurioContactChanges, MercurioPersonalChanges, MercurioWriteResult } from "@/lib/mercurio/adapter";
import { RodadaEmAndamentoError } from "@/lib/mercurio/browser-session";
import { mercurioAdapter } from "@/lib/mercurio";
import { espelhoLigado } from "./rodar";
import type { TipoRobo } from "./tipos";

/**
 * ⚠️ Só para a rotina da fila (/api/cron/fila-mercurio), como sync-worker.ts: importa o Playwright.
 *
 * Grava no Mercúrio ANTIGO os itens do espelho que alguém aprovou (ou que o modo "automatico" aprovou). Usa sempre o
 * robô do antigo (mercurioAdapter), nunca adapterParaEscola: a escola espelhada está marcada como "mercury", e o
 * destino aqui é justamente o antigo. Falha definitiva vira "erro" e o item continua na tela com o passo a passo
 * manual (manual.ts).
 */
export async function aplicarEspelhoAprovado(limite = 2) {
  if (!espelhoLigado()) return [];
  const itens = await db.espelhoMercuryItem.findMany({
    where: { status: "aprovado", school: { espelhoMercury: { modo: { in: ["aprovacao", "automatico"] } } } },
    include: { school: true },
    orderBy: { createdAt: "asc" },
    take: limite,
  });

  const resultados = [];
  for (const item of itens) {
    const robo = item.robo as { tipo: TipoRobo; payload: Record<string, unknown> } | null;
    let r: MercurioWriteResult;
    try {
      if (!robo) throw new Error("Item sem ação do robô: só pode ser feito à mão.");
      if (!item.matricula || !item.school.mercurioFilialLabel) throw new Error("Item sem matrícula ou escola sem mercurioFilialLabel.");
      r = await executar(robo, { matricula: item.matricula, name: item.nome ?? "", filialLabel: item.school.mercurioFilialLabel }, item.school.mercurioCaixaLancamento);
    } catch (e) {
      r = { ok: false, error: (e as Error).message, retryable: e instanceof RodadaEmAndamentoError };
    }

    const atualizado = await db.espelhoMercuryItem.update({
      where: { id: item.id },
      data: r.ok
        ? { status: "feito_robo", feitoEm: new Date(), tentativas: { increment: 1 }, ultimoErro: null }
        : r.retryable
          ? { tentativas: { increment: 1 }, ultimoErro: r.error ?? "Robô ocupado; tenta de novo na próxima volta." }
          : { status: "erro", tentativas: { increment: 1 }, ultimoErro: (r.error ?? "Erro desconhecido").slice(0, 500) },
    });
    if (!r.ok && !r.retryable) {
      await notificarErroSuporte({ message: `Espelho Mercury: falha ao gravar "${item.resumo}" (${item.nome ?? item.matricula}) no Mercúrio antigo: ${r.error ?? "erro desconhecido"}. Fazer à mão.`, path: "aplicarEspelhoAprovado" });
    }
    resultados.push(atualizado);
  }
  return resultados;
}

async function executar(robo: { tipo: TipoRobo; payload: Record<string, unknown> }, id: { matricula: string; name: string; filialLabel: string }, caixa: string | null): Promise<MercurioWriteResult> {
  const p = robo.payload;
  switch (robo.tipo) {
    case "contato":
      return mercurioAdapter.pushContactUpdate(id, p as MercurioContactChanges);
    case "pessoais": {
      const { birthDate, ...resto } = p as Record<string, string>;
      const mudancas: MercurioPersonalChanges = { ...resto, ...(birthDate ? { birthDate: new Date(`${birthDate}T12:00:00Z`) } : {}) };
      return mercurioAdapter.pushPersonalUpdate(id, mudancas);
    }
    case "incluir_composicao": {
      const incluido = await mercurioAdapter.addCompositionItem(id, String(p.grupo));
      // O item entra com o valor padrão do catálogo; acerta para o valor do novo.
      return incluido.ok ? mercurioAdapter.editCompositionItemValue(id, String(p.grupo), String(p.valor)) : incluido;
    }
    case "excluir_composicao":
      return mercurioAdapter.removeCompositionItem(id, String(p.grupo));
    case "editar_composicao":
      return mercurioAdapter.editCompositionItemValue(id, String(p.grupo), String(p.valor));
    case "contribuicao": {
      if (!caixa) return { ok: false, error: "Escola sem mercurioCaixaLancamento: não sei em que caixa lançar." };
      const dia = String(p.pagoEm).split("-").reverse().join("/");
      // Lança no caixa do DIA DO PAGAMENTO; se o antigo já fechou esse dia, o robô recusa e o item vai para a secretaria.
      return mercurioAdapter.launchContributionPayment(id, caixa, { referenceYear: Number(p.ano), referenceMonth: Number(p.mes), amount: Number(p.valor), paidAtBR: dia, diaDoCaixaBR: dia });
    }
  }
}
