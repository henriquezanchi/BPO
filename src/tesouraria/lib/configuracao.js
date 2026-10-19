// Configuração e escolhas de cada rodada (credencial universal, login
// individual, filial, caixa) — separado de lib/executor.js pra quem só
// precisa disso (o servidor web, em toda requisição) não carregar o
// Playwright junto. Na Vercel isso pesa: cada função que sobe do zero
// carregava o navegador inteiro até pra salvar uma regra.

// Só a autenticação HTTP universal (popup cinza, compartilhada pela
// organização inteira) continua obrigatória no .env — filial, caixa e
// login individual agora são escolhidos na tela (com fallback pro .env só
// pra quem preferir continuar guardando ali, uso avançado do CLI).
const CAMPOS_OBRIGATORIOS = [
  'MERCURIO_HTTP_USER',
  'MERCURIO_HTTP_PASS',
];

export function validarEnv(env) {
  return CAMPOS_OBRIGATORIOS.filter((c) => !env[c]);
}

// O login individual (matrícula + senha) é pedido a cada rodada — vem por
// `credenciais` (passado explicitamente por quem chama: o formulário da
// tela web, ou um prompt no terminal), com fallback pras variáveis do .env
// só pra quem preferir continuar guardando ali (uso avançado do CLI).
export function resolverCredenciais(credenciais, env = process.env) {
  const matricula = credenciais?.matricula || env.MERCURIO_MATRICULA;
  const senha = credenciais?.senha || env.MERCURIO_SENHA;
  if (!matricula || !senha) {
    throw new Error('Matrícula e senha do Mercúrio (login individual) não informadas.');
  }
  return { matricula, senha };
}

// A filial é UMA só por execução (você loga e trabalha na Tesouraria de
// uma filial de cada vez) — vem do parâmetro `filial`, com fallback pro
// .env.
export function resolverFilial(filial, env = process.env) {
  const nome = filial || env.MERCURIO_FILIAL;
  if (!nome) throw new Error('Filial não informada — escolha uma na tela (ou defina MERCURIO_FILIAL no .env).');
  return nome;
}

// Diferente da filial, o CAIXA pode variar POR TRANSAÇÃO (usuário pode
// escolher um caixa padrão pro lote inteiro e trocar em linhas
// específicas) — por isso recebe a própria transação, não só as opções
// globais. Prioridade: caixa da transação > caixa padrão escolhido na tela
// > MERCURIO_CAIXA do .env (uso avançado do CLI).
export function resolverCaixa(transacao, caixaPadrao, env = process.env) {
  const nome = transacao?.caixa || caixaPadrao || env.MERCURIO_CAIXA;
  if (!nome) throw new Error('Caixa não informado pra essa transação — escolha um caixa padrão (ou um específico pra essa linha) na tela.');
  return nome;
}
