import {test,mock} from 'node:test';import assert from 'node:assert/strict';
import {eventAudienceWhere,validateInternalEvent,eventNoticePlan,publicosDaPessoa,eventScopeWhere,regionalDaUf} from '../src/lib/event-policy.ts';
const actor={id:'member',schoolId:'school',mercurioAtivo:true,isJanos:false,isMembroPrograma:true,isProvacionista:false,isDiretor:false,isSubChefe:false,name:'Aluno teste',email:null};
process.env.ASAAS_API_KEY='test-only';
let failureMode='off';
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
mock.module(new URL('../src/lib/asaas/client.ts',import.meta.url).href,{exports:{asaasFindOrCreateCustomer:async()=>{if(failureMode==='customer')throw Error('Asaas API /customers -> HTTP 400: dado privado fictício');return {id:'customer'};},asaasCreatePixCharge:async()=>{payCalls++;if(failureMode==='payment')throw Error('fetch failed');return {id:'payment'};},asaasGetPixQrCode:async()=>({payload:'existing-qr',encodedImage:'image'}),asaasGetPaymentStatus:async()=>({status:'PENDING'})}});
mock.module(new URL('../src/lib/asaas/split.ts',import.meta.url).href,{exports:{calcularSplitEscola:async()=>({walletId:wallet,fixedValue:48})}});
mock.module(new URL('../src/lib/event-refunds.ts',import.meta.url).href,{exports:{processEventRefundQueue:async()=>({consultadas:0})}});
mock.module('next/cache',{exports:{revalidatePath:()=>{}}});
const{inscreverEmEvento,marcarPresencaEvento,salvarEvento,excluirEvento}=await import('../src/lib/actions/event-actions.ts');
test('público é explícito e papéis desconhecidos do Ágora ficam bloqueados',()=>{
 const where=eventAudienceWhere({...actor,isMembroPrograma:false},false);
 assert.deepEqual(where.publicos,{hasSome:['todos_ativos']});assert.deepEqual(where.source,{notIn:['agora','google_calendar_nacional']});
});
test('membros = 2º nível em diante, incluindo FV, HD, dirigentes e provacionistas; N1 fica só com todos os ativos',()=>{
 const base={isMembroPrograma:true,isProvacionista:false};
 assert.deepEqual(publicosDaPessoa({...base,nivel:'N1'}),['todos_ativos']);
 assert.deepEqual(publicosDaPessoa({...base,nivel:'N2'}),['todos_ativos','membros']);
 assert.deepEqual(publicosDaPessoa({...base,nivel:'N1',isFV:true}),['todos_ativos','membros','fv']);
 // Públicos agregadores (2026-10-25): evento de FV vale para HD e dirigentes.
 assert.deepEqual(publicosDaPessoa({...base,nivel:'N3',isHD:true,isDirigente:true}),['todos_ativos','membros','fv','hd','dirigentes']);
 assert.deepEqual(publicosDaPessoa({isMembroPrograma:false,isProvacionista:true,nivel:'PP'}),['todos_ativos']);
 assert.deepEqual(publicosDaPessoa({...base,nivel:'N2',emProvacionismo:true}),['todos_ativos','membros','provacionistas']);
 assert.ok(!publicosDaPessoa({...base,nivel:'N3'}).includes('fv'));
});
test('abertura a outras filiais: por filial, regional e estado',()=>{
 const or=eventScopeWhere({id:'escola-go',uf:'GO'}).OR;
 assert.ok(or.some(c=>c.schoolId==='escola-go'));assert.ok(or.some(c=>c.abertoA==='todas'));
 assert.ok(or.some(c=>c.abertoA==='regionais'&&c.abertoValores.has==='centro_oeste'));assert.ok(or.some(c=>c.abertoA==='estados'&&c.abertoValores.has==='GO'));
 assert.equal(regionalDaUf('DF'),'df');assert.equal(regionalDaUf('PA'),'norte');assert.equal(regionalDaUf('CE'),'nordeste');
 const v=validateInternalEvent({title:'Curso',startsAt:'2099-01-01T19:00Z',endsAt:'2099-01-01T21:00Z',price:0,publicos:['membros','fv'],abertoA:'regionais',abertoValores:['df','norte'],description:'',location:'Escola'});
 assert.deepEqual(v.publicos,['membros','fv']);assert.equal(v.abertoA,'regionais');
 assert.throws(()=>validateInternalEvent({title:'Curso',startsAt:'2099-01-01T19:00Z',endsAt:'2099-01-01T21:00Z',price:0,publicos:['membros'],abertoA:'filiais',abertoValores:[],description:'',location:'Escola'}));
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
 actor.isJanos=true;assert.match((await inscreverEmEvento('member','event','12345678901')).error,/consulta/);actor.isJanos=false;
 eventStatus='cancelado';assert.match((await inscreverEmEvento('member','event','12345678901')).error,/indisponível/);eventStatus='publicado';
 wallet=null;assert.match((await inscreverEmEvento('member','event','12345678901')).error,/split/);wallet='school-wallet';
 assert.match((await inscreverEmEvento('member','event','12345678901')).error,/conferência/);assert.equal(payCalls,0);
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

test('erro de preparação volta como mensagem legível, sem cobrança; timeout do POST permanece em revisão',async()=>{
 event.startsAt=new Date('2099-01-01T19:00Z');eventStatus='publicado';
 current={...current,pixPayload:null,asaasPaymentId:null,paymentState:'novo'};
 const {db:store}=await import('../src/lib/db.ts');
 store.eventRegistration.updateMany=async()=>({count:1});store.eventRegistration.update=async()=>{};
 const states=[];tx.eventRegistration.updateMany=async args=>{states.push(args.data.paymentState);return {count:1};};
 failureMode='customer';const before=payCalls;
 const rejected=await inscreverEmEvento('member','event','12345678901');assert.equal(rejected.ok,false);assert.match(rejected.error,/recusou os dados/);assert.equal(rejected.error.includes('privado'),false);assert.equal(payCalls,before);assert.equal(states.at(-1),'novo');
 failureMode='payment';const uncertain=await inscreverEmEvento('member','event','12345678901');assert.equal(uncertain.ok,false);assert.match(uncertain.error,/conferência/);assert.equal(states.at(-1),'revisao');assert.equal(writes.at(-1).data.changes.stage,'criacao_cobranca');assert.equal(writes.at(-1).data.changes.safeToRetry,false);
});
test('falta de credencial é explicada e não dispara pedido de cobrança',async()=>{
 delete process.env.ASAAS_API_KEY;const before=payCalls;
 const result=await inscreverEmEvento('member','event','12345678901');assert.equal(result.ok,false);assert.match(result.error,/configurar o Asaas/);assert.equal(payCalls,before);
});

test('capacidade e prazo são conferidos no servidor; inscrição existente conserva sua reserva',async()=>{
 process.env.ASAAS_API_KEY='test-only';
 event.startsAt=new Date('2099-01-01T19:00Z');event.capacity=1;event.registrationClosesAt=null;
 current={...current,pixPayload:'saved-qr',asaasPaymentId:null,paymentState:'novo'};
 let existing=false;tx.eventRegistration.findUnique=async()=>existing?{id:current.id}:null;tx.eventRegistration.count=async()=>1;
 const full=await inscreverEmEvento('member','event','12345678901');assert.equal(full.ok,false);assert.match(full.error,/vagas/);
 existing=true;assert.equal((await inscreverEmEvento('member','event','12345678901')).ok,true);
 event.capacity=null;event.registrationClosesAt=new Date('2020-01-01');existing=false;const closed=await inscreverEmEvento('member','event','12345678901');assert.match(closed.error,/encerradas/);
 existing=true;assert.equal((await inscreverEmEvento('member','event','12345678901')).ok,true);
 event.registrationClosesAt=null;
});
test('limite de vagas e fechamento inválidos são recusados',()=>{
 const data={title:'Curso',startsAt:'2099-01-01T19:00Z',endsAt:'2099-01-01T21:00Z',price:0,audience:'membros',description:'',location:'Escola'};
 for(const change of [{capacity:0},{capacity:1.5},{capacity:-1},{registrationClosesAt:'2099-01-01T20:00Z'}])assert.throws(()=>validateInternalEvent({...data,...change}));
 assert.equal(validateInternalEvent({...data,capacity:30}).capacity,30);
});
test('recepção em lote verifica todos os voluntários antes de gravar e deduplica IDs',async()=>{
 const {db:store}=await import('../src/lib/db.ts');const {definirRecepcaoEmLote}=await import('../src/lib/actions/event-actions.ts');
 store.event.findFirstOrThrow=async()=>event;
 store.member={findMany:async()=>[{...actor,id:'one'},{...actor,id:'two'}]};
 let batch;tx.eventReception={createMany:async args=>{batch=args.data;}};
 const result=await definirRecepcaoEmLote('school','event',['one','two','one']);assert.equal(result.ok,true);assert.equal(batch.length,2);
 store.member.findMany=async()=>[{...actor,id:'one'}];batch=null;
 assert.equal((await definirRecepcaoEmLote('school','event',['one','outside'])).ok,false);assert.equal(batch,null);
});

test('opção de reembolso é validada e enfileira inscrições na mesma transação do cancelamento',async()=>{
 await assert.rejects(()=>excluirEvento('school','event','sim'),/inválida/);
 const queued=[];tx.eventRegistration.updateMany=async args=>{queued.push(args);return {count:1};};
 await excluirEvento('school','event',true);assert.equal(queued[0].where.refundState,'nao_solicitado');assert.equal(queued[0].data.refundState,'pendente');assert.equal(writes.at(-1).data.changes.reembolsarInscricoes,true);
});
