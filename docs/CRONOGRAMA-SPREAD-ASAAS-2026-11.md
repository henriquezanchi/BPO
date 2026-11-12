# Cronograma — cobrança pelo Portal com spread (Goiânia e região + Sede Nacional)

Atualizado em 12/11/2026. Autorização do Diretor Nacional para cobrar pelo spread já dada.

**Escopo**
- Escolas de Goiânia e região: Goiânia Universitário, Jardim América, Setor Oeste e Garavelo.
- Goiás e Barra do Garças, sem exceção.
- Sede Nacional.

**Regra de cobrança, que não muda:** toda cobrança sai pela conta Asaas da própria escola. A margem do BPO volta por split na mesma transação, nunca por repasse posterior. Isso já está pronto no código: [conta-escola.ts](../src/lib/asaas/conta-escola.ts) e [split.ts](../src/lib/asaas/split.ts).

---

## 0. Regra comercial do spread (decidida; não reabrir)

Fontes: proposta "Portal, Suporte e Serviços Financeiros" de 23/10/2026; confirmação à Ana Beatriz Pignataro em 05/11/2026; respostas do usuário em 12/11/2026.

**Fixo e spread**
- **Fixo nacional:** R$ 3.000 por mês, **abatido pelo spread do mês**. A conta é fixo = máx(0, 3.000 − spread).
  - Exemplo: com R$ 2.000 de spread, o fixo cai para R$ 1.000.
  - Com R$ 3.000 de spread ou mais, o fixo zera.
- **O spread incide só sobre o que passa pelo Portal.** Se uma escola não teve nenhum pagamento pelo Portal no mês, não paga spread.

**Faixas progressivas**
- As faixas são contadas pelo **total de membros ativos das escolas aderentes**, inclusive os que pagam por fora (escala coletiva).
- Cada faixa mantém a sua taxa. A **taxa média** que resulta é a mesma para todas as escolas.

| Faixa de membros | Taxa da faixa |
|---|---|
| até 500 | 2% |
| 501 a 1.500 | 1,5% |
| 1.501 a 3.000 | 1% |
| 3.001 a 5.000 | 0,75% |
| 5.001 a 10.000 | 0,5% |
| acima de 10.000 | 0,25% |

Exemplos: com 700 membros, a média dá cerca de 1,86%; com todas as escolas, cerca de 0,5%.

**Taxa do Asaas:** no Pix, sai da parte da escola. No cartão, é repassada ao aluno. As tarifas do Asaas são separadas do spread.

**Duração:** é temporário. A ideia é cerca de 1 ano, com data para transferir o suporte às escolas.

**Sede Nacional:** é a filial de Brasília (BSB).

**Conta com o escopo atual**, contando os ativos no Mercúrio em 12/11:
- BSB 448 + BGA 31 + GYN 322 + JAM 303 + STO 61 + GAR 35 = **1.200 membros**.
- Taxa média = (500 × 2% + 700 × 1,5%) ÷ 1.200 ≈ **1,71%**.
- A média ainda muda conforme as escolas de Goiás que entrarem.

**O código ainda está desatualizado:** cobra 2% fixo (`PERCENTUAL_SPLIT_ESCOLA = 98` em `src/lib/billing-constants.ts`).

Falta construir duas coisas (item T11):
- o cálculo da taxa média pelas faixas, refeito todo mês com a contagem de membros das aderentes;
- a fatura do fixo abatido pelo spread.

---

## 1. Onde cada escola está hoje

Dados lidos do banco do Portal em 12/11/2026.

| Filial | Portal | Conta Asaas ligada | Ativos importados | Pix Automático ativo |
|---|---|---|---|---|
| Barra do Garças (BGA) | aberto | **sim** (subconta + chave) | 30 | 0 |
| Goiânia Universitário (GYN) | aberto | não | 289 | 0 |
| Brasília (BSB) | aberto | não | 448 | 0 |
| Goiânia Jardim América (JAM) | aberto | não | 2 (importação incompleta) | 0 |
| Goiânia Setor Oeste (STO) | fechado | não | 1 | 0 |
| Goiânia Garavelo (GAR) | fechado | não | 1 | 0 |
| Goiás | **não existe no Portal** | — | — | — |
| Sede Nacional | **não existe como escola no Portal** | — | — | — |

Observações:
- Brasília entra aqui só se a "Sede Nacional" for a filial de Brasília. Se for outro CNPJ, ela vira um cadastro novo; ver a decisão D1.
- O Pix Automático só funciona nas unidades listadas na variável `PIX_AUTOMATICO_UNIDADES` da Vercel. Hoje nenhuma filial está liberada nela.

---

## 2. Decisões a tomar antes de começar (esta semana)

**Respondidas em 12/11/2026:**
- **D1:** a Sede Nacional é Brasília.
- **D3:** o spread segue as faixas da seção 0.
- **D4:** a taxa fica como está hoje (Pix pela escola, cartão pelo aluno).
- **D2:** o usuário vai escolher quais escolas de Goiás entram.

| # | Decisão | Por que importa |
|---|---|---|
| D1 | **O que é a "Sede Nacional"?** É a filial de Brasília ou um CNPJ próprio? E o que ela cobra: contribuição de membros ou repasses das filiais? | Define se criamos uma escola nova no Portal e que tipo de cobrança ela terá. |
| D2 | **Goiás** é a filial da Cidade de Goiás? Ela está no Mercúrio e com qual sigla? | Sem a sigla, não dá para importar os alunos nem abrir a filial. |
| D3 | **Percentual do spread por escola.** O código usa hoje 2% fixo (`PERCENTUAL_SPLIT_ESCOLA = 98`). | Se for um valor fixo por escola, mudamos o cálculo antes do primeiro ciclo. |
| D4 | **Quem paga a taxa do Asaas.** Hoje, no Pix, a taxa sai da parte da escola. No cartão, a taxa é repassada ao aluno. | Precisa constar no contrato com a escola. |
| D5 | **Contrato ou termo de adesão** de cada escola ao serviço, com o percentual, a taxa e a autorização para emitir cobranças em nome dela. | Dá base jurídica ao split e ao uso da chave de API. |
| D6 | **Baixa no Mercúrio.** O login do scraper só administra Barra do Garças. O pagamento feito no Portal não vira recibo no Mercúrio em GYN, BSB etc. | **Bloqueia o lançamento fora de BGA.** É preciso pedir ao João Guilherme um login com acesso a essas filiais ou, enquanto isso, combinar que a tesouraria dá a baixa. |

---

## 3. Escola que já tem conta Asaas: como fica

**Recomendado: usar a conta própria da escola, com split para o BPO.** O split do Asaas funciona entre quaisquer contas Asaas, e não só entre subcontas criadas por nós. Na prática:

1. O responsável financeiro da escola gera uma chave de API para o Portal.
   - O caminho no Asaas é *Integrações → Chave de API*.
   - Se o Asaas permitir várias chaves, deve ser uma chave só para o Portal, com nome identificável.
2. A chave chega a nós por canal seguro, nunca por WhatsApp aberto ou e-mail. Gravamos a chave cifrada no cadastro da escola, no mesmo campo usado hoje pelas subcontas.
3. Cadastramos na conta da escola o webhook do Portal (`/api/webhooks/asaas`), com o token de autenticação.
4. A partir daí, a cobrança sai no nome da escola e a margem do BPO cai na nossa conta na hora. Não há repasse posterior nem trabalho para a escola.

**Por que não criar outra subconta para essas escolas:** em geral, o Asaas não aceita duas contas com o mesmo CNPJ. Seria preciso encerrar a conta atual da escola, e isso mexe com o banco e o histórico dela. *Confirmar essa limitação com o gerente Asaas.*

**Riscos e como cobrir:**
- A chave dá acesso amplo à conta. O termo de adesão (D5) deve dizer para que ela é usada, e a escola pode revogá-la a qualquer momento.
- A escola consegue mexer numa cobrança que nós emitimos. Para isso, a conferência diária compara cobranças pagas com splits recebidos, e o painel de saúde avisa quando faltar algum split. Isso precisa ser construído (item T7).

---

## 4. Escola sem conta Asaas: subconta e autorização com selfie

1. **Nós** criamos a subconta pelo script `scripts/create-asaas-subaccount.ts`.
   - Dados necessários: CNPJ, razão social, e-mail, telefone, endereço, faturamento e responsável legal.
   - O Asaas entrega a chave de API uma única vez; ela fica gravada no cadastro da escola.
2. **Nós** geramos o link de envio de documentos da subconta e mandamos ao responsável legal.
3. **O responsável legal da escola**, pelo celular, envia:
   - documento com foto;
   - selfie;
   - contrato social ou estatuto e ata de eleição da diretoria;
   - comprovante de endereço.
4. **O Asaas** analisa, o que costuma levar de 1 a 3 dias úteis. Enquanto não aprovar, o Portal mostra "pagamento on-line ainda não liberado" e não cobra.
5. **Nós** conferimos se a conta foi aprovada e fazemos uma cobrança-teste de R$ 5 com split, que depois é estornada.

**O que pedir de antemão** a cada escola, para não travar na análise:
- estatuto e ata da diretoria **atual** (o motivo de recusa mais comum é ata vencida);
- documento e celular do presidente ou responsável legal;
- conta bancária da associação, para o saque.

---

## 5. Cronograma

Dia de vencimento: **10**. O Pix Automático cria a cobrança de 2 a 10 dias úteis antes do vencimento. A autorização precisa estar ativa antes dessa janela.

### Semana 0 — 13 e 14/11 (qui–sex)
- [ ] Responder às decisões D1 a D6. Para D6, mandar mensagem ao João Guilherme.
- [ ] Escrever a mensagem de apresentação às escolas: o que muda, o que a escola ganha e o que precisa enviar. Acompanha uma lista de documentos.
- [ ] Minuta do termo de adesão (D5).
- [ ] **BGA (piloto):** liberar o Pix Automático (`PIX_AUTOMATICO_UNIDADES=BGA` na Vercel) e testar com 1 ou 2 pessoas da direção.

### Semana 1 — 16 a 19/11 (20/11, Consciência Negra, é feriado nacional)
- [ ] Ligar para cada direção (GYN, JAM, STO, GAR, Goiás, Sede) e enviar a mensagem e o termo.
- [ ] Separar as escolas em **"já tem Asaas"** (seção 3) e **"não tem"** (seção 4).
- [ ] Criar as subcontas das que não têm e enviar os links de documentos e selfie.
- [ ] Importar e abrir no Portal Jardim América, Setor Oeste, Garavelo e Goiás.
  - É o mesmo processo de Fortaleza.
  - Hoje essas filiais têm só 1 ou 2 ativos importados.
- [ ] **Desenvolvimento:** começar o modo guiado por QR code (seção 6) e o cartão recorrente (T3).
- [ ] BGA: campanha interna para os 30 ativos autorizarem o Pix Automático até 05/12. Assim o ciclo de 10/12 já roda sozinho.

### Semana 2 — 23 a 27/11
- [ ] Cobrar o envio de documentos e selfie de quem não enviou.
- [ ] Escolas com conta própria: receber a chave, gravar e cadastrar o webhook (seção 3).
- [ ] Cobrança-teste com split em cada conta aprovada.
- [ ] **Desenvolvimento:**
  - modo guiado por QR pronto em homologação;
  - cartão recorrente com split testado no sandbox;
  - conferência do split (T7).
- [ ] Revisar as notificações (seção 7) com mensagens reais.

### Semana 3 — 30/11 a 04/12
- [ ] Gravar o **vídeo**, de 60 a 90 segundos, na vertical, com legenda (seção 6).
- [ ] Montar o **PDF**, de uma ou duas páginas, com as mesmas telas do vídeo.
- [ ] Gerar os **cartazes com QR**, um por filial. O QR leva a sigla da filial para medir uso. Imprimir.
- [ ] BGA: as cobranças do ciclo de 10/12 começam a ser criadas (de 26/11 a 08/12). Acompanhar uma a uma.
- [ ] Treinar as tesourarias em 30 minutos por videochamada: o que muda, onde ver os pagamentos e o que fazer se alguém não conseguir pagar.

### Semana 4 — 07 a 11/12: lançamento nas demais escolas
- [ ] Afixar os cartazes no pátio e mandar o aviso no grupo de cada turma, com o vídeo.
- [ ] Liberar o Pix Automático nas filiais aprovadas, acrescentando as siglas em `PIX_AUTOMATICO_UNIDADES`.
- [ ] Dezembro: quem ainda não autorizou paga pelo Pix avulso do Portal, que também é cobrança com split.
- [ ] 10/12: primeiro ciclo automático de BGA. Conferir pagamentos, splits e recibos.

### 14/12 a 08/01
- [ ] Acompanhamento diário: pagamentos, splits, falhas e autorizações recusadas.
- [ ] Segunda chamada para autorizar o débito automático, com meta de autorizações ativas antes de 06/01.
- [ ] **10/01/2027: primeiro ciclo automático de todas as filiais.**

### Janeiro
- [ ] Relatório por escola: adesão, inadimplência e spread recebido.
- [ ] Ajustes e decisão de expandir para outras regiões.

---

## 6. QR code no pátio, modo guiado, vídeo e PDF

### Como deve funcionar
O aluno lê o QR com a câmera do celular, e o Portal faz o resto como um tutorial que ele só assiste. O aluno só age em dois momentos:

1. ao digitar **a senha do Portal**, se não estiver logado;
2. ao confirmar **no app do banco**.

**Fluxo técnico (T1):**
1. O QR aponta para `portal…/pagar?filial=GYN&origem=patio`. A rota é nova.
2. Se não estiver logado, o aluno vai para o login e volta para `/pagar` em seguida, sem passar pela tela inicial.
3. `/pagar` abre em **modo guiado**:
   - destaques animados mostram "esta é a sua contribuição", "estes são os itens" e "agora vamos gerar o pagamento";
   - a cobrança é gerada sozinha, sem clique;
   - o aluno não toca em nada até o código Pix aparecer.
4. O código Pix vem com um botão grande **"Copiar e abrir o banco"**: copia o código e mostra "abra o app do seu banco → Pix → Copia e Cola".
5. Quem não pagou nada no mês recebe **direto o Pix Automático**: a autorização já paga o mês e deixa os próximos automáticos. Quem já pagou o mês recebe só a autorização para os meses seguintes.
6. A tela fica esperando a confirmação e mostra "Pagamento confirmado ✓" quando o webhook chega.

**Limites que não dá para contornar:**
- Não existe um link Pix universal que abra "o app do banco" já com o código. Cada banco é um app diferente, então o passo de colar no banco continua com o aluno. O que podemos fazer é deixar o código copiado e a instrução na tela.
- **iPhone:** o link do QR abre no Safari, não no app do Portal instalado. Funciona igual, mas pede login no Safari na primeira vez. No Android, se o app estiver instalado, o link costuma abrir direto nele.
- No pagamento por cartão, o aluno digita o cartão uma vez. Depois disso, o cartão fica guardado pelo Asaas, com token, para as próximas cobranças (T3).

### Vídeo e PDF (T2)
- **Vídeo:** gravamos a tela do próprio modo guiado num celular de demonstração, com um usuário de teste.
  - Narração curta e legenda.
  - Duas versões: 60 segundos (pátio e redes) e 3 minutos (passo a passo com cartão e com Pix Automático).
- **PDF:** 6 a 8 telas numeradas, tiradas do mesmo roteiro, com uma frase por tela. Uma página A4 frente e verso.
- **QR acessível:** o mesmo PDF e o vídeo ficam numa página `portal…/como-pagar`, apontada por um segundo QR no cartaz ("não entendeu? veja o vídeo").

---

## 7. O que conferir e construir

| # | Item | Situação hoje | O que falta |
|---|---|---|---|
| T1 | Modo guiado por QR (`/pagar`) | não existe | construir (seção 6) |
| T2 | Página "como pagar", vídeo e PDF | não existe | produzir depois do T1 |
| T3 | **Cartão de crédito recorrente** | o cartão só faz cobrança avulsa (taxa repassada ao aluno) | assinatura do Asaas com cartão guardado por token e split; tela de trocar ou cancelar o cartão; regra de taxa (D4) |
| T4 | **Pix Automático** | pronto: autorização, ciclo mensal pela rotina `/api/cron/financeiro`, webhook de status | liberar por filial; testar o ciclo completo em BGA em dezembro; tratar a recusa de débito (saldo insuficiente) com aviso e Pix avulso de reserva |
| T5 | Pix avulso com split | pronto | só testar em cada conta nova |
| T6 | **Notificações** | já existem: aviso de vencimento (antes e no dia), push e WhatsApp; o Asaas fica com as notificações desligadas e o Portal avisa | conferir os textos e acrescentar: "débito automático ativado", "débito do mês feito", "débito falhou, pague por aqui", "autorização cancelada ou expirada" e "cartão recusado ou vencido" |
| T7 | Conferência do split | não existe | rotina diária que compara pagamentos com splits recebidos por escola e alerta no painel de saúde |
| T8 | Baixa no Mercúrio | só BGA (login do scraper) | depende da D6 |
| T9 | Conta própria da escola | o campo de chave já aceita qualquer conta | rotina de cadastro da chave e do webhook pela tela de administração, em vez de script |
| T11 | Spread por faixas e fixo abatido | 2% fixo no código | taxa média mensal pelas faixas (seção 0); split com essa taxa; fatura do fixo = máx(0, 3.000 − spread) |
| T10 | Painel por escola para a tesouraria | parcial (Economia) | lista do mês: quem pagou, por qual meio, quem tem débito automático, quem falhou |

**Ordem sugerida de desenvolvimento:** T4 (liberação BGA) → T6 → T1 → T7 → T3 → T9 → T2 → T10.
