import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';import assert from 'node:assert/strict';import path from 'node:path';
const root=process.cwd(),routeDir=path.join(root,'src/app/browser-finance-local'),port=3016,base='http://127.0.0.1:'+port;let server,browser;let output='';
try{
 await mkdir(routeDir);await writeFile(path.join(routeDir,'page.tsx'),await readFile('tests/browser/fixtures/finance.tsx.fixture'));
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NODE_USE_ENV_PROXY:'1',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-only',SUPABASE_SERVICE_ROLE_KEY:'test-only',DATABASE_URL:'postgresql://localhost:1/test',DIRECT_URL:'postgresql://localhost:1/test',CALLMEBOT_PHONE:'',CALLMEBOT_APIKEY:''},detached:true,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{output=(output+d).slice(-16000)});
 const until=Date.now()+60000;while(true){try{if((await fetch(base+'/browser-finance-local',{signal:AbortSignal.timeout(15000)})).ok)break;}catch{}if(Date.now()>until)throw new Error('Servidor não iniciou: '+output);await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [414,1365]){
  const page=await browser.newPage({viewport:{width,height:896}});page.setDefaultTimeout(20000);let failures=false;const unexpected=[];
  await page.route('**/*',async route=>{const req=route.request();if(!req.url().startsWith(base))return route.abort();if(req.method()!=='POST')return route.continue();
   const manifest=JSON.parse(await readFile('.next/dev/server/server-reference-manifest.json','utf8'));const action=manifest.node[req.headers()['next-action']]?.exportedName;let value;
   if(action==='getPaymentReview'){
    if(failures)return route.abort();const args=JSON.parse(req.postData());const status=args[1]?.status;
    value={items:[{id:'fake',name:'Aluno fictício',year:2026,month:9,amount:110,method:'PIX',receivedAt:status==='pendente'?null:'2026-10-18T12:00:00Z',stage:status==='pendente'?{key:'aguardando',label:'Aguardando confirmação do pagamento'}:{key:'conferir',label:'Recebido — lançamento precisa de conferência'},attempts:1}],nextCursor:null};
   }else if(action==='getPendingContributionCharge')value={metodo:'PIX',chargeId:'fake',pixPayload:'CODIGO-FICTICIO',pixQrCodeBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/d1sAAAAASUVORK5CYII=',amount:110,fortunaTopUpAmount:0,totalCobrado:110};
   else if(action==='checkChargeStatus')value={status:'pendente'};
   else{unexpected.push(action);return route.abort();}
   return route.fulfill({contentType:'text/x-component',body:'0:{"a":"$@1","f":"","b":"development"}\n1:'+JSON.stringify(value)+'\n'});
  });
  await page.goto(base+'/browser-finance-local');await page.getByText('Aluno fictício',{exact:true}).waitFor();await page.getByText('1 competência(s) registrada(s) em atraso.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/^Fev/}).isEnabled(),false);assert.equal(await page.getByRole('button',{name:/^Mar/}).isEnabled(),false);await page.screenshot({path:'/tmp/portal-position-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:/^Jan/}).click();await page.getByText(/Recebimento confirmado pelo Portal. O comprovante/).waitFor();await page.getByRole('button',{name:'Ir para a contribuição mais antiga em aberto',exact:true}).click();await page.getByRole('button',{name:/^Dez/}).click();await page.getByRole('button',{name:'Copiar código PIX',exact:true}).waitFor();
  const review=page.getByRole('region',{name:'Conferência de pagamentos'});await review.getByRole('combobox',{name:'Situação dos pagamentos',exact:true}).selectOption('pendente');await review.getByText('Aguardando confirmação do pagamento',{exact:true}).waitFor();failures=true;await review.getByRole('button',{name:'Atualizar',exact:true}).click();await review.getByRole('alert').waitFor();failures=false;await review.getByRole('button',{name:'Atualizar',exact:true}).click();await review.getByRole('alert').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(unexpected,[]);await page.screenshot({path:'/tmp/portal-finance-'+width+'.png',fullPage:true});console.log('PASS '+width+'px: atraso anterior, recebimento confirmado, mês sem dados, cobrança existente e conferência com recuperação de erro.');await page.close();
 }
}finally{await browser?.close();if(server?.pid)try{process.kill(-server.pid,'SIGTERM')}catch{}await rm(routeDir,{recursive:true,force:true});await rm(path.join(root,'.next/dev/types'),{recursive:true,force:true});}
