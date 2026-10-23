import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {chavePlay,cifrarLinkPlay,decifrarLinkPlay,hashEmailPlay,identidadePlayConfere,validarLinkPlay} from "../src/lib/acropole-play/core";
import {lerExportacaoPlay,planejarImportacaoPlay} from "../src/lib/acropole-play/import";
const link="https://membros.acropoleplay.com/auth/login?crstk=TOKEN_FICTICIO_DE_TESTE";
const vinculo={memberId:"p1",sourceStudentId:"123",emailHash:hashEmailPlay("teste@example.org")};
const chave=randomBytes(32);
test("cifra autenticada não expõe token e vincula a identidade completa",()=>{
 const c=cifrarLinkPlay(link,vinculo,chave);
 assert.ok(!c.includes("TOKEN_FICTICIO"));assert.equal(decifrarLinkPlay(c,vinculo,chave),link);
 for(const v of [{...vinculo,memberId:"p2"},{...vinculo,sourceStudentId:"999"},{...vinculo,emailHash:hashEmailPlay("outro@example.org")}])assert.throws(()=>decifrarLinkPlay(c,v,chave));
 assert.throws(()=>decifrarLinkPlay(c,vinculo,randomBytes(32)));
 assert.notEqual(c,cifrarLinkPlay(link,vinculo,chave));
});
test("bloqueia redirecionamentos arbitrários, ambiguidades e queries extras",()=>{
 for(const u of ["http://membros.acropoleplay.com/auth/login?crstk=x","https://membros.acropoleplay.com.evil.example/auth/login?crstk=x","https://membros.acropoleplay.com/dashboard?crstk=x",link+"&next=https://example.org",link+"&crstk=outro",link+"#fragmento","https://a:b@membros.acropoleplay.com/auth/login?crstk=x"]){
  assert.throws(()=>validarLinkPlay(u),e=>e instanceof Error&&!e.message.includes("crstk"));
 }
 assert.equal(validarLinkPlay(link),link);
});
test("confirma email verificado e valida a chave de 32 bytes",()=>{
 assert.equal(identidadePlayConfere(" TESTE@example.org ",true,vinculo.emailHash),true);
 assert.equal(identidadePlayConfere("teste@example.org",false,vinculo.emailHash),false);
 assert.equal(identidadePlayConfere("outro@example.org",true,vinculo.emailHash),false);
 assert.deepEqual(chavePlay(chave.toString("base64")),chave);
 assert.throws(()=>chavePlay("chave-curta"));
});
test("lê xls tabulado UTF16 com BOM, aspas, tabulação e quebra interna",()=>{
 const text='\ufeffid\tnome\temail\tlogin_auto\ttags\r\n123\t"Pessoa\tTeste"\tteste@example.org\t'+link+'\t"tag\nsegunda"\r\n';
 const r=lerExportacaoPlay(Buffer.from(text,"utf16le"));assert.equal(r.length,1);assert.equal(r[0].id,"123");assert.equal(r[0].nome,"Pessoa\tTeste");
 assert.throws(()=>lerExportacaoPlay(Buffer.from('id\tnome\temail\temail\n')));
 assert.throws(()=>lerExportacaoPlay(Buffer.from('id\tnome\temail\tlogin_auto\n123\t"incompleto')));
});
const aluno={linha:2,id:"123",nome:"Pessoa Teste",email:"teste@example.org",link};
const membro={id:"p1",name:"Pessoa Teste",email:"teste@example.org",mercurioAtivo:true,responsavelId:null};
test("só aceita email único e nome compatível; não cria membros por aproximação",()=>{
 assert.equal(planejarImportacaoPlay([aluno],[membro],[]).aceitos.length,1);
 assert.equal(planejarImportacaoPlay([aluno],[membro,{...membro,id:"p2"}],[]).aceitos.length,0);
 assert.equal(planejarImportacaoPlay([aluno],[{...membro,name:"Outra Pessoa"}],[]).aceitos.length,0);
 assert.equal(planejarImportacaoPlay([aluno],[{...membro,responsavelId:"p2"}],[]).aceitos.length,0);
 assert.equal(planejarImportacaoPlay([aluno],[{...membro,mercurioAtivo:false}],[]).aceitos.length,0);
 const dup=planejarImportacaoPlay([aluno,{...aluno,linha:3,id:"124"}],[membro],[]);assert.equal(dup.aceitos.length,0);
});
test("não transfere vínculo existente para outra conta",()=>{
 const atual={memberId:"p2",sourceStudentId:"123",emailHash:vinculo.emailHash};
 assert.equal(planejarImportacaoPlay([aluno],[membro],[atual]).aceitos.length,0);
 assert.equal(planejarImportacaoPlay([aluno],[membro],[{...atual,memberId:"p1"}]).aceitos.length,1);
});
