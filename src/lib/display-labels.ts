/** Vocabulário de apresentação. Não altera cargos oficiais usados nas permissões. */
export function portalLabel(value:string) {
 return value
  .replace(/da brigada feminina/gi,'do Grupo Feminino')
  .replace(/da brigada masculina/gi,'do Grupo Masculino')
  .replace(/brigada feminina/gi,'Grupo Feminino')
  .replace(/brigada masculina/gi,'Grupo Masculino')
  .replace(/brigadistas/gi,'voluntários')
  .replace(/brigadista/gi,'voluntário')
  .replace(/das brigadas/gi,'dos grupos')
  .replace(/da brigada/gi,'do grupo')
  .replace(/brigadas/gi,'grupos')
  .replace(/brigada/gi,'grupo');
}
