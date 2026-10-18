import {test,mock} from 'node:test';import assert from 'node:assert/strict';
mock.module(new URL('../src/lib/db.ts',import.meta.url).href,{exports:{db:{}}});
const{materializeMeetingSeries}=await import('../src/lib/meeting-series.ts');
test('geração em lote não ressuscita cancelamento nem duplica reunião com horário alterado',async()=>{
 const series={id:'series',classGroupId:'group',createdById:'chief',startsLocal:'2026-11-01T19:00',endsLocal:'2026-11-01T20:00',timeZone:'America/Sao_Paulo',template:{title:'Reunião',publicDetails:'Oficina',internalDetails:'Reservado',fullUniform:false},changes:[],untilSlot:null};
 const slots=new Set(['2026-11-01T19:00','2026-11-08T19:00']);let inserted=[],audits=[];
 const store={groupMeeting:{findMany:async()=>[...slots].map(seriesSlot=>({seriesSlot})),createManyAndReturn:async({data,skipDuplicates})=>{assert.equal(skipDuplicates,true);inserted=data;data.forEach(row=>slots.add(row.seriesSlot));return data.map(({id})=>({id}));}},groupMeetingAudit:{createMany:async({data})=>{audits=data;}}};
 assert.equal(await materializeMeetingSeries(store,series,Date.parse('2026-10-31')),10);assert.equal(inserted.some(row=>row.seriesSlot==='2026-11-01T19:00'),false);assert.equal(audits.length,10);
 assert.equal(await materializeMeetingSeries(store,series,Date.parse('2026-10-31')),0);
});
