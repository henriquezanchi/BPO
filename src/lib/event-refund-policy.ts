import type { AsaasPayment } from "@/lib/asaas/client";
export const REFUND_LABELS: Record<string,string> = {
 nao_solicitado:"Não solicitado",pendente:"Aguardando processamento",processando:"Processando",acompanhando:"Aguardando confirmação do Asaas",revisao:"Pedido enviado; aguardando conciliação",erro:"Pendência no Asaas",reembolsado:"Reembolsado",sem_pagamento:"Sem pagamento a devolver",cobranca_cancelada:"Cobrança não paga cancelada",
};
export function refundPosition(payment: AsaasPayment) {
 const refunds=payment.refunds??[];
 const cents=(n:number)=>Math.round(n*100);
 if(!Number.isFinite(payment.value)||payment.value<=0||refunds.some(r=>!Number.isFinite(r.value)||r.value<0))throw Error("Valor do Asaas inválido.");
 const done=refunds.filter(r=>r.status==='DONE').reduce((sum,r)=>sum+cents(r.value),0);
 const total=cents(payment.value);
 if(done>total)throw Error("Estornos superiores à cobrança.");
 const pending=refunds.some(r=>!['DONE','CANCELLED'].includes(r.status));
 const splitPending=refunds.some(r=>r.status==='DONE'&&r.refundedSplits?.some(s=>!s.done));
 return {done:done/100,remaining:(total-done)/100,complete:done===total,pending,splitPending};
}
export function refundErrorMessage(error:unknown) {
 const code=(error as {code?:string})?.code;
 if(code==='payment_mismatch')return 'A cobrança no Asaas diverge desta inscrição. Confira a identificação e o valor antes de devolver.';
 if(code==='refund_mismatch')return 'O histórico do Asaas diverge da devolução já conferida. Os valores anteriores foram preservados para conciliação.';
 const status=(error as {status?:number})?.status;
 if(status===400)return "Asaas recusou a devolução. Confira saldo disponível e condições da cobrança; haverá nova tentativa automática.";
 if(status===401||status===403)return "Asaas não autorizou a operação. Confira a credencial e a permissão de estorno.";
 return "Não foi possível confirmar a operação no Asaas. A conciliação automática continuará antes de qualquer nova devolução.";
}
