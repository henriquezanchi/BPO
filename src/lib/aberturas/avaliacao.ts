import 'server-only';
import {consultarCrmAberturas} from './crm';
import {db} from '@/lib/db';
import {createHash} from 'node:crypto';
import './propensao-modelo.js';
import type {AberturaTurma} from '@prisma/client';
type Sinal=Record<string,unknown>;
type Motor={avaliar(input:{sinais:Sinal[];abertura:Record<string,unknown>;agora:string;versao:string;preferenciaContato:Record<string,unknown>}):Record<string,unknown>};
const motor=()=>(globalThis as unknown as {PropensaoModelo:Motor}).PropensaoModelo;
export function avaliarFatos(sinais:Sinal[],abertura:Record<string,unknown>,agora=new Date().toISOString(),preferenciaContato:Record<string,unknown>={}){
 return motor().avaliar({sinais,abertura,agora,versao:'1',preferenciaContato});
}
export async function avaliarLeadAbertura(abertura:AberturaTurma,leadId:string,permitirPosResultado=false){
 let fonteAtualizada=false;try{const fresh=await consultarCrmAberturas(abertura.schoolId);await db.aberturaCrmCache.upsert({where:{schoolId:abertura.schoolId},create:{schoolId:abertura.schoolId,dados:fresh},update:{dados:fresh,sincronizadoEm:new Date()}});fonteAtualizada=true;}catch{}
 const cache=await db.aberturaCrmCache.findUnique({where:{schoolId:abertura.schoolId}});
 const crm=cache?.dados as {matriculas?:{leadId?:string;data?:string}[];leads?:{id:string;sinais?:Sinal[];naoContatar?:boolean;preferenciaContatoEm?:string|null}[];baseAtualizadaEm?:string}|undefined;
 const jaMatriculado=!!crm?.matriculas?.some(m=>String(m.leadId)===leadId&&m.data&&Date.parse(m.data)<=Date.now());
 if(jaMatriculado&&!permitirPosResultado)throw Error('Já existe matrícula acadêmica para esta pessoa. Uma avaliação atual não pode ser registrada como previsão anterior à matrícula.');
 const registros=await db.aberturaRegistro.findMany({where:{tipo:'sinal',abertura:{schoolId:abertura.schoolId},dados:{path:['leadId'],equals:leadId}},orderBy:{createdAt:'asc'}});
 const sinais=[...(crm?.leads?.find(l=>String(l.id)===leadId)?.sinais??[]),...registros.map(r=>({...r.dados as Sinal,responsavel:r.autorId,aberturaId:r.aberturaId,registradoEm:r.createdAt.toISOString()}))];
 const contexto={id:abertura.id,diaSemana:abertura.diaSemana,inicioMinuto:abertura.inicioMinuto,primeiraAula:abertura.primeiraAula.toISOString()};
 const lead=crm?.leads?.find(l=>String(l.id)===leadId);
 const snapshot=avaliarFatos(sinais,contexto,undefined,{naoContatar:lead?.naoContatar===true,atualizadoEm:lead?.preferenciaContatoEm||null});
 if(!fonteAtualizada&&(snapshot.proximaAcao as {codigo?:string})?.codigo!=='respeitar_nao_contatar')snapshot.proximaAcao={codigo:'conferir_preferencia_atual',motivo:'Confira a preferência de contato atual na base de interessados antes de realizar qualquer contato; a consulta recente não foi confirmada.'};
 return {...snapshot,sinais,abertura:contexto,baseAcademica:crm?.baseAtualizadaEm??null,fingerprint:createHash('sha256').update(JSON.stringify({sinais,contexto})).digest('hex'),preResultado:!jaMatriculado};
}
