# Autoatendimento do Fortuna — desenho (24/11/2026)

Tudo descrito aqui vive no **Fortuna** (fortuna_backend: Express + Prisma/MySQL; fortuna_frontend: React + MUI + Tailwind). O Portal não entra, salvo a ponte da carteirinha (abaixo). Entrega como pedidos de mudança (MR) no repositório original, para o Paulo aceitar.

## Intenção

A pessoa escolhe o que vai consumir na lanchonete, **paga primeiro** (saldo do Fortuna ou Pix) e depois pega. O mesmo fluxo serve com ou sem voluntário no balcão: com voluntário, o pedido pago aparece numa tela do balcão para preparar e chamar; sem, a pessoa pega sozinha. Em eventos, quem não tem cadastro compra com Pix na hora.

Por quê: tirar a fila e a conta de cabeça do caixa, receber de gente de fora nos eventos, e aproveitar o pedido para formar uma lista de contatos com consentimento.

## Objetivos

- Autoatendimento num tablet ou computador da escola, sem login, com o visual do Fortuna.
- Só os **produtos de hoje** aparecem.
- Quem tem cadastro: nome + 4 primeiros dígitos do CPF, ou QR da carteirinha do Portal (câmera).
- Quem não tem: telefone; a "senha" de chamada são os 4 últimos dígitos.
- Pagamento com saldo do Fortuna ou Pix (QR na tela, confirmação automática).
- Tela do balcão com os pedidos pagos; cancelamento total ou por item, com estorno pelo meio de pagamento.
- Comprovante na tela e, se houver impressora térmica USB, impresso.
- Piloto: caixa "Autoatendimento" em Barra do Garças; depois, um por filial.

## Não objetivos

- Entregar produto antes de pagar; fiado; desconto no autoatendimento.
- Marcar "entregue" (o voluntário só age quando algo deu errado).
- Cartão de crédito ou débito.
- Qualquer dado do autoatendimento no Portal.

## Anti-objetivos

- Lista de contatos sem consentimento explícito (caixa pré-marcada não vale).
- Aparelho que dá acesso a clientes, relatórios ou cadastro de produtos.
- Cobrança pela conta Asaas principal: sempre pela subconta da filial.

## Restrições

- Fortuna como está (Express, Prisma 5, MySQL, React 18, MUI 5, Tailwind 3). Nada de framework novo.
- Pix só onde a filial tiver subconta Asaas **aprovada**. Hoje nenhuma; BGA em análise. Sem Pix, o modo "não tenho cadastro" fica escondido e o aparelho avisa.
- A API de integração do Portal (MR !7) continua valendo; este trabalho vem depois dela.
- Visual = o do Fortuna: fundo `amber-50`, barras `neutral-900` com `amber-400`, verde `green-600` para "pago", vermelho `red-600` para erro, fonte do sistema, componentes MUI.

## Abordagens consideradas

1. **Tudo no Portal, Fortuna só como estoque** (como estava sendo feito). Rápido para mim, mas duplica regra de negócio fora do Fortuna e deixa pedidos e visitantes num sistema que não é o da lanchonete. Descartada a pedido do usuário.
2. **Tudo no Fortuna, Portal só empresta a carteirinha** — escolhida. Uma peça só, visual nativo, dono único (Paulo).
3. **Aplicativo separado (PWA) falando com os dois sistemas.** Mais uma peça para manter e para o Paulo aprovar; sem ganho claro. Descartada.

Login dos aparelhos: **chave por aparelho** (escolhida) em vez de deixar o login de um voluntário aberto. Motivo: o login dá acesso a tudo; a chave dá acesso só ao autoatendimento, expira, e registra quem ativou.

Impressora: **térmica USB via WebUSB no navegador** (escolhida; Chrome/Edge, computador ou Android) em vez de programa instalado. Liga e desliga sozinha conforme o aparelho detecta a impressora.

## Como funciona

### Aparelhos
- Tela "Autoatendimento → Usar este aparelho" (usuário logado no Fortuna, da filial): escolhe o **caixa** e o **papel** (autoatendimento, balcão, ambos). O backend gera uma chave aleatória (tabela `SelfServiceDevice`: filial, caixa, papel, nome, ativado por, criado em, expira em ~180 dias, revogado em). A chave fica no navegador; o usuário sai da conta.
- Middleware próprio: a chave só alcança as rotas do autoatendimento e do balcão.
- Lista de aparelhos da filial com "desligar".

### Produtos de hoje
- Para cada caixa de autoatendimento, uma lista do dia (`SelfServiceMenuItem`: caixa, produto, data, visível). Ao abrir o dia, **padrão = todos os produtos do caixa com estoque > 0**; o voluntário desmarca o que não vai oferecer. Produto sem estoque some sozinho; produto que volta a ter estoque entra como "novo, oculto" até alguém marcar? — **Decisão minha:** entra visível, para seguir o padrão "tem estoque = aparece"; o voluntário só tira.
- Tela de edição simples (lista com interruptores), dentro do Fortuna, para usuário logado da filial.

### Identificação
- **Tenho cadastro:** busca por nome (3+ letras, no máximo 8 resultados, só clientes da filial) + 4 primeiros dígitos do CPF; 5 erros = 15 min de bloqueio no aparelho. Cliente **sem CPF** no Fortuna (cadastros antigos): usa os **4 últimos dígitos do telefone** (`phoneNormalized`); a tela diz qual dos dois pedir; sem CPF e sem telefone, vai ao caixa. Ou **QR da carteirinha**: o aparelho lê `NAC1.<matrícula>.<assinatura>` pela câmera e o backend do Fortuna pergunta ao Portal (`GET /api/carteirinha/validar?qr=…`, chave de serviço), que confere a assinatura e devolve só `{ ativo, fortunaClientId }` (o Portal já guarda essa ligação em `Member.fortunaClientId`). Nenhum CPF na ponte, nenhuma carga prévia, nenhum campo novo no Fortuna. A mesma rota devolve `apelido` ("como gosta de ser chamado", definido pela pessoa no Portal, com moderação), e há uma segunda, `GET /api/fortuna/apelidos?clientIds=…`, para o aparelho usar o apelido também na busca por nome e no comprovante. Esta é a **única ponte** com o Portal. (Decisão minha após revisão.)
- **Não tenho cadastro** (só com Pix disponível): telefone (DDD + número, validado), dois botões iguais "Quero receber informativos" / "Não, obrigado". Grava `Visitor` (filial, telefone, consentimento, data). Senha de chamada = 4 últimos dígitos; se já houve no dia outro visitante com os mesmos 4, acrescenta letra ("4821-B").

### Pedido e pagamento
- Venda do aparelho: o núcleo de `createSale` da API de integração (MR !7, ainda não aceito) é generalizado para aceitar como "principal" uma conta de integração **ou** um aparelho; a nota liga-se ao `SelfServiceOrder`. (Decisão minha.)
- `SelfServiceOrder`: filial, caixa, aparelho, cliente **ou** visitante, itens (produto, qtd, preço do servidor), total, meio (`BALANCE` | `PIX`), situação (`AGUARDANDO_PAGAMENTO` → `PAGO` → `CANCELADO` / `PARCIALMENTE_ESTORNADO`), número de chamada, `asaasPaymentId`, criado em, pago em.
- **Quem tem saldo suficiente não escolhe o meio** (decidido com o usuário em 24/11): a tela avisa que o valor será debitado do saldo, mostra quanto fica e que recargas se fazem pelo app do Portal; um botão só, "Confirmar e pagar". Pix aparece só para visitante ou quando o saldo não cobre o pedido.
- **Saldo:** reaproveita a venda da API de integração (preço do servidor, estoque, idempotência) ligada ao pedido. Sem saldo suficiente: mensagem "recarregue pelo Portal".
- **Pix:** o backend cria a cobrança na **subconta Asaas da filial** (chave guardada cifrada por filial, tabela `BranchPaymentAccount`, cadastrada numa tela de administração por filial, nunca a conta principal; testes de integração com a conta sandbox do Asaas — decisão minha), mostra o QR e o copia-e-cola; webhook do Asaas (assinatura conferida) marca `PAGO` e só então gera a venda no Fortuna. **Estoque não é reservado** enquanto o QR está na tela (decisão minha): se ao pagar faltar produto, o backend estorna no Asaas na hora e a tela avisa; o pedido vira `CANCELADO` sem passar pelo balcão. A venda é feita (cliente "Visitante — eventos" da filial, criado uma vez) com crédito + venda, ou venda no cliente de verdade se quem pagou tem cadastro e escolheu Pix. Pedido sem pagamento em 10 min expira e some.
- Comprovante: itens, total, meio, hora, **nome** ou **número de chamada** em destaque. O nome de chamada é o **apelido do Portal** quando existe (ex.: "Zanchi"), senão os dois primeiros nomes.
- **Confirmações destrutivas** (cancelar tudo, tirar item): caixa vermelha com o efeito escrito e dois botões distintos ("Sim, cancelar e estornar" / "Não, deixar como está"), nunca o mesmo botão duas vezes.
- **Destaques**: primeira faixa do cardápio com os mais vendidos e os de maior margem nos últimos 90 dias do caixa (margem = preço − custo do produto; enquanto o custo estiver zerado no Fortuna, vale a receita). Impresso se o aparelho tiver impressora.

### Balcão
- Tela que lista pedidos `PAGO` do caixa, mais recente embaixo, com nome/número grande; atualização a cada poucos segundos. Pedido some sozinho depois de 30 min.
- Em cada pedido: **"Cancelar tudo"** e **"Tirar item"** (um toque, confirmação curta). Estorno segue o meio: saldo → crédito de volta no cliente (parcial ou total); Pix → estorno no Asaas (`POST /payments/{id}/refund`, parcial ou total). Registra quem fez (aparelho) e o motivo fixo "sem estoque".
- **Tirar item na contabilidade** (decidido com o usuário): a nota de venda não muda; o Fortuna **cancela a nota e gera outra** só com os itens que ficaram, estornando a diferença e devolvendo o estoque do item tirado. Lotes de fornecedor leem só a nota nova.
- Sem voluntário: ninguém abre a tela; nada muda para quem compra.

### Impressora
- WebUSB: na primeira vez, o voluntário autoriza a impressora no navegador; depois o aparelho reconecta sozinho. ESC/POS, 58/80 mm. Se não há impressora conectada, o botão "Imprimir" não aparece e o comprovante fica na tela.

### Configurações do aparelho
- Tempo de inatividade (padrão 60 s), papel, impressora (detectada). Sem mais opções.

## O que fica com quem constrói
- Nomes de rotas e de componentes; divisão em MRs (sugestão: 1 aparelhos+produtos do dia+saldo; 2 Pix+visitante; 3 balcão+estornos; 4 impressora+carteirinha).
- Como rodar o webhook do Asaas no ambiente do Fortuna (URL pública, segredo por filial).
- Testes: os de integração existentes (MySQL) servem de modelo.
- Ponte da carteirinha: rota no Portal escrita por mim, em MR separado lá.

## Pendências fora do código
- Criar o caixa "Autoatendimento" em BGA (Paulo ou o usuário no Fortuna).
- Subconta Asaas de BGA aprovada (hoje em análise; CPF da representante em correção).
- Comprar impressora térmica USB 58/80 mm (R$ 200–400).
