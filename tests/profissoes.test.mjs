import {test} from 'node:test';import assert from 'node:assert/strict';
import {classificarProfissao,chaveDeGenero,normalizar} from '../src/lib/profissoes.ts';
const area=(p,e)=>classificarProfissao(p,e).area;
test('agrupa profissões comuns por área de atuação',()=>{
 assert.equal(area('ADVOGADA'),'Jurídica');assert.equal(area('ANALISTA JUDICIÁRIA'),'Jurídica');
 assert.equal(area('MÉDICA'),'Saúde');assert.equal(area('TÉCNICA DE ENFERMAGEM'),'Saúde');
 assert.equal(area('PSICÓLOGA'),'Psicologia e terapias');assert.equal(area('PROFESSORA APOSENTADA'),'Educação');
 assert.equal(area('APOSENTADA'),'Aposentados');assert.equal(area('ENGENHEIRO DE SOFTWARE'),'Tecnologia da informação');
 assert.equal(area('MEDICA VETERINÁRIA'),'Ciências, meio ambiente e agrárias');assert.equal(area('GERENTE COMERCIAL'),'Comércio, vendas e empreendedorismo');
 assert.equal(area('ESTUDANTE'),'Estudantes');assert.equal(area(''),'Não informada');assert.equal(area('NAO INFORMADO'),'Não informada');
});
test('servidor público: área pelo órgão quando informado, senão fica sem área identificada',()=>{
 assert.deepEqual(classificarProfissao('SERVIDORA PÚBLICA','TJDFT'),{area:'Jurídica',peloOrgao:true});
 assert.equal(area('SERVIDOR PÚBLICO','SECRETARIA DE EST. DE SAÚDE'),'Saúde');
 assert.equal(area('FUNCIONÁRIO PÚBLICO','RECEITA FEDERAL'),'Administração, contabilidade e finanças');
 assert.equal(area('SERVIDOR PÚBLICO','*'),'Serviço público (área não identificada)');
 assert.equal(area('CONTADOR (SERVIDOR PÚBLIC','CODEVASF'),'Administração, contabilidade e finanças');
});
test('junta masculino e feminino só para agrupar',()=>{
 assert.equal(chaveDeGenero(normalizar('ADVOGADA')),chaveDeGenero(normalizar('ADVOGADO')));
 assert.equal(chaveDeGenero(normalizar('SERVIDORA PÚBLICA')),chaveDeGenero(normalizar('SERVIDOR PÚBLICO')));
 assert.equal(normalizar('SERVIDORA PÃºBLICA'),'SERVIDORA PUBLICA');
});
