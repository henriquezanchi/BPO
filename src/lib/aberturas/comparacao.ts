import 'server-only';
import {db} from '@/lib/db';
import {eventScopeWhere} from '@/lib/event-policy';
import {compararHorarios,type DiaSemana,type ConflitoHorario,type AtribuicaoHorario,type HistoricoAbertura} from './planejador';
import type {AberturaTurma} from '@prisma/client';
import type {ResumoFilialDados} from '@/lib/mercurio-db/resumo-filial';
const local=(d:Date)=>d.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const mins=(d:Date)=>{const [h,m]=d.toLocaleTimeString('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).split(':').map(Number);return h*60+m;};
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/-feira/g,'').trim();
const dias:Record<string,DiaSemana>={domingo:0,segunda:1,terca:2,quarta:3,quinta:4,sexta:5,sabado:6};
const overlap=(a:number,b:number,c:number,d:number)=>a<d&&c<b;
export async function compararPlanejamento(schoolId:string,abertura:AberturaTurma,janela:{janelaInicio:string;janelaFim:string;dias:number[];inicioMinuto:number}){
 const len=(Date.parse(janela.janelaFim)-Date.parse(janela.janelaInicio))/86400000;if(len<0||len>366)throw Error('Compare um período entre um dia e um ano.');
 const de=new Date(janela.janelaInicio+'T00:00:00-03:00'),ate=new Date(janela.janelaFim+'T23:59:59-03:00');
 const school=await db.school.findUniqueOrThrow({where:{id:schoolId}});
 const [disps,escalas,config,eventos,resumo,grupos,outras,concluidas,cache]=await Promise.all([
  db.professorDisponibilidade.findMany({where:{schoolId,habilitado:true}}),db.secretariaEscala.findMany({where:{schoolId}}),db.aberturaConfig.findUnique({where:{schoolId}}),
  db.event.findMany({where:{AND:[eventScopeWhere(school),{status:'publicado',startsAt:{lte:ate},OR:[{endsAt:{gte:de}},{endsAt:null,startsAt:{gte:de}}]}]},select:{id:true,title:true,startsAt:true,endsAt:true,allDay:true}}),
  db.resumoFilial.findUnique({where:{schoolId}}),db.classGroup.findMany({where:{schoolId,tipo:'turma'},include:{memberships:{select:{memberId:true,role:true}}}}),
  db.aberturaTurma.findMany({where:{schoolId,id:{not:abertura.id},status:{in:['planejada','em_curso']}}}),
  db.aberturaTurma.findMany({where:{schoolId,status:'concluida'},include:{registros:true}}),db.aberturaCrmCache.findUnique({where:{schoolId}}),
 ]);
 const opcoes=[...new Set(janela.dias.length?janela.dias:[abertura.diaSemana])].map(d=>({diaSemana:d as DiaSemana,inicioMinuto:janela.inicioMinuto,duracaoMinutos:120 as const}));
 const atribuicoes:AtribuicaoHorario[]=opcoes.flatMap(o=>abertura.professorIds.map(pessoaId=>({...o,pessoaId,funcao:'titular',estado:(o.diaSemana===abertura.diaSemana&&o.inicioMinuto===abertura.inicioMinuto?'confirmado':'previsto') as 'confirmado'|'previsto'})));
 const conflitos:ConflitoHorario[]=[];
 // Um evento sem fim conhecido gera atenção conservadora de 2h.
 for(const e of eventos){let d=local(e.startsAt);const fim=e.endsAt||new Date(e.startsAt.getTime()+7200000);while(d<=local(fim)){const inicioMinuto=e.allDay||d!==local(e.startsAt)?0:mins(e.startsAt);const fimMinuto=e.allDay||d!==local(fim)?1440:mins(fim);if(fimMinuto>inicioMinuto)conflitos.push({id:e.id,tipo:'evento',data:d,inicioMinuto,fimMinuto,motivo:e.title});d=new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10);}}
 const turmas=(resumo?.dados as unknown as ResumoFilialDados|undefined)?.turmas?.lista;
 const ocupacaoPorHorario=turmas?opcoes.map(o=>({diaSemana:o.diaSemana,inicioMinuto:o.inicioMinuto,ocupados:abertura.capacidade+turmas.filter(t=>dias[norm(t.dia)]===o.diaSemana&&/^\d{2}:\d{2}$/.test(t.horario)&&overlap(Number(t.horario.slice(0,2))*60+Number(t.horario.slice(3)),Number(t.horario.slice(0,2))*60+Number(t.horario.slice(3))+120,o.inicioMinuto,o.inicioMinuto+120)).reduce((s,t)=>s+t.alunos+t.instrutores,0),capacidade:config?.capacidadeEscola??null})):undefined;
 for(let d=janela.janelaInicio;d<=janela.janelaFim;d=new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10)){
  const dia=new Date(d+'T12:00:00Z').getUTCDay();
  for(const t of turmas??[]){if(dias[norm(t.dia)]!==dia||!/^\d{2}:\d{2}$/.test(t.horario))continue;const ini=Number(t.horario.slice(0,2))*60+Number(t.horario.slice(3));const grupo=grupos.find(g=>g.name===t.turma||g.mercurioClassId===t.turma);for(const m of grupo?.memberships??[]){if(m.role==='professor')conflitos.push({tipo:'professor',professorId:m.memberId,data:d,inicioMinuto:ini,fimMinuto:Math.min(1440,ini+120),motivo:`Aula ${t.turma}`});else conflitos.push({tipo:'escala',pessoaId:m.memberId,data:d,inicioMinuto:ini,fimMinuto:Math.min(1440,ini+120),motivo:`Aluno em aula ${t.turma}`});}if(grupo?.local&&grupo.local===abertura.sala)conflitos.push({tipo:'aula',data:d,inicioMinuto:ini,fimMinuto:Math.min(1440,ini+120),motivo:`Sala ocupada: ${t.turma}`});}
  for(const o of outras.filter(o=>o.diaSemana===dia&&local(o.primeiraAula)<=d)){for(const professorId of o.professorIds)conflitos.push({tipo:'professor',professorId,data:d,inicioMinuto:o.inicioMinuto,fimMinuto:o.inicioMinuto+120,motivo:`Turma planejada: ${o.titulo}`});if(o.sala===abertura.sala)conflitos.push({tipo:'aula',data:d,inicioMinuto:o.inicioMinuto,fimMinuto:o.inicioMinuto+120,motivo:`Sala reservada: ${o.titulo}`});}
  for(const e of escalas.filter(e=>e.diaSemana===dia&&e.confirmado&&abertura.professorIds.includes(e.memberId)&&e.validaDe<=d&&e.validaAte>=d))conflitos.push({tipo:'escala',pessoaId:e.memberId,data:d,inicioMinuto:e.inicioMinuto,fimMinuto:e.fimMinuto,motivo:`${e.secretaria}: ${e.funcao}`});
 }
 for(const o of opcoes){
  const docentes=[...new Set(disps.map(d=>d.professorId))].filter(id=>!abertura.professorIds.includes(id));for(const pessoaId of docentes){
   let livre=true;for(let d=janela.janelaInicio;d<=janela.janelaFim;d=new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10)){if(new Date(d+'T12:00:00Z').getUTCDay()!==o.diaSemana)continue;
    const cobre=disps.some(a=>a.professorId===pessoaId&&a.diaSemana===o.diaSemana&&a.validaDe<=d&&a.validaAte>=d&&a.inicioMinuto<=o.inicioMinuto&&a.fimMinuto>=o.inicioMinuto+120&&!(a.impedimentos as unknown as {data:string;inicioMinuto:number;fimMinuto:number}[]).some(i=>i.data===d&&overlap(i.inicioMinuto,i.fimMinuto,o.inicioMinuto,o.inicioMinuto+120)));
    if(!cobre||conflitos.some(c=>(c.tipo==='professor'&&c.professorId===pessoaId||c.tipo==='escala'&&c.pessoaId===pessoaId)&&c.data===d&&overlap(c.inicioMinuto,c.fimMinuto,o.inicioMinuto,o.inicioMinuto+120)))livre=false;
   }if(livre)atribuicoes.push({...o,pessoaId,funcao:'suplente',estado:'previsto'});
  }
  for(const e of escalas.filter(e=>e.diaSemana===o.diaSemana&&e.inicioMinuto<=o.inicioMinuto&&e.fimMinuto>=o.inicioMinuto+120&&e.validaDe<=janela.janelaFim&&e.validaAte>=janela.janelaInicio))if(!atribuicoes.some(a=>a.diaSemana===o.diaSemana&&a.inicioMinuto===o.inicioMinuto&&a.pessoaId===e.memberId&&a.funcao===e.funcao))atribuicoes.push({...o,pessoaId:e.memberId,funcao:e.funcao,estado:e.confirmado&&e.validaDe<=janela.janelaInicio&&e.validaAte>=janela.janelaFim?'confirmado':'previsto'});
 }
 const historico:HistoricoAbertura={porDiaSemana:{},porMes:{}};
 for(const a of concluidas){const matriculas=new Set(a.registros.filter(r=>r.tipo==='resultado'&&(r.dados as Record<string,unknown>).status==='matriculado').map(r=>String((r.dados as Record<string,unknown>).mercurioId))).size;const leads=new Set(a.registros.filter(r=>r.tipo==='avaliacao').map(r=>String((r.dados as Record<string,unknown>).leadId))).size;const investimentoCentavos=a.registros.filter(r=>r.tipo==='despesa'&&!(r.dados as Record<string,unknown>).previsto).reduce((s,r)=>s+Number((r.dados as Record<string,unknown>).valorCentavos||0),0);const mes=local(a.primeiraAula).slice(0,7);for(const [map,key] of [[historico.porDiaSemana!,a.diaSemana],[historico.porMes!,mes]] as const){const m=map as Record<string,{amostra:number;matriculas:number;leads:number;investimentoCentavos:number}>;const k=String(key);m[k]??={amostra:0,matriculas:0,leads:0,investimentoCentavos:0};m[k].amostra++;m[k].matriculas+=matriculas;m[k].leads+=leads;m[k].investimentoCentavos+=investimentoCentavos;}}
 const locais=await db.aberturaRegistro.findMany({where:{aberturaId:abertura.id,tipo:'sinal'},orderBy:{createdAt:'asc'}});
 const disponibilidadeLeads=new Map<string,boolean>();
 for(const r of locais){const s=r.dados as Record<string,unknown>,h=s.contextoHorario as {diaSemana?:number;inicioMinuto?:number}|undefined;if(s.tipo==='disponibilidade_confirmada'&&s.natureza==='declarado'&&typeof s.valor==='boolean'&&h?.diaSemana===abertura.diaSemana&&h.inicioMinuto===abertura.inicioMinuto)disponibilidadeLeads.set(String(s.leadId),s.valor);}
 const leads=opcoes.filter(o=>o.diaSemana===abertura.diaSemana&&o.inicioMinuto===abertura.inicioMinuto&&disponibilidadeLeads.size>0).map(o=>({...o,amostra:disponibilidadeLeads.size,confirmados:[...disponibilidadeLeads.values()].filter(Boolean).length,previstos:0}));
 // Para mês do ano, reunimos aberturas registradas em anos diferentes.
 const mesesOriginais=Object.entries(historico.porMes!);
 for(const mes of [...new Set(Array.from({length:len+1},(_,i)=>new Date(Date.parse(janela.janelaInicio+'T12:00:00Z')+i*86400000).toISOString().slice(0,7)))]){
  const amostras=mesesOriginais.filter(([chave])=>chave.slice(5)===mes.slice(5)).map(([,h])=>h);
  if(amostras.length)historico.porMes![mes]=amostras.reduce((t,h)=>({amostra:t.amostra+h.amostra,matriculas:t.matriculas+h.matriculas,leads:t.leads+h.leads,investimentoCentavos:t.investimentoCentavos+h.investimentoCentavos}),{amostra:0,matriculas:0,leads:0,investimentoCentavos:0});
 }
 const resultado=compararHorarios({janelaInicio:janela.janelaInicio,janelaFim:janela.janelaFim,opcoes,professoresHabilitados:[...new Set(disps.map(d=>d.professorId))].map(id=>({id})),disponibilidadesDocentes:disps.map(d=>({professorId:d.professorId,diaSemana:d.diaSemana as DiaSemana,inicioMinuto:d.inicioMinuto,fimMinuto:d.fimMinuto,validoDe:d.validaDe,validoAte:d.validaAte,impedimentos:d.impedimentos as unknown as {data:string;inicioMinuto:number;fimMinuto:number}[]})),conflitos,atribuicoes,ocupacaoPorHorario,historico,leads});
 for(const o of resultado.opcoes){for(const funcao of config?.funcoesNecessarias??[]){if(!o.indicadores.voluntarios.confirmados.some(v=>v.funcao===funcao)){o.motivos.pendencias.push({codigo:'apoio_a_confirmar',descricao:`Confirmar escala de ${funcao} durante o período.`});if(o.situacao==='viavel')o.situacao='pendente';}}
 if(!turmas){o.motivos.pendencias.push({codigo:'agenda_academica_desconhecida',descricao:'Ocupação acadêmica ainda não importada.'});if(o.situacao==='viavel')o.situacao='pendente';}}
 resultado.viaveis=resultado.viaveis.filter(o=>o.situacao==='viavel');
 return {...resultado,baseAcademica:(resumo?.dados as unknown as ResumoFilialDados|undefined)?.atualizacaoMercurio??null,crmAtualizadoEm:cache?.sincronizadoEm.toISOString()??null};
}
