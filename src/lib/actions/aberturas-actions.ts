'use server';
import {caminhoSecretaria} from '@/lib/secretarias-rede/destinos';
import {db} from '@/lib/db';
import {getAuthenticatedMember} from '@/lib/auth';
import {carregarContextoSecretaria,podeGerirEscalaSecretaria} from '@/lib/secretarias-rede/acesso';
import {exigirAberturas} from '@/lib/aberturas/permissoes';
import {dataLocal,minuto,centavos,registroSchemas} from '@/lib/aberturas/validacao';
import {consultarCrmAberturas} from '@/lib/aberturas/crm';
import {sincronizarAberturasEscola} from '@/lib/aberturas/sincronizacao';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';

const field=(f:FormData,k:string)=>String(f.get(k)||'').trim();
const texto=(s:string,max=200)=>z.string().min(1).max(max).parse(s);
const inteiro=(s:string,min:number,max:number)=>z.coerce.number().int().min(min).max(max).parse(s);
const revisao=(f:FormData)=>inteiro(field(f,'revisao'),0,2147483646);
function falha(e:unknown){return {ok:false,error:e instanceof z.ZodError?'Confira os campos: '+e.issues.map(i=>i.path.join('.')||i.message).slice(0,3).join(', '):e instanceof Error&& !('code' in e)?e.message:'Não foi possível salvar. Atualize a página e tente novamente.'};}
const atualizar=()=>revalidatePath('/voluntario/aberturas');
async function pessoaLocal(id:string,schoolId:string){const p=await db.member.findFirst({where:{id,schoolId,mercurioAtivo:true},select:{id:true}});if(!p)throw Error('Pessoa não está ativa nesta filial.');}
async function abrir(f:FormData){const scope=await exigirAberturas(field(f,'schoolId'));const abertura=await db.aberturaTurma.findFirst({where:{id:field(f,'aberturaId'),schoolId:scope.schoolId},include:{registros:{orderBy:{createdAt:'asc'}}}});if(!abertura)throw Error('Abertura não encontrada nesta filial.');return {...scope,abertura};}

export async function salvarAbertura(f:FormData){try{
 const {member,schoolId}=await exigirAberturas(field(f,'schoolId'));
 const primeira=dataLocal.parse(field(f,'primeiraAula')),diaSemana=inteiro(field(f,'diaSemana'),0,6),inicioMinuto=minuto(field(f,'inicio'));
 if(new Date(primeira+'T12:00:00Z').getUTCDay()!==diaSemana)throw Error('O primeiro dia de aula deve coincidir com o dia semanal escolhido.');
 if(inicioMinuto>1320)throw Error('A aula de duas horas deve terminar até meia-noite.');
 const professorIds=[...new Set(f.getAll('professorIds').map(String))];if(professorIds.length>20)throw Error('Limite de professores excedido.');
 for(const id of professorIds)await pessoaLocal(id,schoolId);
 const capacidade=inteiro(field(f,'capacidade'),1,2000),metaMatriculas=inteiro(field(f,'metaMatriculas'),1,2000);
 if(metaMatriculas>capacidade)throw Error('A meta não pode exceder a capacidade da sala.');
 const status=z.enum(['rascunho','planejada','em_curso','concluida','cancelada']).parse(field(f,'status')||'rascunho');
 if(status!=='rascunho'&&status!=='cancelada'&&professorIds.length<2)throw Error('Selecione pelo menos dois professores para confirmar a abertura.');
 const mercurioTurmaId=field(f,'mercurioTurmaId')||null;
 if(mercurioTurmaId&&mercurioTurmaId.length>100)throw Error('Identificador de turma inválido.');
 const dados={mercurioTurmaId,titulo:texto(field(f,'titulo')),primeiraAula:new Date(primeira+'T'+field(f,'inicio')+':00-03:00'),diaSemana,inicioMinuto,duracaoMinutos:120,capacidade,metaMatriculas,orcamentoCentavos:centavos(field(f,'orcamento')||'0'),sala:texto(field(f,'sala')),status,professorIds};
 const id=field(f,'aberturaId');
 const salvo=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "School" WHERE id=${schoolId} FOR UPDATE`;
  if(['planejada','em_curso'].includes(status)){
   const conflito=await tx.aberturaTurma.findFirst({where:{schoolId,...(id?{id:{not:id}}:{}),status:{in:['planejada','em_curso']},diaSemana,inicioMinuto:{lt:inicioMinuto+120,gt:inicioMinuto-120},OR:[{sala:{equals:dados.sala,mode:'insensitive'}},{professorIds:{hasSome:professorIds}}]},select:{titulo:true}});
   if(conflito)throw Error('Há outra turma planejada com a mesma sala ou professores nesse horário: '+conflito.titulo);
  }
  if(id){const changed=await tx.aberturaTurma.updateMany({where:{id,schoolId,revisao:revisao(f)},data:{...dados,revisao:{increment:1}}});if(changed.count!==1)throw Error('A abertura foi alterada por outra pessoa. Atualize a página.');await tx.aberturaRegistro.create({data:{aberturaId:id,autorId:member.id,tipo:'alteracao',dados:{...dados,primeiraAula:dados.primeiraAula.toISOString()}}});return id;}
  const created=await tx.aberturaTurma.create({data:{...dados,schoolId,autorId:member.id,registros:{create:[{autorId:member.id,tipo:'tarefa',dados:{titulo:'Confirmar equipe docente e substituições',status:'pendente',prazo:primeira}},{autorId:member.id,tipo:'tarefa',dados:{titulo:'Planejar palestras culturais e divulgação',status:'pendente',prazo:primeira}},{autorId:member.id,tipo:'tarefa',dados:{titulo:'Organizar acolhimento e conferir matrículas no Mercúrio',status:'pendente',prazo:primeira}}]}}});return created.id;
 });atualizar();return {ok:true,id:salvo};
 }catch(e){return falha(e);}}

export async function registrarAbertura(f:FormData){try{
 const {member,schoolId,abertura}=await abrir(f);const tipo=field(f,'tipo');
 if(!(tipo in registroSchemas))throw Error('Tipo de registro inválido.');
 const parsed=JSON.parse(field(f,'dados'));const dados=registroSchemas[tipo as keyof typeof registroSchemas].parse(parsed) as Record<string,unknown>;
 if(tipo==='palestra'){
  if(new Date(String(dados.inicio))>=abertura.primeiraAula)throw Error('Palestra do ciclo deve ocorrer antes do primeiro dia de aula.');
  if(dados.eventoId&&!await db.event.findFirst({where:{id:String(dados.eventoId),schoolId}}))throw Error('Evento não pertence à filial.');
 }
 if(tipo==='tarefa'&&dados.responsavelId)await pessoaLocal(String(dados.responsavelId),schoolId);
 if(tipo==='despesa')dados.valorCentavos=centavos(String(dados.valor));
 if(tipo==='sinal'||tipo==='avaliacao'){
  const cache=await db.aberturaCrmCache.findUnique({where:{schoolId}});const crm=cache?.dados as {leads?:{id:string}[]}|undefined;
  if(!crm?.leads?.some(l=>String(l.id)===String(dados.leadId)))throw Error('Atualize o CRM e selecione um interessado desta filial.');
 }
 if(tipo==='sinal'){
  dados.aberturaId=abertura.id;dados.responsavel=member.id;dados.contextoHorario={diaSemana:abertura.diaSemana,inicioMinuto:abertura.inicioMinuto};
  if(new Date(String(dados.occurredAt)).getTime()>Date.now()+60000)throw Error('O acontecimento não pode estar no futuro.');
  if(dados.tipo==='resultado_atendimento'&&!['adiou','sem_interesse','horario_incompativel','contato_invalido'].includes(String(dados.valor)))throw Error('Resultado de atendimento inválido; matrícula exige confirmação acadêmica.');
 }
 if(tipo==='avaliacao'){
  const {avaliarLeadAbertura}=await import('@/lib/aberturas/avaliacao');
  Object.assign(dados,await avaliarLeadAbertura(abertura,String(dados.leadId)));
 }
 if(tipo==='resultado'){
  const cache=await db.aberturaCrmCache.findUnique({where:{schoolId}});const crm=cache?.dados as {matriculas?:{mercurioId:string;data?:string;leadId?:string;turmaId?:string}[]}|undefined;
  if(!abertura.mercurioTurmaId)throw Error('Vincule a abertura ao código exato da turma no Mercúrio antes de confirmar matrículas.');
  const match=crm?.matriculas?.filter(m=>String(m.mercurioId)===String(dados.mercurioId)&&String(m.turmaId)===abertura.mercurioTurmaId);
  if(dados.leadId&&!match?.some(m=>String(m.leadId)===String(dados.leadId)))throw Error('O interessado não corresponde à identidade acadêmica confirmada.');
  dados.turmaId=abertura.mercurioTurmaId;
  if(!match?.length)throw Error('Matrícula ainda não foi localizada na fonte acadêmica desta filial. Atualize o CRM.');
  if(dados.status==='matriculado'&&!match.some(m=>m.data?.slice(0,10)===dados.data))throw Error('A data deve coincidir com a matrícula acadêmica confirmada.');
  dados.fonte=dados.status==='matriculado'?'mercurio':'registro_local';dados.confirmadoEm=new Date().toISOString();
 }
 await db.$transaction(async tx=>{
  const changed=await tx.aberturaTurma.updateMany({where:{id:abertura.id,schoolId,revisao:revisao(f)},data:{revisao:{increment:1}}});if(changed.count!==1)throw Error('A abertura foi alterada. Atualize a página antes de registrar.');
  await tx.aberturaRegistro.create({data:{aberturaId:abertura.id,autorId:member.id,tipo,dados:dados as Prisma.InputJsonValue}});
 });
 if(tipo==='sinal'){
  const {avaliarLeadAbertura}=await import('@/lib/aberturas/avaliacao');
  const snapshot={leadId:String(dados.leadId),...await avaliarLeadAbertura(abertura,String(dados.leadId),true)};
  await db.$transaction([db.aberturaRegistro.create({data:{aberturaId:abertura.id,autorId:member.id,tipo:'avaliacao',dados:snapshot as Prisma.InputJsonValue}}),db.aberturaTurma.update({where:{id:abertura.id},data:{revisao:{increment:1}}})]);
  try{await consultarCrmAberturas(schoolId,{aberturaId:abertura.id,abertura:snapshot.abertura,avaliacoes:[{leadId:snapshot.leadId,sinais:snapshot.sinais.filter(s=>s.aberturaId===abertura.id),snapshot}]});}
  catch{atualizar();return {ok:true,aviso:'Registro salvo no BPO. A integração CRM ficou pendente; use Atualizar CRM antes de realizar novos contatos.'};}
 }
 atualizar();return {ok:true};
 }catch(e){return falha(e);}}

export async function salvarDisponibilidade(f:FormData){try{
 const {member,schoolId}=await exigirAberturas(field(f,'schoolId'));const professorId=field(f,'professorId');await pessoaLocal(professorId,schoolId);
 const diaSemana=inteiro(field(f,'diaSemana'),0,6),inicioMinuto=minuto(field(f,'inicio')),fimMinuto=minuto(field(f,'fim'));
 const validaDe=dataLocal.parse(field(f,'validaDe')),validaAte=dataLocal.parse(field(f,'validaAte'));
 if(fimMinuto<=inicioMinuto||validaAte<validaDe)throw Error('Intervalo de disponibilidade inválido.');
 const impedimentos=z.array(z.object({data:dataLocal,inicioMinuto:z.number().int().min(0).max(1439),fimMinuto:z.number().int().min(1).max(1440)})).max(500).parse(JSON.parse(field(f,'impedimentos')||'[]'));
 if(impedimentos.some(i=>i.fimMinuto<=i.inicioMinuto))throw Error('Impedimento com horário inválido.');
 const data={schoolId,professorId,diaSemana,inicioMinuto,fimMinuto,validaDe,validaAte,impedimentos,habilitado:f.get('habilitado')==='true'||f.get('habilitado')==='on',autorId:member.id};
 const id=field(f,'id');if(id){const done=await db.professorDisponibilidade.updateMany({where:{id,schoolId},data});if(!done.count)throw Error('Disponibilidade não encontrada.');}else await db.professorDisponibilidade.create({data});atualizar();return {ok:true};
 }catch(e){return falha(e);}}

export async function salvarEscalaSecretaria(f:FormData){try{
 const member=await getAuthenticatedMember();if(!member?.mercurioAtivo)throw Error('Entre com uma conta ativa.');const schoolId=texto(field(f,'schoolId'));const ctx=await carregarContextoSecretaria(member);
 if(!podeGerirEscalaSecretaria(ctx,field(f,'secretaria'),schoolId))throw Error('Sem permissão para esta escala da secretaria.');
 const memberId=field(f,'memberId');await pessoaLocal(memberId,schoolId);
 const inicioMinuto=minuto(field(f,'inicio')),fimMinuto=minuto(field(f,'fim')),validaDe=dataLocal.parse(field(f,'validaDe')),validaAte=dataLocal.parse(field(f,'validaAte'));
 if(fimMinuto<=inicioMinuto||validaAte<validaDe)throw Error('Intervalo da escala inválido.');
 const data={schoolId,memberId,secretaria:texto(field(f,'secretaria'),100),funcao:texto(field(f,'funcao'),100),diaSemana:inteiro(field(f,'diaSemana'),0,6),inicioMinuto,fimMinuto,validaDe,validaAte,confirmado:['true','on'].includes(field(f,'confirmado')),autorId:member.id};
 const id=field(f,'id');if(id){const old=await db.secretariaEscala.findUnique({where:{id}});if(!old||old.schoolId!==schoolId||!podeGerirEscalaSecretaria(ctx,old.secretaria,schoolId))throw Error('Sem permissão para alterar esta escala.');const changed=await db.secretariaEscala.updateMany({where:{id,schoolId},data});if(!changed.count)throw Error('Escala não encontrada.');}else await db.secretariaEscala.create({data});atualizar();return {ok:true};
 }catch(e){return falha(e);}}

export async function salvarConfigAberturas(f:FormData){try{
 const {schoolId}=await exigirAberturas(field(f,'schoolId'));const capacidadeEscola=field(f,'capacidadeEscola')?inteiro(field(f,'capacidadeEscola'),1,10000):null;
 const funcoesNecessarias=f.getAll('funcoesNecessarias').map(String).join(',').split(',').map(s=>s.trim()).filter(Boolean);if(funcoesNecessarias.length>30||funcoesNecessarias.some(s=>s.length>100))throw Error('Funções necessárias inválidas.');
 await db.aberturaConfig.upsert({where:{schoolId},create:{schoolId,capacidadeEscola,funcoesNecessarias,compartilharAprendizados:['true','on'].includes(field(f,'compartilharAprendizados'))},update:{capacidadeEscola,funcoesNecessarias,compartilharAprendizados:['true','on'].includes(field(f,'compartilharAprendizados')),revisao:{increment:1}}});atualizar();return {ok:true};
 }catch(e){return falha(e);}}
export async function sincronizarCrmAberturas(f:FormData){try{
 const {schoolId}=await exigirAberturas(field(f,'schoolId'));await sincronizarAberturasEscola(schoolId);atualizar();return {ok:true};
 }catch(e){return falha(e);}}
export async function compararHorariosAbertura(f:FormData){try{
 const {schoolId,abertura}=await abrir(f);const {compararPlanejamento}=await import('@/lib/aberturas/comparacao');
 const comparacao=await compararPlanejamento(schoolId,abertura,{janelaInicio:dataLocal.parse(field(f,'janelaInicio')),janelaFim:dataLocal.parse(field(f,'janelaFim')),dias:f.getAll('dias').map(x=>inteiro(String(x),0,6)),inicioMinuto:minuto(field(f,'inicio')||`${String(Math.floor(abertura.inicioMinuto/60)).padStart(2,'0')}:${String(abertura.inicioMinuto%60).padStart(2,'0')}`)});
 return {ok:true,comparacao};
 }catch(e){return falha(e);}}

export async function removerDisponibilidade(f:FormData){try{
 const {schoolId}=await exigirAberturas(field(f,'schoolId'));const done=await db.professorDisponibilidade.deleteMany({where:{id:field(f,'id'),schoolId}});if(!done.count)throw Error('Disponibilidade não encontrada.');atualizar();return {ok:true};
 }catch(e){return falha(e);}}
export async function removerEscalaSecretaria(f:FormData){try{
 const member=await getAuthenticatedMember();if(!member?.mercurioAtivo)throw Error('Entre com uma conta ativa.');const schoolId=field(f,'schoolId');const old=await db.secretariaEscala.findFirst({where:{id:field(f,'id'),schoolId}});const ctx=await carregarContextoSecretaria(member);
 if(!old||!podeGerirEscalaSecretaria(ctx,old.secretaria,schoolId))throw Error('Sem permissão para esta escala.');await db.secretariaEscala.delete({where:{id:old.id}});atualizar();revalidatePath(caminhoSecretaria(old.secretaria).split('?')[0]);return {ok:true};
 }catch(e){return falha(e);}}
