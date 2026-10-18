import {test,mock} from 'node:test';import assert from 'node:assert/strict';
import {eventAudienceWhere,validateInternalEvent,eventNoticePlan} from '../src/lib/event-policy.ts';
const actor={id:'member',schoolId:'school',mercurioAtivo:true,isJanos:false,isMembroPrograma:true,isProvacionista:false,isDiretor:false,isSubChefe:false,name:'Aluno teste',email:null};
let director=true,reception=true,paid=true,wallet='school-wallet',eventStatus='publicado',payCalls=0;
const writes=[];
const event={id:'event',schoolId:'school',source:'manual',revision:0,status:'publicado',startsAt:new Date('2099-01-01T19:00Z'),endsAt:new Date('2099-01-01T21:00Z'),title:'Curso',price:50};
let current={id:'registration',eventId:'event',memberId:'member',paid:false,paymentState:'criando',asaasPaymentId:null,pixPayload:null,amount:50,checkedIn:false};
const tx={event:{updateMany:async()=>({count:1}),findFirstOrThrow:async()=>event},eventRegistration:{upsert:async()=>current,update:async a=>writes.push(a),findMany:async()=>[],count:async()=>0},eventAudit:{create:async a=>writes.push(a)},eventNotice:{createMany:async()=>{},updateMany:async()=>{},upsert:async()=>{}}};
mock.module(new URL('../src/lib/auth.ts',import.meta.url).href,{exports:{requireAuthenticatedMember:async id=>{assert.equal(id,actor.id);return actor;},requireDirector:async()=>{if(!director)throw Error('Sem permissão');return actor;}}});
mock.module(new URL('../src/lib/acesso-voluntario.ts',import.meta.url).href,{exports:{temAcessoVoluntario:async()=>true}});
mock.module(new URL('../src/lib/event-data.ts',import.meta.url).href,{exports:{requireEventReception:async()=>{if(!reception)throw Error('Não designado');return {actor,event};}}});
mock.module(new URL('../src/lib/event-payments.ts',import.meta.url).href,{exports:{confirmEventPayment:async()=>writes.push('paid')}});
mock.module(new URL('../src/lib/db.ts',import.meta.url).href,{exports:{db:{event:{findFirst:async args=>{assert.equal(args.where.schoolId,'school');assert.equal(args.where.source,'manual');assert.deepEqual(args.where.AND[0].audience,{in:['todos_ativos','membros','voluntarios']});return eventStatus==='publicado'?event:null;}},school:{findUniqueOrThrow:async()=>({asaasWalletId:wallet})},eventRegistration:{findUniqueOrThrow:async()=>({...current,paid,event:{...event,status:eventStatus}}),updateMany:async()=>({count:0}),findFirstOrThrow:async()=>({...current,event})},$transaction:async fn=>fn(tx)}}});
mock.module(new URL('../src/lib/asaas/client.ts',import.meta.url).href,{exports:{asaasFindOrCreateCustomer:async()=>{throw Error('unexpected gateway');},asaasCreatePixCharge:async()=>{payCalls++;throw Error('unexpected gateway');},asaasGetPixQrCode:async()=>({payload:'existing-qr',encodedImage:'image'}),asaasGetPaymentStatus:async()=>({status:'PENDING'})}});
mock.module(new URL('../src/lib/asaas/split.ts',import.meta.url).href,{exports:{calcularSplitEscola:async()=>({walletId:wallet,fixedValue:48})}});
mock.module('next/cache',{exports:{revalidatePath:()=>{}}});
const{inscreverEmEvento,marcarPresencaEvento,salvarEvento,excluirEvento}=await import('../src/lib/actions/event-actions.ts');
test('público é explícito e papéis desconhecidos do Ágora ficam bloqueados',()=>{
 const where=eventAudienceWhere({...actor,isMembroPrograma:false},false);
 assert.deepEqual(where.audience,{in:['todos_ativos']});assert.deepEqual(where.source,{not:'agora'});
});
test('datas, público e valor do evento são validados antes de gravar',()=>{
 const data={title:'Curso',startsAt:'2099-01-01T19:00Z',endsAt:'2099-01-01T21:00Z',price:50,audience:'membros',description:'',location:'Escola'};
 assert.equal(validateInternalEvent(data).audience,'membros');
 for(const change of [{price:NaN},{price:1.234},{price:-1},{audience:'qualquer'},{endsAt:data.startsAt},{startsAt:'2020-01-01'}])assert.throws(()=>validateInternalEvent({...data,...change}));
});
test('lembretes respeitam horário e não geram lembrete retroativo',()=>{
 const plan=eventNoticePlan(new Date('2099-01-02T20:00Z'),new Date('2099-01-02T22:00Z'),new Date('2099-01-02T18:00Z'));
 assert.deepEqual(plan.map(n=>n.kind),['inscricao','uma_hora','avaliar_presenca']);assert.equal(plan[1].dueAt.toISOString(),'2099-01-02T19:00:00.000Z');
});
test('inscrição exige perfil permitido e split; não cria cobrança duplicada em processamento',async()=>{
 actor.isJanos=true;await assert.rejects(()=>inscreverEmEvento('member','event','12345678901'),/consulta/);actor.isJanos=false;
 eventStatus='cancelado';await assert.rejects(()=>inscreverEmEvento('member','event','12345678901'),/indisponível/);eventStatus='publicado';
 wallet=null;await assert.rejects(()=>inscreverEmEvento('member','event','12345678901'),/split/);wallet='school-wallet';
 await assert.rejects(()=>inscreverEmEvento('member','event','12345678901'),/conferência/);assert.equal(payCalls,0);
 current={...current,pixPayload:'saved-qr',pixQrCodeBase64:'image'};
 const result=await inscreverEmEvento('member','event','12345678901');assert.equal(result.pixPayload,'saved-qr');assert.equal(payCalls,0);
});
test('recepção exige designação, período de recepção e inscrição paga',async()=>{
 eventStatus='publicado';reception=false;await assert.rejects(()=>marcarPresencaEvento('school','registration',true),/designado/);reception=true;
 await assert.rejects(()=>marcarPresencaEvento('school','registration',true),/duas horas/);
 event.startsAt=new Date(Date.now()-3600000);paid=false;await assert.rejects(()=>marcarPresencaEvento('school','registration',true),/pendente/);paid=true;
 await marcarPresencaEvento('school','registration',true);assert.equal(writes.at(-1).data.action,'presenca_confirmada');assert.equal(writes.at(-2).data.checkedInBy,'member');
});
test('direção precisa de permissão e cancelamento preserva inscrições e gera auditoria',async()=>{
 director=false;assert.equal((await salvarEvento('school',{})).ok,false);await assert.rejects(()=>excluirEvento('school','event'),/permissão/);director=true;
 await excluirEvento('school','event');assert.equal(writes.at(-1).data.action,'cancelado');
});
