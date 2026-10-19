import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';import assert from 'node:assert/strict';import path from 'node:path';
const root=process.cwd(),routeDir=path.join(root,'src/app/browser-events-local'),port=3018,base='http://127.0.0.1:'+port;let server,browser;let output='';
try{
 await mkdir(routeDir);await writeFile(path.join(routeDir,'page.tsx'),await readFile('tests/browser/fixtures/events.tsx.fixture'));
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NODE_USE_ENV_PROXY:'1',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-only',SUPABASE_SERVICE_ROLE_KEY:'test-only',DATABASE_URL:'postgresql://localhost:1/test',DIRECT_URL:'postgresql://localhost:1/test',CALLMEBOT_PHONE:'',CALLMEBOT_APIKEY:''},detached:true,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{output=(output+d).slice(-16000)});
 const until=Date.now()+60000;while(true){try{if((await fetch(base+'/browser-events-local',{signal:AbortSignal.timeout(15000)})).ok)break;}catch{}if(Date.now()>until)throw new Error('Servidor não iniciou: '+output);await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [414,1365]){
  const page=await browser.newPage({viewport:{width,height:896},timezoneId:'America/Sao_Paulo'});page.setDefaultTimeout(20000);const writes=[];
  await page.route('**/*',async route=>{const req=route.request();if(!req.url().startsWith(base))return route.abort();if(req.url().endsWith('/poster-fixture.svg'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560"><rect width="400" height="560" fill="#075c50"/><text x="35" y="140" fill="#f5d48a" font-size="32">EVENTO FICTÍCIO</text><text x="35" y="220" fill="white" font-size="24">Cartaz de teste</text><text x="35" y="420" fill="white" font-size="24">Nova Acrópole</text></svg>'});
   if(req.url().endsWith('/api/eventos/cartaz')&&req.method()==='POST')return route.fulfill({contentType:'application/json',body:JSON.stringify({posterPath:'fake-school/event-posters/poster.png',url:base+'/poster-fixture.svg'})});
   if(req.method()!=='POST')return route.continue();if(!req.headers()['next-action'])return route.abort();
   const manifest=JSON.parse(await readFile('.next/dev/server/server-reference-manifest.json','utf8'));const action=manifest.node[req.headers()['next-action']]?.exportedName;const args=JSON.parse(req.postData());let value;
   if(['excluirEvento','salvarEvento','definirRecepcaoEvento','definirRecepcaoEmLote','marcarPresencaEvento','declararComparecimento'].includes(action)){writes.push({action,args});value={ok:true};}
   else if(action==='inscreverEmEvento'){writes.push({action,args});value={ok:false,error:'O serviço de pagamentos não autorizou a operação. A administração precisa conferir a credencial e as permissões do Asaas.'};}
   else throw new Error('Ação inesperada: '+action);
   return route.fulfill({contentType:'text/x-component',body:'0:{"a":"$@1","f":"","b":"development"}\n1:'+JSON.stringify(value)+'\n'});
  });
  page.on('pageerror',e=>{throw e;});
  await page.goto(base+'/browser-events-local');
  const management=page.getByRole('region',{name:'Gestão de eventos'}),reception=page.getByRole('region',{name:'Recepção'});
  await management.getByLabel('Cartaz do evento',{exact:true}).setInputFiles({name:'cartaz.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2CsAAAAASUVORK5CYII=','base64')});await management.getByText('Cartaz enviado. Salve o evento para publicar a alteração.',{exact:true}).waitFor();
  await management.getByLabel('Limite de vagas (vazio = sem limite)',{exact:true}).fill('30');
  await management.getByLabel('Título',{exact:true}).fill('Curso novo');
  await management.getByLabel('Início',{exact:true}).fill('2099-02-01T19:00');await management.getByLabel('Término',{exact:true}).fill('2099-02-01T21:00');await management.getByLabel('Local',{exact:true}).fill('Escola teste');
  await management.getByRole('button',{name:'Publicar evento',exact:true}).click();await management.getByText('Evento salvo na Agenda do público escolhido.',{exact:true}).waitFor();assert.equal(writes[0].args[1].audience,'membros');assert.equal(writes[0].args[1].capacity,30);assert.equal(writes[0].args[1].posterPath,'fake-school/event-posters/poster.png');assert.equal(writes[0].args[1].startsAt,'2099-02-01T22:00:00.000Z');
  await management.getByText('Equipe de recepção',{exact:true}).click();await management.getByRole('checkbox',{name:'Voluntário teste',exact:true}).check();await management.getByRole('checkbox',{name:'Outra voluntária',exact:true}).check();await management.getByRole('button',{name:'Liberar selecionados (2)',exact:true}).click();await management.getByText('Equipe selecionada liberada para a recepção.',{exact:true}).waitFor();assert.deepEqual(new Set(writes.at(-1).args[2]),new Set(['volunteer','volunteer-two']));
  await reception.getByRole('combobox',{name:'Filtrar inscrições'}).selectOption('pendentes');assert.equal(await reception.locator('li').count(),1);assert.match(await reception.locator('li').innerText(),/Aluno pendente/);assert.equal(await reception.getByRole('button',{name:'Confirmar presença'}).isDisabled(),true);
  await reception.getByRole('combobox',{name:'Filtrar inscrições'}).selectOption('todos');await reception.getByRole('textbox',{name:'Buscar inscrito'}).fill('confirmado');await reception.getByRole('button',{name:'Confirmar presença',exact:true}).click();await reception.getByText('Conferência salva no histórico do aluno.',{exact:true}).waitFor();assert.equal(writes.at(-1).args[1],'r1');
  const downloadPromise=page.waitForEvent('download');await reception.getByRole('button',{name:'Baixar lista filtrada (CSV)',exact:true}).click();const downloaded=await downloadPromise;const csv=await readFile(await downloaded.path(),'utf8');assert.match(csv,/Aluno confirmado/);assert.equal(csv.includes('Aluno pendente'),false);
  await page.getByRole('region',{name:'Resposta do aluno'}).getByRole('button',{name:'Sim, participei',exact:true}).click();await page.getByText(/Resposta registrada/).waitFor();assert.equal(writes.at(-1).args[2],true);
  const paid=page.getByRole('region',{name:'Inscrição paga'});await paid.getByRole('button',{name:'Inscrever-se',exact:true}).click();await paid.getByPlaceholder('CPF de quem vai pagar').fill('12345678901');await paid.getByRole('button',{name:'Gerar PIX',exact:true}).click();await paid.getByText(/O serviço de pagamentos não autorizou/).waitFor();assert.equal((await paid.innerText()).includes('erro inesperado'),false);
  await management.getByRole('button',{name:'Cancelar evento',exact:true}).click();
  const cancellation=management.getByRole('dialog');assert.equal(await cancellation.getByRole('checkbox',{name:'Reembolsar as inscrições',exact:true}).isChecked(),false);
  await cancellation.getByRole('checkbox',{name:'Reembolsar as inscrições',exact:true}).check();
  await cancellation.getByRole('button',{name:'Confirmar cancelamento',exact:true}).click();
  await management.getByText('Evento cancelado. Reembolsos solicitados; acompanhe as confirmações na Economia.',{exact:true}).waitFor();
  assert.equal(writes.at(-1).action,'excluirEvento');assert.equal(writes.at(-1).args[2],true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/portal-events-'+width+'.png',fullPage:true});console.log('PASS '+width+'px: criação com público e horário, designação de recepção, filtros, conferência, CSV e declaração separada.');await page.close();
 }
}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,'SIGTERM')}catch{}await rm(routeDir,{recursive:true,force:true});await rm(path.join(root,'.next/dev/types'),{recursive:true,force:true});}
