import {test,mock} from 'node:test';import assert from 'node:assert/strict';
let type='BF',access=true,teacher=true,active=true,memberId='member',membership=true;const writes=[];
const meeting={id:'meeting',classGroupId:'group',startsAt:new Date('2099-01-01T19:00Z'),endsAt:new Date('2099-01-01T20:00Z'),status:'agendada',version:0};
const tx={groupMeetingSeries:{findUnique:async()=>null,updateMany:async()=>({count:0})},groupMeeting:{create:async({data})=>{writes.push(data);return {id:'meeting',...data};},findUniqueOrThrow:async()=>meeting,updateMany:async({where})=>({count:where.version===0?1:0})},groupMeetingAudit:{create:async({data})=>writes.push(data)},groupMeetingResponse:{upsert:async({create})=>writes.push(create)},classMembership:{count:async()=>membership?1:0}};
mock.module(new URL('../src/lib/auth.ts',import.meta.url).href,{exports:{requireAuthenticatedMember:async id=>{if(id!==memberId)throw new Error('Não é o titular');return {id,mercurioAtivo:active};},requireTeacherOfClass:async()=>{if(!teacher)throw new Error('Sem permissão');return {id:'chief',mercurioAtivo:active};}}});
mock.module(new URL('../src/lib/acesso-voluntario.ts',import.meta.url).href,{exports:{temAcessoVoluntario:async()=>access}});
mock.module(new URL('../src/lib/db.ts',import.meta.url).href,{exports:{db:{classGroup:{findUniqueOrThrow:async()=>({tipo:type})},groupMeeting:{findUniqueOrThrow:async()=>meeting},$transaction:async fn=>fn(tx)}}});
mock.module('next/cache',{exports:{revalidatePath:()=>{}}});
const{createGroupMeetings,respondGroupMeeting,changeGroupMeeting}=await import('../src/lib/actions/group-meeting-actions.ts');
const input={title:'Reunião teste',startsLocal:'2099-01-01T19:00',endsLocal:'2099-01-01T20:00',timeZone:'America/Sao_Paulo',publicDetails:'Oficina',internalDetails:'Reservado',fullUniform:true};
test('apenas responsável ativo de uma brigada cria reunião e guarda auditoria',async()=>{
 type='turma';assert.equal((await createGroupMeetings('group',input)).ok,false);type='BF';teacher=false;assert.equal((await createGroupMeetings('group',input)).ok,false);teacher=true;active=false;assert.equal((await createGroupMeetings('group',input)).ok,false);active=true;assert.equal(writes.length,0);
 const result=await createGroupMeetings('group',input);assert.equal(result.count,1);assert.equal(writes[0].required,true);assert.equal(writes[1].action,'criada');
});
test('resposta exige titular, liberação, vínculo e versão vigente da convocação',async()=>{
 assert.equal((await respondGroupMeeting('other','meeting','confirmado','',0)).ok,false);access=false;assert.equal((await respondGroupMeeting('member','meeting','confirmado','',0)).ok,false);access=true;membership=false;assert.equal((await respondGroupMeeting('member','meeting','confirmado','',0)).ok,false);membership=true;
 assert.match((await respondGroupMeeting('member','meeting','confirmado','',7)).error,/mudou/);
 assert.equal((await respondGroupMeeting('member','meeting','ausencia_justificada','',0)).ok,false);
 await respondGroupMeeting('member','meeting','ausencia_justificada','Compromisso anterior',0);assert.equal(writes.at(-1).action,'resposta');assert.equal(writes.at(-1).changes.justification,'Compromisso anterior');
});

test('edição em série preserva o histórico e apaga a confirmação do horário antigo',async()=>{
 meeting.seriesId='series';meeting.timeZone='America/Sao_Paulo';meeting.publicDetails='Antes';meeting.internalDetails='Reservado';meeting.fullUniform=false;
 let deleted=0;const responses=[{memberId:'member',response:'ausencia_justificada',justification:'Compromisso anterior',updatedAt:new Date('2026-10-18')}];
 tx.groupMeeting.findMany=async({where})=>{assert.equal(where.seriesId,'series');assert.equal(where.status,'agendada');return [{...meeting,responses}];};
 tx.groupMeeting.update=async({data})=>writes.push(data);tx.groupMeetingResponse.deleteMany=async()=>{deleted++;};
 await changeGroupMeeting('meeting',0,'seguintes',input);
 assert.equal(deleted,1);const audit=writes.at(-1);assert.equal(audit.action,'alterada');assert.equal(audit.changes.previousResponses[0].justification,'Compromisso anterior');assert.equal(audit.changes.before.internalDetails,'Reservado');
 assert.match((await changeGroupMeeting('meeting',7,'esta',input)).error,/outra sessão/);
});

test('rotina semanal é criada com persistência em lote e sem limite de término',async()=>{
 const captured=[];
 tx.groupMeetingSeries.create=async({data})=>{captured.push(data);return {id:'new-series',...data,changes:[],untilSlot:null};};
 tx.groupMeeting.findMany=async()=>[];
 tx.groupMeeting.createManyAndReturn=async({data})=>{captured.push(data);return data.map(({id})=>({id}));};
 tx.groupMeetingAudit.createMany=async({data})=>{captured.push(data);};
 const result=await createGroupMeetings('group',{...input,weekly:true});assert.equal(result.ok,true);assert.equal(result.count,12);assert.equal(captured[0].untilSlot,undefined);assert.equal(captured[1].length,12);assert.equal(captured[2].length,12);
});
