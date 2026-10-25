import { z } from 'zod';
import { CHAVES_CUSTO } from './categorias';
export const dataLocal=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s,'Data inválida');
export const minuto=(s:unknown)=>{if(typeof s!=='string'||!/^\d{2}:\d{2}$/.test(s))throw Error('Horário inválido.');const [h,m]=s.split(':').map(Number);if(h>23||m>59)throw Error('Horário inválido.');return h*60+m;};
export function centavos(s:unknown){if(typeof s!=='string'||!/^\d+(?:[.,]\d{1,2})?$/.test(s.trim()))throw Error('Informe um valor positivo com até duas casas decimais.');const n=Math.round(Number(s.replace(',','.'))*100);if(!Number.isSafeInteger(n)||n>100000000)throw Error('Valor fora do limite.');return n;}
const texto=z.string().trim().min(1).max(500);
const instante=z.string().max(40).refine(v=>!Number.isNaN(Date.parse(v)),'Data/hora inválida');
export const registroSchemas={
 palestra:z.object({titulo:texto,tema:texto,palestrante:z.string().max(200).optional(),inicio:instante,fim:instante,eventoId:z.string().max(100).optional()}).refine(d=>new Date(d.fim)>new Date(d.inicio),'Fim deve ser posterior ao início'),
 tarefa:z.object({titulo:texto,responsavelId:z.string().max(100).optional(),prazo:dataLocal,status:z.enum(['pendente','em_andamento','concluida']),tarefaId:z.string().max(100).optional()}),
 despesa:z.object({categoria:z.enum(CHAVES_CUSTO),valor:z.union([z.string(),z.number()]),data:dataLocal,descricao:texto,previsto:z.boolean().default(false)}),
 sinal:z.object({leadId:z.string().min(1).max(100),tipo:z.enum(['interesse_declarado','disponibilidade_confirmada','presenca_palestra','outra_atividade','resposta_atendimento','pedido_matricula','nao_contatar','acao_realizada','resultado_atendimento']),valor:z.union([z.boolean(),z.string().max(500),z.array(z.number().int().min(0).max(6)).max(7)]),occurredAt:instante,origem:z.string().min(1).max(100),natureza:z.enum(['declarado','observado','interpretado'])}).superRefine((s,ctx)=>{
  const erro=(message:string)=>ctx.addIssue({code:'custom',message});
  if(s.tipo==='interesse_declarado'&&!['a_confirmar','conhecer','participar','inscrever','depois','nao'].includes(String(s.valor)))erro('Interesse deve ser uma declaração válida.');
  if(['disponibilidade_confirmada','presenca_palestra','outra_atividade','pedido_matricula','nao_contatar'].includes(s.tipo)&&typeof s.valor!=='boolean')erro('Informe sim ou não explicitamente.');
  if(['nao_contatar','disponibilidade_confirmada'].includes(s.tipo)&&s.natureza!=='declarado')erro('Este sinal exige confirmação declarada pela pessoa.');
  if(['acao_realizada','resposta_atendimento'].includes(s.tipo)&&(typeof s.valor!=='string'||!s.valor.trim()||s.valor.length>120))erro('Informe um código curto de até 120 caracteres.');
  if(s.tipo==='resultado_atendimento'&&s.natureza==='interpretado')erro('Resultado de atendimento precisa ser observado ou declarado.');
 }),
 avaliacao:z.object({leadId:z.string().min(1).max(100)}),
 resultado:z.object({mercurioId:z.string().min(1).max(100),data:dataLocal,status:z.enum(['matriculado','presenca30','presenca60','presenca90']),leadId:z.string().max(100).optional(),presente:z.boolean().optional()}),
 aprendizado:z.object({titulo:texto,descricao:z.string().min(1).max(10000),compartilhar:z.boolean().default(false)}),
} as const;

/** Prazo de admissão não restringe observações posteriores de presença. */
export function validarPrazoMatricula(status:unknown,data:unknown,limite:Date|null){
 if(status==='matriculado'&&limite&&String(data)>limite.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}))throw Error('A matrícula está após o prazo de inscrições desta turma.');
}
