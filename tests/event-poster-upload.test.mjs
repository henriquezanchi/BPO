import {test,mock} from 'node:test';import assert from 'node:assert/strict';
let actor=null,publicBucket=false;const uploads=[];
mock.module(new URL('../src/lib/auth.ts',import.meta.url).href,{exports:{getAuthenticatedMember:async()=>actor}});
mock.module(new URL('../src/lib/supabase/admin.ts',import.meta.url).href,{exports:{supabaseAdmin:{storage:{getBucket:async()=>({data:{public:publicBucket}}),from:()=>({upload:async(path,bytes)=>{uploads.push({path,bytes});return {error:null};}})}}}});
mock.module(new URL('../src/lib/event-posters.ts',import.meta.url).href,{exports:{EVENT_POSTERS_BUCKET:'event-posters',eventPosterUrl:async()=>'https://test.invalid/signed-poster'}});
const{POST}=await import('../src/app/api/eventos/cartaz/route.ts');
function request(type='image/png',bytes=new Uint8Array([137,80,78,71,13,10,26,10]),origin='http://localhost'){
 const body=new FormData();body.set('file',new File([bytes],'poster.png',{type}));body.set('schoolId','other-school');return new Request('http://localhost/api/eventos/cartaz',{method:'POST',headers:{origin},body});
}
test('somente direção ativa envia cartaz e origem cruzada é bloqueada',async()=>{
 assert.equal((await POST(request())).status,403);actor={schoolId:'school',mercurioAtivo:true,isDiretor:false,isSubChefe:false};assert.equal((await POST(request())).status,403);actor.isDiretor=true;assert.equal((await POST(request('image/png',undefined,'https://other.invalid'))).status,403);assert.equal(uploads.length,0);
});
test('upload valida imagem e usa a escola da sessão em armazenamento privado',async()=>{
 assert.equal((await POST(request('image/png',new TextEncoder().encode('<svg/>')))).status,400);
 const result=await POST(request());assert.equal(result.status,200);assert.match((await result.json()).posterPath,/^school\/event-posters\/.*\.png$/);assert.equal(uploads.length,1);
 publicBucket=true;assert.equal((await POST(request())).status,503);assert.equal(uploads.length,1);
});
