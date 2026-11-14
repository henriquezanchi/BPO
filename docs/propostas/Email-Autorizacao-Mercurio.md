**Assunto:** Pedido de autorização: registros do Portal direto no Mercúrio (piloto de pagamentos)

---

Oi, Bia, tudo bem?

Venho pedir a sua autorização para uma mudança importante no piloto de pagamentos pelo Portal.

**O que estamos pedindo**

Autorização para que o Portal registre informações **diretamente no Mercúrio atual**, principalmente as financeiras: o recibo de quem pagou pelo Portal, a baixa do mês pago e as mudanças na composição da contribuição. A liberação valeria só para as escolas do piloto e só até o Mercúrio novo entrar no ar, em fevereiro.

**Como é feito hoje, e por que isso preocupa**

Hoje o Portal não tem uma porta de entrada no Mercúrio. Para lançar um recibo, usamos um "robô": um programa que abre o Mercúrio como se fosse uma pessoa, entra com o **meu login e a minha senha pessoais**, clica nas telas e preenche os campos.

Funciona, mas tem quatro problemas:
- **Segurança:** tudo depende da minha senha pessoal, que precisa ficar guardada no sistema. Além disso, o robô só consegue lançar nas escolas em que o meu login tem acesso à Tesouraria; hoje, são só Goiânia Universitário e Barra do Garças.
- **Fragilidade:** qualquer mudança numa tela do Mercúrio quebra o robô, e o lançamento fica parado até alguém perceber.
- **Lentidão:** cada lançamento leva minutos, e eles não podem rodar ao mesmo tempo.
- **Rastreabilidade:** no Mercúrio, todo lançamento do robô aparece como se eu tivesse feito à mão.

**O que muda com a autorização**
- Cada pagamento feito pelo Portal entra no Mercúrio logo depois de confirmado, com recibo, sem ninguém da secretaria precisar digitar.
- Os lançamentos ficam identificados como "feitos pelo Portal", com quem pediu e quando, e podem ser conferidos.
- Ninguém precisa emprestar senha pessoal: o Portal usa um acesso próprio, limitado ao necessário, que o João pode desligar a qualquer momento.
- O Portal passa a ler a composição e a situação das contribuições sempre atualizadas. Hoje parte desses dados vem de uma cópia parada em 17/10, e por isso a composição de alguns alunos aparece desatualizada no Portal.
- Esse mesmo modelo de integração já prepara a passagem para o Mercúrio novo.

**Até onde vai a liberação**
- **Só** as escolas do piloto: as escolas de Goiás (menos Valparaíso), Barra do Garças e a Sede Nacional.
- **Só** as operações listadas abaixo, para o João. O Portal não apaga registros nem mexe em nada fora delas.
- **Prazo:** até o Mercúrio novo entrar em produção, quando o assunto passa a ser tratado nele.

Para o calendário do piloto, o ideal seria termos isso funcionando **até o início de dezembro**, antes das primeiras cobranças automáticas.

Se você autorizar, peço que encaminhe este e-mail ao João Guilherme: a parte técnica abaixo é para ele. Fico à disposição para uma conversa rápida, se ajudar.

Um abraço,
Henrique

---

## Para o João Guilherme: detalhes técnicos

João, segue o que o Portal precisa, em ordem de preferência. Você conhece o Mercúrio por dentro, então fique à vontade para propor outro caminho que cumpra os mesmos requisitos.

### 1. Operações que o Portal precisa fazer

Hoje todas são feitas pelo robô, na fila do Portal (`MercurioSyncTask`).

| # | Operação | Onde fica hoje no Mercúrio | Prioridade |
|---|---|---|---|
| 1 | **Lançar recibo de contribuição paga pelo Portal**, ou seja, gerar o recibo e os itens com a rubrica, o mês de referência, o valor e a data do pagamento, e marcar a ficha do mês como paga | TESOURARIA (`reciboc`, `reciboi`, `fichas`) | Alta |
| 2 | **Incluir, excluir e alterar o valor de um item da composição** da contribuição de um membro | `tes_conedit.php` (`compaluno`) | Alta |
| 3 | **Atualizar contato e dados pessoais** (telefone, e-mail, endereço) pedidos pelo próprio membro no Portal | CADASTRO (`cadastro`) | Média |
| 4 | **Registrar anotações econômicas** do membro (combinados de pagamento) | ficha do membro | Média |
| 5 | **Consultar o recibo** para mostrar a 2ª via ao membro | `tes_conprt.php` | Baixa (já funciona em leitura) |

O Portal **não** precisa apagar recibos, estornar, mexer em caixa fechado nem alterar dados de outras filiais.

### 2. Formas de liberar, da preferida para a menos preferida

**A) Uma pequena API de escrita no Mercúrio.** É a mais segura.
- Endpoints HTTPS para as operações 1 a 4 (por exemplo, `POST /portal/recibo`, `POST /portal/composicao`, `PATCH /portal/cadastro`), com autenticação por token próprio do Portal.
- Cada endpoint aplica as **mesmas regras do Mercúrio**: numeração do recibo, caixa do dia, ficha pendente mais antiga, usuário responsável.
- Restrição por filial: o token só vale para as unidades do piloto: `BSB, BGA, GYN, JAM, STO, GAR, RVD, APS, GY2, ALT, ELD, PER, CAT, ITU`.
- Idempotência por um id que o Portal envia (`externalId`), para que uma repetição não gere recibo duplicado.
- Registro de auditoria: origem "PORTAL" e a matrícula de quem pediu.

**B) Procedimentos armazenados no MySQL, com um usuário só com permissão de executá-los.**
- Um procedimento por operação (por exemplo, `sp_portal_lancar_recibo(...)`), com as regras de negócio dentro dele.
- Um usuário de banco exclusivo do Portal, com `GRANT EXECUTE` só nesses procedimentos. Sem `INSERT`/`UPDATE` direto nas tabelas.
- Acesso por conexão segura (TLS ou túnel), de preferência com lista de IPs permitidos. Os IPs de saída do Portal (Vercel) podem ser fixados se for preciso.

**C) Usuário de banco com `INSERT`/`UPDATE` direto e restrito às tabelas e colunas necessárias.**
- É a última opção, porque o Portal teria que reproduzir as regras do Mercúrio (numeração do recibo, caixa) e o risco de inconsistência é maior. Só se A e B não forem viáveis até dezembro.

### 3. Leitura (pedido que já tínhamos feito)

No banco de consulta `oinabview`, só `cadastro`, `reciboc`, `reciboi`, `turmas` e `turmas_materias` são VIEWs (ao vivo). As outras 16 tabelas são cópias (BASE TABLE) carregadas em **17/10/2026** e não foram mais atualizadas. As principais são:
- `compaluno` e `fichas`, que são financeiras;
- `unidades`;
- `dirigente_funcoes`;
- `produtos`;
- `cursos_integra_participa`.

O pedido é **transformá-las em VIEWs**, ou, se não der, recarregá-las todo dia. A data da tabela `atualização` (30/10) não corresponde à data real das cópias.

### 4. Segurança e controle
- Um acesso **exclusivo do Portal**, separado de qualquer login pessoal, que você pode revogar a qualquer momento.
- Se possível, primeiro um **ambiente de teste** ou uma filial de teste, antes de produção.
- Tudo o que o Portal gravar fica registrado também do lado do Portal: quem pediu, quando, o que foi enviado e a resposta do Mercúrio.
- As credenciais ficam guardadas só no servidor do Portal (variáveis de ambiente cifradas), nunca no navegador nem em mensagens.

### 5. Do nosso lado

Assim que houver a liberação, adapto o Portal para usar esse acesso no lugar do robô e faço o primeiro teste em Barra do Garças, acompanhando com você. Fico à disposição para uma chamada técnica.

Henrique Zanchi
