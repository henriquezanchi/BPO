/**
 * Anotação de uma aula fora das matérias da turma (pedido do usuário 2026-10-29: palestras, cursos especiais etc.).
 * Fica com a "matéria" AVULSA, o tipo em materiaNome e o título que o aluno escreve no tema.
 */
export const AVULSA = "AVULSA";
export const TIPOS_AVULSA = ["Palestra", "Curso especial", "Seminário", "Aula especial", "Outra"] as const;

/** "29/10/2026 às 17:42", no fuso da filial (o mesmo no servidor e no aparelho). */
export const dataHora = (iso: string, fuso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: fuso })} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso })}`;
};
