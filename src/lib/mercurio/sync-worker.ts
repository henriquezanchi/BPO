import { db } from "@/lib/db";
import type { MercurioContactChanges, MercurioWriteResult } from "./adapter";
import { abrirSessaoMercurio, lerRubricasDePagamentoHoje, RodadaEmAndamentoError } from "./browser-session";
import { mercurioAdapter } from "./index";

// Datas não são um tipo JSON válido — mesma serialização usada em
// enqueueMercurioPersonalUpdate (sync-queue.ts), desserializada de volta aqui.
type MercurioPersonalChangesJson = {
  birthDate?: string | null;
  rgDataEmissao?: string | null;
  [key: string]: unknown;
};

/**
 * ⚠️ ESTE ARQUIVO SÓ PODE SER IMPORTADO PELO WORKER (scripts/process-mercurio-queue.ts),
 * NUNCA por código que roda no site (src/app, src/components, src/lib/actions) —
 * importa mercurioAdapter/browser-session, que carregam o pacote "playwright"
 * inteiro. Rodando no Vercel (serverless, sem Chromium empacotado), qualquer
 * Server Action que importe isso (mesmo sem chamar nada daqui) quebra com
 * "Cannot find module .../playwright-core/browsers.json" — bug real
 * encontrado ao vivo em 2026-09-21. Separado de propósito de sync-queue.ts,
 * que só tem as funções `enqueue*` (db.create puro, sem Playwright) e É
 * seguro de importar do site.
 *
 * Processa tarefas pendentes da fila, escrevendo de verdade no Mercúrio
 * (mercurioAdapter é o real quando as credenciais estão configuradas — ver
 * mercurio/index.ts).
 */
export async function processMercurioSyncQueue(limit = 20) {
  const pending = await db.mercurioSyncTask.findMany({
    where: { status: "pendente" },
    include: { member: { include: { school: true } } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const task of pending) {
    const { member } = task;
    if (!member.mercurioId || !member.school.mercurioFilialLabel) {
      results.push(
        await db.mercurioSyncTask.update({
          where: { id: task.id },
          data: {
            status: "falhou",
            attempts: { increment: 1 },
            lastError: !member.mercurioId
              ? "Membro sem mercurioId (matrícula) vinculado — não sabemos qual cadastro atualizar no Mercúrio."
              : "Escola sem mercurioFilialLabel configurado — não sabemos qual filial navegar no Mercúrio.",
          },
        }),
      );
      continue;
    }

    const identidade = { matricula: member.mercurioId, name: member.name, filialLabel: member.school.mercurioFilialLabel };

    // Tudo dentro de 1 try/catch: chamadas de leitura do adapter (pullComposition,
    // fetchReceiptContent) lançam em vez de devolver { ok: false } — sem isso,
    // uma RodadaEmAndamentoError nelas quebraria o loop inteiro (e as tarefas de
    // OUTROS membros que ainda nem tinham sido processadas nesta chamada).
    let result: MercurioWriteResult;
    try {
      if (task.taskType === "atualizar_dados_pessoais") {
        const payload = task.payload as MercurioPersonalChangesJson;
        result = await mercurioAdapter.pushPersonalUpdate(identidade, {
          ...payload,
          birthDate: payload.birthDate === undefined ? undefined : payload.birthDate ? new Date(payload.birthDate) : null,
          rgDataEmissao: payload.rgDataEmissao === undefined ? undefined : payload.rgDataEmissao ? new Date(payload.rgDataEmissao) : null,
        });
      } else if (task.taskType === "incluir_item_composicao") {
        const payload = task.payload as { mercurioGroupId: string; label: string; valor?: number };
        result = await mercurioAdapter.addCompositionItem(identidade, payload.mercurioGroupId);
        if (result.ok && payload.valor !== undefined) {
          // Inclui com o valor padrão do Mercúrio primeiro, depois ajusta pro
          // valor que o membro escolheu no Portal (mesma chamada de escrita
          // já usada por editar_valor_item_composicao) — best-effort: se essa
          // 2ª chamada falhar, o item fica incluído mesmo assim, só com o
          // valor padrão em vez do escolhido (relido abaixo de qualquer jeito).
          await mercurioAdapter.editCompositionItemValue(identidade, payload.mercurioGroupId, payload.valor.toFixed(2).replace(".", ","));
        }
        if (result.ok) {
          const { items } = await mercurioAdapter.pullComposition(identidade);
          const incluido = items.find((i) => i.mercurioGroupId === payload.mercurioGroupId);
          await db.contributionCompositionItem.upsert({
            where: { memberId_mercurioGroupId: { memberId: task.memberId, mercurioGroupId: payload.mercurioGroupId } },
            update: { label: incluido?.label ?? payload.label, amount: incluido?.amount ?? 0, addedViaPortal: true },
            create: {
              memberId: task.memberId,
              mercurioGroupId: payload.mercurioGroupId,
              label: incluido?.label ?? payload.label,
              amount: incluido?.amount ?? 0,
              addedViaPortal: true,
            },
          });
        }
      } else if (task.taskType === "excluir_item_composicao") {
        const payload = task.payload as { mercurioGroupId: string };
        result = await mercurioAdapter.removeCompositionItem(identidade, payload.mercurioGroupId);
        if (result.ok) {
          await db.contributionCompositionItem.deleteMany({ where: { memberId: task.memberId, mercurioGroupId: payload.mercurioGroupId } });
        }
      } else if (task.taskType === "editar_valor_item_composicao") {
        const payload = task.payload as { mercurioGroupId: string; novoValor: number };
        const valorBR = payload.novoValor.toFixed(2).replace(".", ",");
        result = await mercurioAdapter.editCompositionItemValue(identidade, payload.mercurioGroupId, valorBR);
        if (result.ok) {
          await db.contributionCompositionItem.update({
            where: { memberId_mercurioGroupId: { memberId: task.memberId, mercurioGroupId: payload.mercurioGroupId } },
            data: { amount: payload.novoValor },
          });
        }
      } else if (task.taskType === "atualizar_anotacoes_economicas") {
        const payload = task.payload as { texto: string };
        result = await mercurioAdapter.pushEconomicNotes(identidade, payload.texto);
        if (result.ok) {
          await db.member.update({ where: { id: task.memberId }, data: { economicNotesSyncedAt: new Date() } });
        }
      } else if (task.taskType === "buscar_recibo") {
        const payload = task.payload as { mercurioRecId: string };
        const conteudo = await mercurioAdapter.fetchReceiptContent(identidade, payload.mercurioRecId);
        await db.contributionReceipt.updateMany({
          where: { mercurioRecId: payload.mercurioRecId },
          data: { rawText: conteudo.rawText, canceled: conteudo.canceled, fetchedAt: new Date() },
        });
        result = { ok: true };
      } else if (task.taskType === "lancar_contribuicao_paga") {
        const payload = task.payload as { chargeId: string };
        if (!member.school.mercurioCaixaLancamento) {
          // Não é falha DEFINITIVA nem retryable (não é trava de
          // concorrência) — mas também não dá pra lançar "no escuro" sem
          // saber o caixa certo. Marca falhou com uma mensagem clara em vez
          // de tentar adivinhar um caixa e arriscar lançar no lugar errado.
          result = { ok: false, error: `Escola sem mercurioCaixaLancamento configurado — lançamento automático desligado (ver scripts/list-cashiers.ts).` };
        } else {
          const charge = await db.paymentCharge.findUniqueOrThrow({ where: { id: payload.chargeId } });
          // Data real (com hora), não "pura" como Fundação/dueDate — usa o
          // fuso do Brasil de propósito (não UTC), já que é isso que decide
          // se ainda vale o desconto de pontualidade lá dentro do Mercúrio.
          const dataBR = (charge.paidAt ?? new Date()).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
          result = await mercurioAdapter.launchContributionPayment(identidade, member.school.mercurioCaixaLancamento, {
            amount: Number(charge.amount),
            paidAtBR: dataBR,
          });
        }
      } else {
        result = await mercurioAdapter.pushContactUpdate(identidade, task.payload as MercurioContactChanges);
      }
    } catch (e) {
      result = { ok: false, error: (e as Error).message, retryable: e instanceof RodadaEmAndamentoError };
    }

    // `retryable` = falhou só por trava de concorrência (rodada agendada do
    // scraper em andamento), não por erro real — mantém "pendente" (sem
    // marcar "falhou") pra ser retentada na próxima vez que a fila for
    // processada, em vez de virar um erro definitivo pro membro.
    results.push(
      await db.mercurioSyncTask.update({
        where: { id: task.id },
        data: result.ok
          ? { status: "sincronizado", syncedAt: new Date(), attempts: { increment: 1 } }
          : result.retryable
            ? { attempts: { increment: 1 }, lastError: result.error ?? "Trava de concorrência ativa — retentando em breve." }
            : { status: "falhou", attempts: { increment: 1 }, lastError: result.error ?? "Erro desconhecido" },
      }),
    );
  }

  return results;
}

/** Processa pedidos pendentes de sincronização das Rubricas de Pagamento (School.rubricaSyncRequestedAt). */
export async function processSchoolRubricaSyncRequests() {
  const escolas = await db.school.findMany({ where: { rubricaSyncRequestedAt: { not: null } } });
  const resultados: { schoolId: string; ok: boolean; error?: string }[] = [];

  for (const school of escolas) {
    try {
      if (!school.mercurioFilialLabel || !school.mercurioCaixaLancamento) {
        throw new Error("Escola sem mercurioFilialLabel/mercurioCaixaLancamento configurado.");
      }
      const { browser, page } = await abrirSessaoMercurio();
      let rubricas;
      try {
        rubricas = await lerRubricasDePagamentoHoje(page, new RegExp(school.mercurioFilialLabel, "i"), school.mercurioCaixaLancamento);
      } finally {
        await browser.close();
      }
      for (const r of rubricas) {
        await db.schoolPaymentRubrica.upsert({
          where: { schoolId_mercurioRubricaId: { schoolId: school.id, mercurioRubricaId: r.mercurioRubricaId } },
          update: { label: r.label, syncedAt: new Date() },
          create: { schoolId: school.id, mercurioRubricaId: r.mercurioRubricaId, label: r.label },
        });
      }
      await db.school.update({ where: { id: school.id }, data: { rubricaSyncRequestedAt: null } });
      resultados.push({ schoolId: school.id, ok: true });
    } catch (e) {
      // Best-effort — deixa rubricaSyncRequestedAt setado pra tentar de novo
      // no próximo ciclo do worker (10min depois), em vez de perder o pedido.
      resultados.push({ schoolId: school.id, ok: false, error: (e as Error).message });
    }
  }

  return resultados;
}
