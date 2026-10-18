export interface ContributionPeriod { year: number; month: number }
export interface MonthlyLedger extends ContributionPeriod { status: string }
export interface ChargeLedger { referenceYear: number; referenceMonth: number; status: string }
export function periodNumber(period: ContributionPeriod) { return period.year * 12 + period.month; }
export function validatePeriod(year: number, month: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error("Mês de contribuição inválido.");
}
/** Não inventa dívidas para meses sem registro. Pagamento confirmado vence a defasagem da sincronização. */
export function oldestOpenContribution(monthly: MonthlyLedger[], charges: ChargeLedger[]): ContributionPeriod | null {
  const resolved = new Set(monthly.filter(item=>item.status==="paga"||item.status==="isento").map(periodNumber));
  charges.filter(item=>item.status==="pago").forEach(item=>resolved.add(periodNumber({year:item.referenceYear,month:item.referenceMonth})));
  const open = [...monthly.filter(item=>item.status==="atrasado"||item.status==="em_branco").map(({year,month})=>({year,month})),...charges.filter(item=>item.status==="pendente").map(item=>({year:item.referenceYear,month:item.referenceMonth}))];
  return open.filter(item=>!resolved.has(periodNumber(item))).sort((a,b)=>periodNumber(a)-periodNumber(b))[0]??null;
}
export function assertContributionOrder(target: ContributionPeriod, monthly: MonthlyLedger[], charges: ChargeLedger[]) {
  validatePeriod(target.year,target.month);
  const paid=monthly.some(item=>periodNumber(item)===periodNumber(target)&&["paga","isento"].includes(item.status))||charges.some(item=>item.referenceYear===target.year&&item.referenceMonth===target.month&&item.status==="pago");
  if(paid)throw new Error("Este mês já está pago ou isento. Não é necessário gerar outra cobrança.");
  const first=oldestOpenContribution(monthly,charges);
  if(first&&periodNumber(first)<periodNumber(target))throw new Error(`Regularize primeiro a contribuição de ${String(first.month).padStart(2,"0")}/${first.year}. Não é permitido pagar meses posteriores com contribuições anteriores em aberto.`);
}
export function assertMercurioReference(oldest: string, reference: ContributionPeriod) {
  validatePeriod(reference.year,reference.month);
  const expected=`${String(reference.month).padStart(2,"0")}/${reference.year}`;
  if(oldest!==expected)throw new Error(`A ficha pendente mais antiga no Mercúrio é ${oldest}, mas o pagamento corresponde a ${expected}. Lançamento bloqueado para conferência humana.`);
}
