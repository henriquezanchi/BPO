import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';import assert from 'node:assert/strict';import path from 'node:path';
const root=process.cwd(),routeDir=path.join(root,'src/app/browser-event-economy-local'),port=3021,base='http://127.0.0.1:'+port;let server,browser;let output='';
try{
 await mkdir(routeDir);await writeFile(path.join(routeDir,'page.tsx'),await readFile('tests/browser/fixtures/event-economy.tsx.fixture'));
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NODE_USE_ENV_PROXY:'1',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-only',SUPABASE_SERVICE_ROLE_KEY:'test-only',DATABASE_URL:'postgresql://localhost:1/test',DIRECT_URL:'postgresql://localhost:1/test',CALLMEBOT_PHONE:'',CALLMEBOT_APIKEY:''},detached:true,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{output=(output+d).slice(-16000)});
 const until=Date.now()+60000;while(true){try{if((await fetch(base+'/browser-event-economy-local',{signal:AbortSignal.timeout(15000)})).ok)break;}catch{}if(Date.now()>until)throw new Error('Servidor não iniciou: '+output);await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [414,1365]){
  let receipt=null;const calls=[];const page=await browser.newPage({viewport:{width,height:896},timezoneId:'America/Sao_Paulo'});
  const row={id:'r1',name:'=Aluno fictício',registrationNo:42,event:'Palestra teste',eventAt:'2099-01-01T22:00Z',eventStatus:'cancelado',registeredAt:'2026-10-01T12:00Z',receivedAt:'2026-10-02T12:00Z',amount:50,paid:false,paymentState:'reembolsado',paymentId:'pay-test',refundState:'reembolsado',refundLabel:'Reembolsado',refundedAmount:50,refundedAt:'2026-10-19T12:00Z',refundError:null,receipt:null,recordedAt:null,checkedIn:false,checkedInAt:null,selfReportedAttendance:'sim'};
  await page.route('**/*',async route=>{
   const req=route.request();if(!req.url().startsWith(base))return route.abort();if(req.method()!=='POST')return route.continue();if(!req.headers()['next-action'])return route.abort();
   const manifest=JSON.parse(await readFile('.next/dev/server/server-reference-manifest.json','utf8'));const action=manifest.node[req.headers()['next-action']]?.exportedName;const args=JSON.parse(req.postData());calls.push({action,args});let value;
   if(action==='getEventEconomyReport')value={school:'Escola teste',cashier:'Caixa Asaas',totals:{received:100,refunded:50,count:2},items:args[1].cursor?[{...row,id:'r2',name:'Outro aluno',refundedAmount:0,refundState:'nao_solicitado',refundLabel:'Não solicitado'}]:[{...row,receipt,recordedAt:receipt?'2026-10-19T12:00Z':null}],nextCursor:args[1].cursor?null:'r1'};
   else if(action==='recordEventMercurioReceipt'){receipt=args[2];value={ok:true};}
   else throw Error('Ação inesperada: '+action);
   return route.fulfill({contentType:'text/x-component',body:'0:{"a":"$@1","f":"","b":"development"}\n1:'+JSON.stringify(value)+'\n'});
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/browser-event-economy-local');
  const report=page.getByRole('region',{name:'Relatório de eventos para a Economia'});await report.getByText('=Aluno fictício · matrícula 42',{exact:true}).waitFor();
  assert.match(await report.innerText(),/Presença: não confirmada.*Declaração do participante: sim/);
  await report.getByRole('button',{name:'Carregar mais registros',exact:true}).click();await report.getByText('Outro aluno · matrícula 42',{exact:true}).waitFor();
  const downloadPromise=page.waitForEvent('download');await report.getByRole('button',{name:'Baixar registros carregados (CSV)',exact:true}).click();const download=await downloadPromise;const csv=await readFile(await download.path(),'utf8');assert.match(csv,/'=Aluno fictício/);assert.match(csv,/Outro aluno/);assert.match(csv,/Recibo Mercúrio/);
  await report.getByLabel('Recibo ou referência no Mercúrio',{exact:true}).first().fill('12345');await report.getByRole('button',{name:'Registrar lançamento feito no Mercúrio',exact:true}).first().click();await report.getByText(/Lançamento informado pela Economia: 12345/).waitFor();assert.equal(calls.find(c=>c.action==='recordEventMercurioReceipt').args[2],'12345');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/portal-event-economy-'+width+'.png',fullPage:true});console.log('PASS relatório de eventos '+width+'px: paginação, CSV protegido, presença separada e referência manual.');await page.close();
 }
}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,'SIGTERM')}catch{}await rm(routeDir,{recursive:true,force:true});await rm(path.join(root,'.next/dev/types'),{recursive:true,force:true});}
