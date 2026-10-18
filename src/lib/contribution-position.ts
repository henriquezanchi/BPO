import { periodNumber, type MonthlyLedger, type ChargeLedger } from "./contribution-order";

/** Só classifica competências registradas; nunca multiplica a composição atual por meses antigos. */
export function contributionPosition(monthly: MonthlyLedger[], charges: ChargeLedger[]) {
  const periods = new Map<number, { year: number; month: number; official: string | null; received: boolean; pending: boolean }>();
  monthly.forEach(row => periods.set(periodNumber(row), { year: row.year, month: row.month, official: row.status, received: false, pending: false }));
  charges.forEach(charge => {
    const ref = {year:charge.referenceYear, month:charge.referenceMonth};
    const key = periodNumber(ref);
    const row = periods.get(key) ?? {...ref, official:null, received:false, pending:false};
    if(charge.status === "pago") row.received = true;
    if(charge.status === "pendente") row.pending = true;
    periods.set(key,row);
  });
  return [...periods.values()].sort((a,b)=>periodNumber(a)-periodNumber(b)).map(row => ({...row,
    open: !row.received && !["paga","isento"].includes(row.official ?? "") && (["atrasado","em_branco"].includes(row.official ?? "") || row.pending),
    overdue: !row.received && row.official === "atrasado",
    label: row.received ? "Recebido pelo Portal" : row.official === "paga" ? "Pago no sistema da escola" : row.official === "isento" ? "Isento" : row.official === "atrasado" ? "Em atraso" : row.pending ? "Aguardando confirmação do pagamento" : "Sem pagamento registrado",
  }));
}
export function paymentReviewStage(status: string, tasks: {status:string}[]) {
  if(status !== "pago") return {key:"aguardando", label:"Aguardando confirmação do pagamento"};
  if(tasks.length > 1) return {key:"conferir", label:"Recebido — conferir mais de uma tarefa de lançamento"};
  if(tasks.some(task=>task.status === "sincronizado")) return {key:"registrado", label:"Lançamento informado pelo sistema"};
  if(tasks.some(task=>task.status === "falhou")) return {key:"conferir", label:"Recebido — lançamento precisa de conferência"};
  if(tasks.length === 0) return {key:"conferir", label:"Recebido — conferir encaminhamento"};
  return {key:"pendente", label:"Recebido — aguardando lançamento"};
}
