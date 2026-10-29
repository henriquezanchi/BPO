/**
 * Busca de funções do Portal do Aluno (pedido do usuário 2026-10-29: "estamos ficando com muitas funções; um campo de
 * pesquisa que reconheça o que foi digitado, mesmo sem aquela palavra"). Catálogo com títulos, descrições e palavras
 * do dia a dia; a busca local é instantânea (sem acento, tolera erro de digitação) e, quando não acha bem, a tela pede
 * à IA (actions/busca-actions.ts) para escolher entre as funções que a pessoa tem. Sem dados pessoais: só o texto.
 */
export type FuncaoPortal = { id: string; titulo: string; descricao: string; palavras: string[] };

export const FUNCOES_PORTAL: FuncaoPortal[] = [
  { id: "economia", titulo: "Economia", descricao: "Contribuição mensal e carteira Fortuna num lugar só", palavras: ["mensalidade", "pagar", "pagamento", "boleto", "pix", "cartão", "financeiro", "dinheiro", "valor"] },
  { id: "situacao", titulo: "Situação da contribuição", descricao: "Meses pagos e em aberto, comprovantes, pagar com Pix ou cartão, débito automático", palavras: ["atrasado", "atraso", "em dia", "comprovante", "recibo", "segunda via", "vencimento", "pix automático", "débito automático", "quanto devo", "pagar mês"] },
  { id: "contribuicao", titulo: "Minha contribuição", descricao: "Composição da contribuição: incluir, aumentar ou diminuir apoios", palavras: ["composição", "apoio", "doação", "doar", "criança para o bem", "aumentar", "diminuir", "ajudar a escola", "itens"] },
  { id: "fortuna", titulo: "Adicionar créditos no Fortuna", descricao: "Carteira do Café: saldo e recarga", palavras: ["café", "lanche", "cantina", "carteira", "saldo", "crédito", "recarga", "comprar", "lanchonete"] },
  { id: "agenda", titulo: "Agenda e eventos", descricao: "Aulas, eventos, palestras, provas e inscrições", palavras: ["evento", "palestra", "inscrição", "inscrever", "calendário", "aula", "prova", "atividade", "horário", "data", "quando", "programação", "encontro"] },
  { id: "meus_eventos", titulo: "Meus eventos", descricao: "Eventos em que você se inscreveu, cancelamento e reembolso", palavras: ["minhas inscrições", "ingresso", "cancelar inscrição", "desistir", "reembolso", "devolução"] },
  { id: "atendimentos", titulo: "Conversar com meu instrutor", descricao: "Marcar uma conversa individual com o instrutor da turma", palavras: ["conversa", "atendimento", "tirar dúvida", "marcar horário", "falar com professor", "instrutor", "orientação"] },
  { id: "estudos", titulo: "Área de Estudos", descricao: "Biblioteca, Acrópole Play, anotações e livros", palavras: ["estudar", "material", "apostila", "vídeo", "youtube", "conteúdo"] },
  { id: "anotacoes", titulo: "Anotações das aulas", descricao: "Anotar cada tema ou palestra, resumir com IA para a prova e compartilhar", palavras: ["caderno", "anotar", "notas", "resumo", "estudar para a prova", "palestra", "curso especial"] },
  { id: "livros", titulo: "Meus livros", descricao: "Livros que estou lendo e já li", palavras: ["leitura", "livro", "lendo", "lista de leitura"] },
  { id: "play", titulo: "Acrópole Play", descricao: "Séries e cursos em vídeo, com o seu login", palavras: ["vídeos", "assistir", "streaming", "curso online", "série", "documentário"] },
  { id: "biblioteca", titulo: "Biblioteca", descricao: "Acervo da biblioteca da Nova Acrópole", palavras: ["livros", "acervo", "empréstimo", "ler"] },
  { id: "bastioes", titulo: "Bastiões", descricao: "Artigos do diretor internacional e livros em PDF (membros)", palavras: ["artigos", "pdf", "diretor internacional", "textos"] },
  { id: "gaf", titulo: "GAF", descricao: "Grupo de Acompanhamento Filosófico: participar ou ver o seu grupo", palavras: ["acompanhamento filosófico", "grupo", "participar", "texto de trabalho"] },
  { id: "diario", titulo: "Meu diário", descricao: "Prólogo pela manhã, Epílogo à noite e o Fogo Interno", palavras: ["prólogo", "epílogo", "reflexão", "virtude", "fogo interno", "consciência", "escrever", "introspecção", "autoconhecimento"] },
  { id: "diario_historico", titulo: "Histórico do diário", descricao: "Registros do diário mês a mês", palavras: ["dias anteriores", "registros antigos", "mês passado"] },
  { id: "grupos_estudo", titulo: "Grupos de estudo", descricao: "Estudos e leituras comentadas abertos", palavras: ["leitura comentada", "estudo em grupo", "participar"] },
  { id: "voluntariado", titulo: "Voluntariado", descricao: "Oportunidades de ajudar a escola e oferecer apoio", palavras: ["ajudar", "voluntário", "servir", "colaborar", "oportunidade", "apoiar"] },
  { id: "area_voluntario", titulo: "Área do Voluntário", descricao: "Seus grupos, secretarias e funções de voluntário", palavras: ["secretaria", "grupo", "voluntário", "trabalho", "funções"] },
  { id: "pedagogos", titulo: "Turma de pedagogos", descricao: "Escala de apresentações e planos de aula", palavras: ["apresentação", "plano de aula", "pedagogo", "escala", "instrutor"] },
  { id: "avaliacao", titulo: "Avaliação dos instrutores", descricao: "Avaliação anônima das aulas", palavras: ["avaliar", "opinião", "pesquisa", "questionário", "feedback"] },
  { id: "ajuda", titulo: "Ajuda", descricao: "Perguntas frequentes e como resolver problemas", palavras: ["dúvida", "perguntas", "suporte", "senha", "problema", "não consigo", "como faço", "esqueci"] },
  { id: "jornada", titulo: "Minha jornada", descricao: "Conquistas, sequência de meses e histórico na escola", palavras: ["conquistas", "medalhas", "histórico", "trajetória", "sequência", "eventos que participei"] },
  { id: "transparencia", titulo: "Transparência financeira", descricao: "Receitas e despesas da filial", palavras: ["contas da escola", "prestação de contas", "despesas", "receitas", "gastos"] },
  { id: "cadastro", titulo: "Editar meus dados", descricao: "Telefone, endereço, e-mail e foto do cadastro", palavras: ["cadastro", "telefone", "celular", "endereço", "email", "foto", "atualizar dados", "mudei"] },
  { id: "whatsapp", titulo: "Falar com a secretaria", descricao: "WhatsApp da escola", palavras: ["contato", "whatsapp", "secretaria", "atendimento", "falar com alguém", "telefone da escola"] },
  { id: "boletim", titulo: "Boletim Aurora", descricao: "Novidades mensais da Nova Acrópole no Brasil", palavras: ["notícias", "novidades", "jornal", "informativo"] },
];

/** Sem acento, minúsculas, só letras, números e espaço. */
export const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const PALAVRAS_VAZIAS = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "um", "uma", "para", "pra", "com", "meu", "minha", "como", "que", "quero", "onde", "ver", "eu"]);

/** Distância de edição limitada (para tolerar 1 erro em palavras de 4+ letras e 2 em 8+). */
function parecida(a: string, b: string) {
  const limite = a.length >= 8 ? 2 : a.length >= 4 ? 1 : 0;
  if (!limite || Math.abs(a.length - b.length) > limite) return false;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    anterior = atual;
  }
  return anterior[b.length] <= limite;
}

/** Pontua cada função para a consulta; devolve as que casam, da mais provável para a menos. */
export function buscarLocal(consulta: string, funcoes: FuncaoPortal[]) {
  const termos = normalizar(consulta)
    .split(" ")
    .filter((t) => t.length > 1 && !PALAVRAS_VAZIAS.has(t));
  if (!termos.length) return [];
  const frase = normalizar(consulta);
  return funcoes
    .map((f) => {
      const titulo = normalizar(f.titulo);
      const resto = normalizar([f.descricao, ...f.palavras].join(" "));
      const palavrasTitulo = titulo.split(" ");
      const palavrasResto = resto.split(" ");
      let pontos = 0;
      let casados = 0;
      for (const t of termos) {
        const noTitulo = palavrasTitulo.some((p) => p.startsWith(t)) ? 3 : palavrasTitulo.some((p) => parecida(t, p)) ? 2 : 0;
        const noResto = palavrasResto.some((p) => p.startsWith(t)) ? 1.5 : palavrasResto.some((p) => parecida(t, p)) ? 1 : 0;
        const melhor = Math.max(noTitulo, noResto);
        if (melhor) casados++;
        pontos += melhor;
      }
      // Frase inteira de uma palavra-chave ("segunda via", "fogo interno") vale mais.
      if (f.palavras.some((p) => frase.includes(normalizar(p)) && normalizar(p).includes(" "))) pontos += 3;
      return { f, pontos: casados ? pontos * (casados / termos.length) : 0 };
    })
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((x) => ({ funcao: x.f, pontos: x.pontos }));
}
