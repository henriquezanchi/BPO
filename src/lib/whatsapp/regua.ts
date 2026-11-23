import { db } from "@/lib/db";
import { recebeOnline } from "@/lib/conta-provisoria";
import { configCobranca } from "@/lib/spread";
import { enviarWhatsappFinanceiro, whatsappFinanceiroAtivo } from "@/lib/whatsapp/financeiro";
import { mesPorExtenso, nomeCurtoDaFilial, primeiroNome, reais, type NomeModelo } from "@/lib/whatsapp/modelos";

/**
 * Régua automática de avisos de contribuição pelo WhatsApp (pedido do usuário em 23/11/2026). Substitui, nas filiais
 * que recebem pelo Portal, a fila manual da Economia (charging-actions.ts, que continua existindo):
 *  - dia 7: "vence em breve" para quem ainda não pagou o mês;
 *  - dia 10: "vence hoje" (último dia do desconto) para quem ainda não pagou o mês;
 *  - dia 20: "em aberto" para quem tem mês em atraso.
 * Só sai com o WhatsApp oficial configurado (WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_TOKEN) E WHATSAPP_REGUA=ligada.
 * Cada aviso tem referência única por pessoa e mês: nunca sai duas vezes. Teto diário (WHATSAPP_REGUA_TETO, padrão
 * 100) para proteger a qualidade do número; o que passar do teto sai nos dias seguintes enquanto a régua for válida.
 * Por rodada (a rotina financeira roda a cada 10 minutos), no máximo 40 envios, entre 9h e 20h de Brasília.
 */
const POR_RODADA = 40;
const DIAS: Record<number, NomeModelo> = { 7: "na_contribuicao_vence_em_breve", 10: "na_contribuicao_vence_hoje", 20: "na_contribuicao_em_aberto" };

export const reguaLigada = () => whatsappFinanceiroAtivo() && process.env.WHATSAPP_REGUA === "ligada";

/** Modelo do dia: o do dia exato, ou o mais recente ainda válido (atraso no envio por causa do teto). */
function modeloDoDia(dia: number): { modelo: NomeModelo; diaRegua: number } | null {
  if (dia >= 20) return { modelo: DIAS[20], diaRegua: 20 };
  if (dia === 10) return { modelo: DIAS[10], diaRegua: 10 };
  if (dia >= 7 && dia < 10) return { modelo: DIAS[7], diaRegua: 7 };
  return null;
}

export async function reguaAutomatica(agora = new Date()) {
  if (!reguaLigada()) return { ligada: false };
  const sp = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  if (sp.getHours() < 9 || sp.getHours() >= 20) return { ligada: true, horario: false };
  const hoje = modeloDoDia(sp.getDate());
  if (!hoje) return { ligada: true, dia: false };

  const ano = sp.getFullYear();
  const mes = sp.getMonth() + 1;
  const ciclo = `${ano}-${String(mes).padStart(2, "0")}`;
  const inicioDoDia = new Date(agora.getTime() - ((sp.getHours() * 60 + sp.getMinutes()) * 60 + sp.getSeconds()) * 1000);
  const teto = Number(process.env.WHATSAPP_REGUA_TETO ?? 100);
  const jaHoje = await db.whatsappEnvio.count({ where: { referencia: { startsWith: "auto:" }, createdAt: { gte: inicioDoDia }, status: { not: "repetida" } } });
  let vagas = Math.min(POR_RODADA, teto - jaHoje);
  if (vagas <= 0) return { ligada: true, teto: true };

  const { escopo } = await configCobranca();
  const escolas = await db.school.findMany({ where: { mercurioUnidade: { in: escopo } }, select: { id: true, name: true } });
  let enviados = 0;
  for (const escola of escolas) {
    if (vagas <= 0) break;
    if (!(await recebeOnline(escola.id))) continue;
    const filial = nomeCurtoDaFilial(escola.name);
    const emAtraso = hoje.modelo === "na_contribuicao_em_aberto";
    const membros = await db.member.findMany({
      where: { schoolId: escola.id, mercurioAtivo: true, ...(emAtraso ? { monthlyStatus: { some: { status: "atrasado" } } } : { NOT: { monthlyStatus: { some: { year: ano, month: mes, status: { in: ["paga", "isento"] } } } } }) },
      select: { id: true, name: true, whatsapp: true, compositionItems: { select: { amount: true } }, monthlyStatus: { where: { status: "atrasado" }, select: { id: true } } },
    });
    const ja = new Set((await db.whatsappEnvio.findMany({ where: { schoolId: escola.id, referencia: { startsWith: `auto:${hoje.modelo}:` } }, select: { referencia: true } })).map((e) => e.referencia));
    for (const m of membros) {
      if (vagas <= 0) break;
      const referencia = `auto:${hoje.modelo}:${m.id}:${ciclo}`;
      if (ja.has(referencia)) continue;
      const valor = m.compositionItems.reduce((s, i) => s + Number(i.amount), 0);
      const meses = m.monthlyStatus.length;
      if (valor <= 0 || (emAtraso && meses === 0)) continue;
      const nome = primeiroNome(m.name);
      const mesTexto = mesPorExtenso(ano, mes);
      const parametros =
        hoje.modelo === "na_contribuicao_vence_em_breve"
          ? [nome, mesTexto, filial, reais(valor), `10/${String(mes).padStart(2, "0")}/${ano}`]
          : hoje.modelo === "na_contribuicao_vence_hoje"
            ? [nome, mesTexto, filial, reais(valor)]
            : [nome, filial, meses === 1 ? "1 mês" : `${meses} meses`, reais(valor * meses)];
      const r = await enviarWhatsappFinanceiro({ schoolId: escola.id, memberId: m.id, telefone: m.whatsapp, modelo: hoje.modelo, parametros, referencia });
      if (r.status !== "repetida") vagas--;
      if (r.status === "enviada") enviados++;
    }
  }
  return { ligada: true, modelo: hoje.modelo, enviados };
}
