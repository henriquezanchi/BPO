# Recebimento → Contribuições (o fluxo real dos Pix recebidos)

Diferente de Pagamento Outros e de Doações, **Contribuições não tem uma
lista fixa de rubricas** pra colocar num `.md` de consulta. A tela funciona
assim (mapeada ao vivo em 12/09/2026, filial Barra do Garças, sem gravar
nenhum lançamento real):

1. Você busca o **aluno/membro** por nome ou matrícula (popup "INFORME O
   NOME OU A MATRÍCULA").
2. O Mercúrio mostra as **fichas pendentes** daquela pessoa — uma linha por
   mês em aberto (ex: 10/2026, 11/2026...), cada uma com seu próprio valor
   e descrição (ex: "CONTRIBUIÇÃO CÍRCULO DE AMIGOS").
3. Você marca o(s) mês(es) que aquele Pix está pagando, clica "Calcular", e
   o sistema soma o valor. Só depois disso dá pra "Lançar no Recibo".

Ou seja: a "rubrica" de cada contribuição já vem pronta do cadastro da
pessoa — o trabalho da automação é achar a pessoa certa e o(s) mês(es)
certo(s), não escolher uma rubrica de uma lista.

## Por que a busca por nome não é confiável

Testei buscar pelo nome de duas pessoas reais que apareceram em Pix
recebidos em agosto/2026 ("TALINE...", "GUIMARAES...") e a busca **não
achou nada** — provavelmente porque a busca de Contribuições só lista
alunos/membros atualmente "ativos"/matriculados numa unidade, e não
necessariamente todo mundo que já fez um Pix pra Nova Acrópole aparece
ali (pode ser um contribuinte de outra unidade, alguém cujo cadastro foi
transferido/encerrado, ou simplesmente um nome digitado diferente do
cadastro). Uma busca de sanidade por "SILVA" funcionou normalmente (~19
resultados), então a busca em si funciona — só não é garantia de achar
qualquer nome.

**Por isso as regras do tipo `recebimento_contribuicao` exigem
`matricula`** (não nome) — é você, com acesso ao Mercúrio, quem confirma a
matrícula certa da pessoa uma vez (visualizando o cadastro dela, ou usando
uma busca manual por Contribuições) e coloca isso na regra. O campo
`nomeAluno` é só um desempate extra, opcional.

## Como o script decide o mês (atualizado 14/09/2026)

Pra nunca arriscar lançar num mês errado, o script segue esta regra, e
**desiste (não lança) se o valor não bater**:

1. Se a regra tiver `mesReferencia` (ex.: `"10/2026"`), usa exatamente
   esse mês.
2. Sem `mesReferencia`, usa o mês **pendente mais antigo** — contribuição é
   sempre paga na ordem em que venceu, então o mais antigo pendente é, na
   prática, sempre o que está sendo pago agora. O script NUNCA tenta somar
   vários meses nem testar cada mês pra ver qual "bate sozinho" (uma
   versão anterior fazia isso; foi simplificado a pedido do usuário — era
   mais difícil de prever o resultado).
3. Em qualquer um dos dois casos, confere o total calculado contra o valor
   da transação — se não bater (pagamento de mais de um mês, valor
   parcial, matrícula errada etc.), **aborta e não lança nada**, com um
   erro explicando o mês escolhido, o total dele e o valor da transação.
   Nesse caso: confira e lance manualmente, ou informe `mesReferencia` na
   regra se o mês certo não for o mais antigo.
   - **Exceção: desconto de pontualidade** (regra do usuário, 14/09/2026)
     — contribuições geralmente saem R$10 mais baratas se pagas até o dia
     10 do mês, e a ficha do Mercúrio NUNCA aplica esse desconto sozinha
     (sempre mostra o valor cheio). Então, se o pagamento foi feito até o
     dia 10 e a diferença entre o total calculado e o valor da transação
     for de até R$10 (o Mercúrio calculando MAIS que o extrato), o script
     lança normalmente — no valor cheio primeiro (via "Lançar no
     Recibo"), e depois AJUSTA o item pro valor real pago (tela "ALTERA
     ITEM" do Mercúrio, o mesmo mecanismo usado por Avulsos/Inscrições —
     ver seção própria no README). Qualquer diferença MAIOR que R$10, ou
     pagamento depois do dia 10, continua abortando normalmente — esse é
     o ÚNICO tipo de divergência de valor tolerado.

Isso é proposital e mais conservador que Pagamento Outros/Doações: aqui
existe uma pessoa real e um histórico financeiro dela envolvido, então o
custo de errar é maior.

## Confirmado ao vivo

Navegação (Recebimento → Contribuições → matrícula → Pesquisar → marcar
mês → Calcular → Lançar no Recibo → Finalizar com/sem Recibo) confirmada
com dado real em 12/09/2026. O popup nativo de confirmação do Mercúrio
("Finalizar esta Operação e Emitir o Recibo?") é tratado automaticamente
— `page.on('dialog', ...)` em `lib/mercurioAuth.js` sempre aceita (antes
disso, sem handler nenhum, o Playwright cancelava esse popup sozinho e o
lançamento nunca completava de verdade, mesmo sem erro nenhum aparecer).
