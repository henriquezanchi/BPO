import { db } from "@/lib/db";
import { gerarResumoFilial } from "./resumo-filial";
import { gerarResumoProfissoes, type ResumoProfissoes } from "./resumo-profissoes";

/**
 * Atualização contínua dos resumos do Mercúrio para a Visão geral (pedido do usuário 2026-10-25: "Todas as
 * filiais" com a OINAB-N inteira). A cada rodada atualiza os resumos mais antigos, poucos por vez, para caber
 * no tempo de uma função da Vercel: profissões (nacional), as filiais abertas no Portal (ResumoFilial) e as
 * demais unidades do Mercúrio (ResumoNacional "unidade:<id>"). Só lê o Mercúrio; não altera cadastro nem pagamentos.
 */
const VALIDADE_MS = 20 * 60 * 60 * 1000;

export async function atualizarResumos(limite = 4) {
  const [profissoes, escolas, filiais, outras] = await Promise.all([
    db.resumoNacional.findUnique({ where: { chave: "profissoes" } }),
    db.school.findMany({ where: { mercurioUnidade: { not: null } }, select: { id: true, mercurioUnidade: true } }),
    db.resumoFilial.findMany({ select: { schoolId: true, geradoEm: true } }),
    db.resumoNacional.findMany({ where: { chave: { startsWith: "unidade:" } }, select: { chave: true, geradoEm: true } }),
  ]);
  const agora = Date.now();
  const unidades = (profissoes?.dados as unknown as ResumoProfissoes | undefined)?.unidades ?? [];
  const daEscola = new Map(escolas.map((e) => [e.mercurioUnidade!, e.id]));
  const idadeFilial = new Map(filiais.map((f) => [f.schoolId, f.geradoEm.getTime()]));
  const idadeOutra = new Map(outras.map((o) => [o.chave.slice("unidade:".length), o.geradoEm.getTime()]));

  type Tarefa = { nome: string; geradoEm: number; rodar: () => Promise<unknown> };
  const tarefas: Tarefa[] = [{ nome: "profissões", geradoEm: profissoes?.geradoEm.getTime() ?? 0, rodar: () => gerarResumoProfissoes() }];
  for (const [uni, schoolId] of daEscola) tarefas.push({ nome: uni, geradoEm: idadeFilial.get(schoolId) ?? 0, rodar: () => gerarResumoFilial(uni, schoolId) });
  for (const u of unidades) {
    if (daEscola.has(u.id)) continue;
    tarefas.push({ nome: u.id, geradoEm: idadeOutra.get(u.id) ?? 0, rodar: () => gerarResumoFilial(u.id, null, { nome: u.nome, cidade: u.cidade, uf: u.uf }) });
  }

  const vencidas = tarefas.filter((t) => agora - t.geradoEm > VALIDADE_MS).sort((a, b) => a.geradoEm - b.geradoEm);
  const feitas: string[] = [];
  const falhas: string[] = [];
  for (const t of vencidas.slice(0, limite)) {
    try {
      await t.rodar();
      feitas.push(t.nome);
    } catch (e) {
      falhas.push(`${t.nome}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { feitas, falhas, faltam: Math.max(0, vencidas.length - limite), total: tarefas.length };
}
