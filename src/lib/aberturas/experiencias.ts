import {gerarRelatorioAbertura,type AberturaRelatorioInput} from './relatorios';
type Ciclo=AberturaRelatorioInput & {schoolId:string;status:string;capacidade:number;compartilhar:boolean;baseAtualizadaEm?:string|null};
/** Padrões descritivos, por faixa de capacidade e com amostra por grupo.
 * Não recebe nomes de escolas, interessados ou texto livre de aprendizados. */
export function experienciasDaRede(ciclos:Ciclo[]){
 const grupos=new Map<string,{titulo:string;escolas:Set<string>;aberturas:number;leads:number;matriculas:number;gasto:number}>();
 for(const c of ciclos){if(!c.compartilhar||c.status!=='concluida'||!c.baseAtualizadaEm||Date.parse(c.baseAtualizadaEm)<Date.parse(String(c.primeiraAula))+30*86400000)continue;const r=gerarRelatorioAbertura(c);if(!r.leads.denominadorObservado)continue;
 const palestras=c.registros?.filter(r=>r.tipo==='palestra').length??0;if(!palestras)continue;
 const faixa=c.capacidade<=20?'até 20 vagas':c.capacidade<=40?'21 a 40 vagas':'mais de 40 vagas';const quantidade=palestras>=3?'três ou mais palestras':palestras===2?'duas palestras':'uma palestra';const titulo=`Ciclos com ${quantidade}, em turmas de ${faixa}`;
 const g=grupos.get(titulo)??{titulo,escolas:new Set<string>(),aberturas:0,leads:0,matriculas:0,gasto:0};g.escolas.add(c.schoolId);g.aberturas++;g.leads+=r.leads.denominadorObservado;g.matriculas+=r.leads.matriculadosUnicos;g.gasto+=r.despesas.realCentavos;grupos.set(titulo,g);
 }
 return [...grupos.values()].filter(g=>g.aberturas>=3&&g.leads>=10&&g.escolas.size>=2).map(g=>({titulo:g.titulo,aberturas:g.aberturas,escolas:g.escolas.size,interessados:g.leads,matriculas:g.matriculas,conversaoObservada:g.matriculas/g.leads,custoRegistradoPorMatriculaCentavos:g.matriculas?Math.round(g.gasto/g.matriculas):null,sugestao:'Confira os roteiros e materiais publicados na própria secretaria e avalie se este formato cabe na sua escola.',ressalva:'Associação observada, sem comprovação de causa. Divulgação, atendimento e qualidade dos registros também influenciam os resultados.'}));
}
