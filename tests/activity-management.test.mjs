import {mockModule} from './helpers/mock-module.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
let authorized=true;const writes=[];
const tx={activityNotification:{deleteMany:async args=>writes.push(['notifications',args])},activity:{delete:async args=>writes.push(['delete',args])}};
mockModule(new URL('../src/lib/auth.ts',import.meta.url).href,{exports:{requireTeacherOfClass:async group=>{assert.equal(group,'real-group');if(!authorized)throw Error('denied');return {id:'leader'};}}});
mockModule(new URL('../src/lib/acesso-voluntario.ts',import.meta.url).href,{exports:{comAcessoVoluntario:async()=>new Set()}});
mockModule(new URL('../src/lib/db.ts',import.meta.url).href,{exports:{db:{activity:{findUniqueOrThrow:async()=>({classGroupId:'real-group'}),update:async args=>writes.push(['update',args])},classGroup:{findUniqueOrThrow:async()=>({tipo:'BF'})},$transaction:async fn=>fn(tx)}}});
mockModule(new URL('../src/lib/slack.ts',import.meta.url).href,{exports:{postarNoCanal:async()=>{throw Error('unexpected send');},tokenSlackDaFilial:()=>null}});
mockModule(new URL('../src/lib/whatsapp/send.ts',import.meta.url).href,{exports:{sendWhatsAppMessage:async()=>{throw Error('unexpected send');}}});
mockModule('next/cache',{exports:{revalidatePath:()=>{}}});
const {manageActivity}=await import('../src/lib/actions/activity-actions.ts');
const input={type:'aviso',title:' Aviso corrigido ',description:'Mensagem completa',dueDate:new Date('2026-11-01T00:00Z')};
test('gestão confere o grupo do registro e bloqueia edição e exclusão sem permissão',async()=>{
 authorized=false;
 assert.equal((await manageActivity('notice',input)).ok,false);
 assert.equal((await manageActivity('notice',null)).ok,false);
 assert.equal(writes.length,0);authorized=true;
});
test('edição valida conteúdo e não dispara notificações',async()=>{
 assert.equal((await manageActivity('notice',{...input,type:'prova'})).ok,false);
 assert.equal((await manageActivity('notice',{...input,title:' '})).ok,false);
 assert.equal((await manageActivity('notice',{...input,dueDate:new Date('invalid')})).ok,false);
 assert.equal(writes.length,0);
 assert.equal((await manageActivity('notice',input)).ok,true);
 assert.equal(writes[0][1].data.title,'Aviso corrigido');
});
test('exclusão remove dependências e publicação na mesma transação',async()=>{
 assert.equal((await manageActivity('notice',null)).ok,true);
 assert.deepEqual(writes.slice(-2).map(x=>x[0]),['notifications','delete']);
 assert.deepEqual(writes.at(-2)[1].where,{activityId:'notice'});
});
