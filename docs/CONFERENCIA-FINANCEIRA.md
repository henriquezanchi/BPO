# Consulta financeira e conferência dos recebimentos

## Aluno

Em Contribuição, a consulta inclui todos os anos disponíveis e separa atraso registrado, ausência de dados e recebimento confirmado pelo Portal. A atualização exibida é a do registro mais recente recebido; não garante que a importação de toda a escola esteja completa.

O Portal não calcula dívida histórica multiplicando a composição atual pelos meses antigos. Meses sem dados não oferecem pagamento. Pagamentos confirmados pelo gateway prevalecem sobre atraso ainda presente na importação e não geram nova cobrança. A confirmação do Portal não equivale à disponibilidade do comprovante oficial da escola.

Competências posteriores ficam bloqueadas enquanto houver anterior registrada em aberto, inclusive de outro ano. A regra é conferida no servidor ao criar ou recuperar um checkout e antes de criar ciclos de Pix Automático. Cobranças já emitidas no gateway não são canceladas por esta publicação.

## Economia

A página Economia tem a seção **Recebimentos e registro na escola**. A consulta, restrita à escola do responsável de Economia/Direção com cadastro ativo, pagina 50 cobranças por vez e permite alternar entre recebimento confirmado e pagamento pendente.

Cada linha informa nome, competência, valor da contribuição, método e etapa de lançamento. Falha, falta de tarefa e múltiplas tarefas são sinalizadas para conferência. “Lançamento informado pelo sistema” é o retorno da tarefa de integração, não uma nova auditoria independente. A tela é de consulta: não confirma comprovantes, não faz baixas manuais e não reenvia lançamentos.

O worker passa o ano/mês efetivamente pagos ao adaptador do Mercúrio. Se a ficha pendente mais antiga não corresponder à competência, o lançamento é bloqueado para conferência humana. O valor da contribuição, recarga e taxa de cartão permanecem separados. Não houve mudanças em taxas ou contratos.

## Validação

- `node --import tsx --experimental-test-module-mocks --test tests/*.test.mjs`
- `node tests/browser/finance.mjs`: componentes reais, dados fictícios, backend interceptado e rede externa bloqueada, em 414 e 1365 px.
- `npx eslint src scripts`
- `npx tsc --noEmit` após `npx next typegen`
- `npm run build -- --webpack`

Sem migrations. Nenhuma cobrança ou mensagem real foi criada nos testes. A cópia de trabalho `/workspace/BPO` foi preservada; a publicação usa `/workspace/BPO-publicacao`, baseada na master atualizada. O domínio `portal-na-one.vercel.app` precisa estar permitido na rede do ambiente para validar a publicação diretamente.
