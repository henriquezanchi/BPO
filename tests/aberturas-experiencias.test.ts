import test from 'node:test';
import assert from 'node:assert/strict';
import {experienciasDaRede} from '../src/lib/aberturas/experiencias';
test('experiências exigem opt-in e amostra em pelo menos duas escolas, sem devolver identidade',()=>{
 const ciclos=Array.from({length:3},(_,i)=>({id:`a${i}`,schoolId:i===0?'escolaA':'escolaB',primeiraAula:'2026-01-01',status:'concluida',capacidade:20,compartilhar:true,baseAtualizadaEm:'2026-02-15',registros:[{tipo:'palestra',dados:{titulo:'Nome confidencial'}},...Array.from({length:4},(_,j)=>({tipo:'avaliacao',dados:{leadId:`p${i}${j}`,interesse:{estado:'a_confirmar'}}}))]}));
 assert.equal(experienciasDaRede(ciclos.slice(0,2)).length,0);
 const result=experienciasDaRede(ciclos);assert.equal(result.length,1);assert.equal(result[0].interessados,12);assert.equal(result[0].escolas,2);assert.ok(!JSON.stringify(result).includes('escolaA'));assert.ok(!JSON.stringify(result).includes('confidencial'));
 assert.equal(experienciasDaRede(ciclos.map(c=>({...c,compartilhar:false}))).length,0);
});
