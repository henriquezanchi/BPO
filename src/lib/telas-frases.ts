/**
 * Frase da semana das telas de TV (pedido do usuário 2026-10-24). Só autores clássicos, com a
 * obra indicada (nada de atribuição duvidosa de internet). Troca toda segunda-feira, igual em
 * todas as TVs. Para incluir uma frase, cite a fonte.
 */
export const FRASES_TELA: { texto: string; autor: string; obra: string }[] = [
  { texto: "Uma vida sem exame não vale a pena ser vivida.", autor: "Sócrates", obra: "Platão, Apologia" },
  { texto: "Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.", autor: "Sêneca", obra: "Cartas a Lucílio" },
  { texto: "A alma se tinge da cor dos seus pensamentos.", autor: "Marco Aurélio", obra: "Meditações" },
  { texto: "Não são as coisas que perturbam os homens, mas as opiniões que eles têm sobre as coisas.", autor: "Epicteto", obra: "Manual" },
  { texto: "Aprender sem pensar é inútil; pensar sem aprender é perigoso.", autor: "Confúcio", obra: "Analectos" },
  { texto: "O espanto é o princípio da filosofia.", autor: "Platão", obra: "Teeteto" },
  { texto: "Tornamo-nos justos praticando atos justos, moderados praticando atos moderados e corajosos praticando atos corajosos.", autor: "Aristóteles", obra: "Ética a Nicômaco" },
  { texto: "Enquanto estivermos entre os homens, cultivemos a humanidade.", autor: "Sêneca", obra: "Sobre a ira" },
  { texto: "Nunca deixes de esculpir a tua própria estátua.", autor: "Plotino", obra: "Enéadas" },
  { texto: "Quem vence os outros é forte; quem vence a si mesmo é poderoso.", autor: "Lao-Tsé", obra: "Tao Te Ching" },
  { texto: "Ninguém se banha duas vezes no mesmo rio.", autor: "Heráclito", obra: "Fragmentos" },
  { texto: "Vencer a si mesmo é a primeira e a melhor de todas as vitórias.", autor: "Platão", obra: "As Leis" },
  { texto: "Realiza cada ação da tua vida como se fosse a última.", autor: "Marco Aurélio", obra: "Meditações" },
  { texto: "Não é que tenhamos pouco tempo; é que perdemos muito dele.", autor: "Sêneca", obra: "Sobre a brevidade da vida" },
  { texto: "O começo é a parte mais importante do trabalho.", autor: "Platão", obra: "A República" },
  { texto: "Primeiro diz a ti mesmo o que queres ser; depois faz o que tens de fazer.", autor: "Epicteto", obra: "Discursos" },
  { texto: "A jornada de mil léguas começa com um passo.", autor: "Lao-Tsé", obra: "Tao Te Ching" },
  { texto: "Quem tem um porquê para viver suporta quase qualquer como.", autor: "Nietzsche", obra: "Crepúsculo dos Ídolos" },
];

/** Frase da semana corrente (semanas contadas a partir de uma segunda-feira, no fuso de Brasília). */
export function fraseDaSemana(agora = new Date()) {
  const semana = Math.floor((agora.getTime() - 3 * 36e5 - Date.UTC(2026, 0, 5)) / (7 * 864e5));
  return FRASES_TELA[((semana % FRASES_TELA.length) + FRASES_TELA.length) % FRASES_TELA.length];
}
