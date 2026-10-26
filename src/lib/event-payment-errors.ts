export class EventEnrollmentError extends Error {}
/** Nunca repassar corpo do gateway: pode conter CPF, nomes ou dados de autenticação. */
export function eventPaymentFailure(error:unknown) {
 const message=error instanceof Error?error.message:'';
 const status=Number(message.match(/-> HTTP (\d{3})/)?.[1])||null;
 if(message.includes('falta ligar a conta Asaas da filial')||message.includes('não cobre os custos de processamento'))return {code:'conta_filial',status,message};
 if(message.includes('ASAAS_API_KEY não configurado'))return {code:'gateway_nao_configurado',status,message:'O pagamento on-line ainda não foi configurado. A administração precisa configurar o Asaas antes de liberar o PIX.'};
 if(status===401||status===403)return {code:'gateway_sem_autorizacao',status,message:'O serviço de pagamentos não autorizou a operação. A administração precisa conferir a credencial e as permissões do Asaas.'};
 if(status===429)return {code:'limite_gateway',status,message:'O serviço de pagamentos está ocupado. Aguarde alguns instantes antes de tentar novamente.'};
 if(status===400||status===422)return {code:'dados_rejeitados',status,message:'O serviço de pagamentos recusou os dados da solicitação. Confira o CPF; se estiver correto, peça à Economia para verificar a configuração da cobrança.'};
 return {code:'gateway_indisponivel',status,message:'Não foi possível falar com o serviço de pagamentos. Tente novamente em alguns instantes.'};
}
