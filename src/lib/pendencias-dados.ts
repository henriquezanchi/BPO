import { oldestOpenContribution } from "@/lib/contribution-order";
import { db } from "@/lib/db";
import { pendenciaVencida } from "@/lib/pendencias-comum";

/**
 * Leitura das pendências da Tesouraria do Mercúrio já guardadas no Portal (26/11/2026). Separado do leitor com o robô
 * (lib/mercurio/pendencias-mercurio.ts) porque aquele importa o Playwright: importado pela página do Portal, a Vercel
 * tentava carregar o navegador e a página falhava ("Cannot find module playwright-core/browsers.json").
 */
/**
 * Pendências da Tesouraria do Mercúrio (26/11/2026, pedido do usuário): "Tesouraria → Cadastro → Pendentes"
 * (tesoura/tes_penlst.php) é onde a escola registra o que o aluno deve além da contribuição (lanchonete, multa da
 * biblioteca, negociação de dívida antiga, produtos). A pendência sai no recibo junto com a contribuição e some da
 * lista quando é paga. A tela não tem matrícula: só nome, vencimento (MM/AAAA), rubrica + descrição, valor e
 * responsável, e o id interno no link de exclusão (pen=NNN). Mapeado ao vivo em 26/11/2026, só leitura.
 *
 * Guardado em ResumoNacional "pendencias-mercurio:<UNI>" (sem tabela nova); o membro é casado pelo nome
 * normalizado dentro da filial. Nada é gravado no Mercúrio.
 */
export interface PendenciaMercurio {
  id: string; // pen=NNN do Mercúrio
  nome: string;
  vencimento: string; // "MM/AAAA"
  rubrica: string;
  descricao: string;
  valor: number;
  responsavel: string;
}

export interface PendenciasFilial {
  lidoEm: string;
  itens: PendenciaMercurio[];
}

export const CHAVE = (uni: string) => `pendencias-mercurio:${uni}`;

export const normalizarNome = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Pendências em aberto de uma pessoa (casadas pelo nome dentro da filial). */
export async function pendenciasDoMembro(member: { name: string; school: { mercurioUnidade: string | null } }): Promise<{ lidoEm: string | null; itens: PendenciaMercurio[] }> {
  if (!member.school.mercurioUnidade) return { lidoEm: null, itens: [] };
  const linha = await db.resumoNacional.findUnique({ where: { chave: CHAVE(member.school.mercurioUnidade) } });
  const dados = linha?.dados as PendenciasFilial | undefined;
  if (!dados?.itens?.length) return { lidoEm: dados?.lidoEm ?? null, itens: [] };
  const alvo = normalizarNome(member.name);
  return { lidoEm: dados.lidoEm, itens: dados.itens.filter((p) => normalizarNome(p.nome) === alvo) };
}

/**
 * Pendências que entram na cobrança da contribuição de (year, month) pelo Portal (26/11/2026, "construir o caminho"):
 * mapeado ao vivo na tela do recibo (tes_universal7.php): "CONTRIBUIÇÃO E ACERTOS PENDENTES" lista as pendências vencidas
 * SEM caixa de marcação e o Mercúrio as inclui sozinho no primeiro recibo emitido. Então elas só podem ser pagas junto
 * com o mês mais antigo em aberto, e o valor cobrado pelo Portal precisa somá-las, senão o robô encontra um total maior
 * que o pago e o lançamento cai na fila de exceção.
 */
export async function pendenciasNaCobranca(
  member: { id: string; name: string; school: { mercurioUnidade: string | null } },
  year: number,
  month: number,
): Promise<PendenciaMercurio[]> {
  const { itens } = await pendenciasDoMembro(member);
  const vencidas = itens.filter((p) => pendenciaVencida(p));
  if (!vencidas.length) return [];
  const [monthly, charges] = await Promise.all([
    db.contributionMonthlyStatus.findMany({ where: { memberId: member.id }, select: { year: true, month: true, status: true } }),
    db.paymentCharge.findMany({ where: { memberId: member.id }, select: { referenceYear: true, referenceMonth: true, status: true } }),
  ]);
  const maisAntigo = oldestOpenContribution(monthly, charges);
  // Sem mês em aberto conhecido, o mês pedido é o primeiro recibo: as pendências entram nele.
  if (maisAntigo && (maisAntigo.year !== year || maisAntigo.month !== month)) return [];
  return vencidas;
}
