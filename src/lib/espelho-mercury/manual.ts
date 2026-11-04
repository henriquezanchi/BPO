import type { TipoAcao } from "./tipos";

/**
 * Como fazer cada ação À MÃO no Mercúrio antigo (pedido do usuário 04/11/2026: "garanta que fique registrado tudo
 * o que precisa ser feito no sistema antigo, para que façamos manualmente se o robô não puder"). Vale também para
 * o que o robô sabe fazer, caso ele falhe. A mesma lista está em docs/ESPELHO-MERCURIO-PROCEDIMENTOS.md; ao mudar
 * aqui, mudar lá.
 *
 * Caminhos marcados "A CONFIRMAR" são telas que o robô ainda não percorreu: quem fizer pela primeira vez anota o
 * caminho certo aqui e no documento.
 */
export const PROCEDIMENTOS: Record<TipoAcao, { titulo: string; robo: "sim" | "nao" | "parcial"; passos: string[] }> = {
  incluir_aluno: {
    titulo: "Cadastrar aluno novo",
    robo: "nao",
    passos: [
      "Primeiro procure a matrícula em CADASTRO da filial → Inativos. Se ela estiver lá, é reingresso (veja \"Reativar aluno\"), não cadastro novo.",
      "Mercúrio antigo → CADASTRO da filial → inclusão de novo cadastro (A CONFIRMAR: nome exato do botão/menu).",
      "Use EXATAMENTE a matrícula do Mercúrio novo. Se o antigo não deixar escolher o número, pare e avise: a matrícula vai divergir entre os dois sistemas.",
      "Preencha nome, data de ingresso, nível e turma; depois as abas ENDEREÇOS, PESSOAIS e IDENTIFICAÇÃO com os dados abaixo.",
      "Monte a composição da contribuição (Tesouraria → composição do aluno) com os itens abaixo.",
    ],
  },
  conflito_matricula: {
    titulo: "Matrícula em conflito",
    robo: "nao",
    passos: [
      "Não lance nada para esta pessoa até resolver.",
      "Se é a mesma pessoa em outra unidade: faça a transferência para esta filial no antigo (A CONFIRMAR: caminho da transferência).",
      "Se é outra pessoa: a matrícula foi gerada em duplicidade. Avise o Gabriel (Mercúrio novo) e o João Guilherme (antigo).",
    ],
  },
  ausente_no_novo: {
    titulo: "Ativo no antigo, ausente no novo",
    robo: "nao",
    passos: [
      "Confira no Mercúrio novo se a pessoa foi migrada (busca por nome e por matrícula).",
      "Se saiu da escola: inative no novo; na próxima rodada o Portal pede a inativação no antigo.",
      "Se ficou fora da migração: peça ao Gabriel para incluir.",
    ],
  },
  inativar: {
    titulo: "Inativar aluno",
    robo: "nao",
    passos: [
      "Mercúrio antigo → CADASTRO da filial → Ativos → clique no nome.",
      "Faça a baixa/inativação com a data e o motivo abaixo (A CONFIRMAR: aba/botão da baixa, provavelmente HISTÓRICO).",
    ],
  },
  reativar: {
    titulo: "Reativar aluno (reingresso)",
    robo: "nao",
    passos: [
      "Mercúrio antigo → CADASTRO da filial → Inativos → clique no nome.",
      "Registre o reingresso (A CONFIRMAR: caminho exato) e confira nível e turma.",
    ],
  },
  alterar_nivel: {
    titulo: "Alterar nível",
    robo: "nao",
    passos: ["Mercúrio antigo → CADASTRO da filial → Ativos → clique no nome.", "Troque o nível para o valor correto abaixo e grave (A CONFIRMAR: em que aba fica o nível)."],
  },
  alterar_turma: {
    titulo: "Alterar turma",
    robo: "nao",
    passos: [
      "Mercúrio antigo → CADASTRO da filial → Turmas → abra a turma correta e inclua o aluno; ou pela ficha do aluno (A CONFIRMAR).",
      "Se a turma ainda não existe no antigo, crie a turma primeiro (veja \"Criar turma\").",
    ],
  },
  alterar_ingresso: {
    titulo: "Corrigir data de ingresso",
    robo: "nao",
    passos: ["Mercúrio antigo → CADASTRO da filial → Ativos → clique no nome.", "Corrija a data de ingresso para a data abaixo e grave (A CONFIRMAR: aba)."],
  },
  atualizar_contato: {
    titulo: "Atualizar contato",
    robo: "sim",
    passos: [
      "Mercúrio antigo → CADASTRO da filial → Ativos → clique no nome → aba ENDEREÇOS.",
      "Celular/WhatsApp vai em DDD + Fone; telefone alternativo em DDD + Celular (campos da direita); e-mail, cidade e UF nos campos com esse nome.",
      "Clique em Gravar.",
    ],
  },
  atualizar_dados_pessoais: {
    titulo: "Atualizar dados pessoais",
    robo: "sim",
    passos: [
      "Mercúrio antigo → CADASTRO da filial → Ativos → clique no nome.",
      "Aba PESSOAIS: nascimento (dia/mês/ano), naturalidade, estado civil, escolaridade, profissão. Gravar.",
      "Aba IDENTIFICAÇÃO: RG. Gravar.",
    ],
  },
  incluir_item_composicao: {
    titulo: "Incluir item na composição",
    robo: "sim",
    passos: [
      "Mercúrio antigo → ficha do aluno → Composição das Contribuições (Tesouraria, tela tes_conedit).",
      "Inclua o item abaixo e ajuste o valor para o indicado. Gravar.",
    ],
  },
  excluir_item_composicao: {
    titulo: "Excluir item da composição",
    robo: "sim",
    passos: ["Mercúrio antigo → ficha do aluno → Composição das Contribuições.", "Exclua o item abaixo (ele não existe mais no Mercúrio novo)."],
  },
  editar_valor_composicao: {
    titulo: "Alterar valor na composição",
    robo: "sim",
    passos: ["Mercúrio antigo → ficha do aluno → Composição das Contribuições.", "Altere o valor do item abaixo para o valor correto. Gravar."],
  },
  composicao_sem_correspondencia: {
    titulo: "Composição sem correspondência",
    robo: "nao",
    passos: [
      "Os nomes dos itens no Mercúrio novo não batem com o catálogo do antigo.",
      "Na Composição das Contribuições do antigo, escolha o item equivalente e ajuste o valor, conferindo o total final com o do novo.",
      "Se for sempre o mesmo nome divergente, avise para o Portal aprender a correspondência.",
    ],
  },
  lancar_contribuicao: {
    titulo: "Lançar pagamento de contribuição",
    robo: "parcial",
    passos: [
      "Mercúrio antigo → TESOURARIA da filial → Caixas → escolha o caixa da filial → navegue até o mês → abra o DIA DO PAGAMENTO (abaixo).",
      "Recebimento → Contribuições → digite a matrícula → marque o(s) mês(es) abaixo → confira o total com o valor abaixo → Lançar.",
      "Finalize o recibo. Se o dia já estiver fechado, lance no dia de hoje e anote a data real do pagamento na observação.",
      "O robô só faz quando o recibo é de um mês só; recibo com vários meses fica para a secretaria.",
    ],
  },
  lancar_recibo_avulso: {
    titulo: "Lançar recibo que não é contribuição",
    robo: "nao",
    passos: [
      "Veja no Mercúrio novo o recibo indicado (número abaixo) para saber a rubrica (evento, doação, livraria...).",
      "Mercúrio antigo → TESOURARIA → Caixas → dia do pagamento → Recebimento → escolha a mesma rubrica, mesmo valor e mesmo interessado.",
    ],
  },
  cancelar_recibo: {
    titulo: "Cancelar recibo",
    robo: "nao",
    passos: [
      "Confira no novo que o cancelamento é mesmo definitivo: cancelar no antigo não tem volta.",
      "Mercúrio antigo → TESOURARIA → Recibos Emitidos → mês do recibo → abra o recibo do antigo indicado abaixo → cancelar (A CONFIRMAR: botão).",
    ],
  },
  criar_turma: {
    titulo: "Criar turma",
    robo: "nao",
    passos: ["Mercúrio antigo → CADASTRO da filial → Turmas → nova turma (A CONFIRMAR: botão).", "Use o mesmo nome, nível, dia e horário do Mercúrio novo (abaixo)."],
  },
  lancar_movimento_mes: {
    titulo: "Conferir movimento do caixa do mês",
    robo: "nao",
    passos: [
      "O Mercúrio novo só informa os totais por rubrica do mês (abaixo), não cada lançamento.",
      "Recibos de alunos já aparecem como pendências separadas. Aqui o que importa são as SAÍDAS (despesas) e entradas que não são recibo de aluno.",
      "Mercúrio antigo → TESOURARIA → Caixas → lance cada despesa no dia em que ocorreu (pegue os detalhes no Mercúrio novo) até os totais por rubrica baterem.",
    ],
  },
  conferir_funcoes: {
    titulo: "Conferir função/cargo",
    robo: "nao",
    passos: ["A pessoa tem cargo no Mercúrio novo e nenhuma função atual no antigo.", "Mercúrio antigo → ficha da pessoa → funções de dirigente (A CONFIRMAR) → inclua a função com a data de início."],
  },
};
