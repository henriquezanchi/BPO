import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';import assert from 'node:assert/strict';import path from 'node:path';
const root=process.cwd(),routeDir=path.join(root,'src/app/browser-meetings-local'),port=3017,base='http://127.0.0.1:'+port;let server,browser;let output='';
try{
 await mkdir(routeDir);await writeFile(path.join(routeDir,'page.tsx'),await readFile('tests/browser/fixtures/meetings.tsx.fixture'));
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NODE_USE_ENV_PROXY:'1',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-only',SUPABASE_SERVICE_ROLE_KEY:'test-only',DATABASE_URL:'postgresql://localhost:1/test',DIRECT_URL:'postgresql://localhost:1/test',CALLMEBOT_PHONE:'',CALLMEBOT_APIKEY:''},detached:true,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{output=(output+d).slice(-16000)});
 const until=Date.now()+60000;while(true){try{if((await fetch(base+'/browser-meetings-local',{signal:AbortSignal.timeout(15000)})).ok)break;}catch{}if(Date.now()>until)throw new Error('Servidor não iniciou: '+output);await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [414,1365]){
  const page=await browser.newPage({viewport:{width,height:896},timezoneId:'America/Sao_Paulo'});page.setDefaultTimeout(20000);const writes=[];
  const row={id:'fake',classGroupId:'test-only',title:'Reunião fictícia',startsAt:'2099-01-01T19:00:00Z',endsAt:'2099-01-01T20:00:00Z',timeZone:'America/Sao_Paulo',seriesId:'series',publicDetails:'Oficina pública',internalDetails:'SEGREDO_INTERNO_TESTE',fullUniform:true,status:'agendada',version:0,responses:[]};
  await page.route('**/*',async route=>{const req=route.request();if(!req.url().startsWith(base))return route.abort();if(req.method()!=='POST')return route.continue();if(!req.headers()['next-action'])return route.abort();
   const manifest=JSON.parse(await readFile('.next/dev/server/server-reference-manifest.json','utf8'));const action=manifest.node[req.headers()['next-action']]?.exportedName;const args=JSON.parse(req.postData());let value;
   if(action==='getGroupMeetings')value=[row];
   else if(action==='createGroupMeetings'){writes.push({action,args});value={ok:true,count:12,weekly:true};}
   else if(action==='changeGroupMeeting'){writes.push({action,args});value={ok:true};}
   else if(action==='createActivity'){writes.push({action,args});value={id:'activity-fake',slack:null,whatsapp:{sent:0,total:2,failed:2}};}
   else if(action==='manageActivity'){writes.push({action,args});value={ok:true};}
   else if(action==='respondGroupMeeting'){writes.push({action,args});value={ok:true};}
   else throw new Error('Ação inesperada: '+action);
   return route.fulfill({contentType:'text/x-component',body:'0:{"a":"$@1","f":"","b":"development"}\n1:'+JSON.stringify(value)+'\n'});
  });
  await page.goto(base+'/browser-meetings-local');await page.getByRole('region',{name:'Reuniões da brigada'}).getByRole('button',{name:'Editar',exact:true}).waitFor();
  const manager=page.getByRole('region',{name:'Reuniões da brigada'}),agenda=page.getByRole('region',{name:'Agenda do integrante'});
  assert.equal((await agenda.innerText()).includes('SEGREDO_INTERNO_TESTE'),false);assert.match(await agenda.innerText(),/16:00/);
  assert.equal(await manager.getByText('Fuso horário',{exact:true}).count(),0);assert.equal(await manager.locator('input[name=repeatUntil]').count(),0);
  await manager.getByLabel('A partir de',{exact:true}).fill('2099-02-01');await manager.getByLabel('Início',{exact:true}).fill('19:00');await manager.getByLabel('Fim',{exact:true}).fill('20:00');await manager.getByRole('button',{name:'Salvar encontro semanal',exact:true}).click();await manager.getByText(/Rotina semanal salva/).waitFor();
  await manager.getByRole('button',{name:'Editar',exact:true}).click();await manager.getByRole('combobox',{name:'Alcance da edição',exact:true}).selectOption('seguintes');await manager.getByRole('button',{name:'Salvar alterações',exact:true}).click();await manager.getByText(/Reunião atualizada/).waitFor();
  await agenda.getByRole('button',{name:'Justificar ausência',exact:true}).click();await agenda.getByLabel('Justificativa breve (somente você e os responsáveis do grupo)',{exact:true}).fill('Compromisso anterior');await agenda.getByRole('button',{name:'Registrar justificativa',exact:true}).click();await agenda.getByText(/Justificativa registrada/).waitFor();
  assert.equal(writes[0].args[1].weekly,true);assert.equal(writes[0].args[1].repeatUntil,undefined);assert.equal(writes[1].args[2],'seguintes');assert.equal(writes[2].args[0],'test-member');assert.equal(writes[2].args[4],0);
  const notices=page.getByRole('region',{name:'Avisos do grupo'});await notices.locator('input[name=dueDate]').fill('2099-01-01');await notices.locator('input[name=title]').fill('Aviso teste');await notices.getByRole('button',{name:'Publicar para o grupo',exact:true}).click();await notices.getByText(/Nenhuma mensagem enviada pelo WhatsApp/).waitFor();assert.equal((await notices.innerText()).includes('integrantes notificados'),false);
  const published=page.getByRole('region',{name:'Publicações'});
  await published.locator('summary').click();await published.getByText('Mensagem completa do aviso',{exact:true}).waitFor();
  await published.getByRole('button',{name:'Editar',exact:true}).click();await published.getByLabel('Título',{exact:true}).fill('Aviso revisado');await published.getByRole('button',{name:'Salvar alterações',exact:true}).click();await published.getByText(/Alterações salvas na Agenda/).waitFor();
  assert.equal(writes.at(-1).args[1].title,'Aviso revisado');
  await published.getByRole('button',{name:'Excluir',exact:true}).click();await published.getByRole('button',{name:'Manter publicação',exact:true}).click();assert.equal(writes.at(-1).args[1].title,'Aviso revisado');
  await published.getByRole('button',{name:'Excluir',exact:true}).click();await published.getByRole('button',{name:'Confirmar exclusão',exact:true}).click();await published.locator('summary').waitFor({state:'detached'});assert.equal(writes.at(-1).args[1],null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/portal-meetings-'+width+'.png',fullPage:true});console.log('PASS '+width+'px: reunião semanal, alcance de edição, justificativa e separação visual dos detalhes internos.');await page.close();
 }
}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,'SIGTERM')}catch{}await rm(routeDir,{recursive:true,force:true});await rm(path.join(root,'.next/dev/types'),{recursive:true,force:true});}
