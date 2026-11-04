# Plano — espelhar o Mercúrio novo (Mercury) no Mercúrio antigo

Situação em 04/11/2026: o Gabriel vai migrar a base de BGA e, a partir de sexta, 06/11/2026, a escola passa a lançar só no
Mercúrio novo. As outras escolas e os dirigentes continuam lendo o Mercúrio antigo, então tudo o que BGA lançar no novo
precisa aparecer também no antigo. **O novo é sempre a fonte da verdade.**

**Situação: código pronto e EM ESPERA (04/11/2026).** Nada lê nem grava até os passos de "Como ligar", lá embaixo. O
que fazer à mão no antigo, item por item: [ESPELHO-MERCURIO-PROCEDIMENTOS.md](ESPELHO-MERCURIO-PROCEDIMENTOS.md).

## Como funciona (resumo)

1. **Ler o novo** pela API do Mercury (produção: `https://mercury-api.newacropolis-usa.org/external/v1`, informada pelo
   Gabriel em 04/11/2026). A chave atual do Portal (`MERCURY_API_KEY`) é da base de teste e dá 401 na de produção:
   **falta pedir ao Gabriel uma chave de produção.**
2. **Ler o antigo** pelo banco de consulta (oinabview), que é barato e não abre navegador.
3. **Comparar** os dois por matrícula, normalizando para um formato comum, e gerar a lista de diferenças.
4. **Gravar no antigo** com o robô (Playwright), dentro da rotina `/api/cron/fila-mercurio` (a cada 10 min), com a
   mesma trava de concorrência. O que o robô não sabe ou não consegue fazer fica para a secretaria, com o passo a passo.
5. **Registrar** o que foi espelhado (com o "carimbo" do estado do novo) para não lançar duas vezes.

## O que espelhar, por ordem de prioridade

| # | Dado | No novo (API) | No antigo (leitura) | Robô já grava? |
|---|------|---------------|---------------------|----------------|
| 1 | Pagamentos de contribuição (recibos) | `/people/{m}/receipts`, `/branches/{id}/movements` | `reciboc`/`reciboi` | **Sim** (`lancarPagamentoContribuicaoHoje`), mas só no caixa do dia |
| 2 | Composição da contribuição | `/people/{m}/contribution-plan` | ficha de composição | **Sim** (incluir, excluir, editar valor) |
| 3 | Alunos novos (admissão) | `/people?updatedSince` | `cadastro` | **Não**: falta mapear a tela de inclusão |
| 4 | Contato, endereço, dados pessoais, identificação | `/people/{m}` | `cadastro` | **Sim** |
| 5 | Situação (inativação, reingresso) | `/people/{m}` | `cad_situacao` | **Não** |
| 6 | Turma e nível | `/classes`, `/people/{m}` | `turmas`, `cad_turma`, `cad_nivel` | **Não** |
| 7 | Outros lançamentos do caixa (despesas, outras receitas) | `/branches/{id}/movements` | movimento sintético | **Não** |
| 8 | Funções, cursos de integração, FV, colaboradores | dossier, staff, instructors | `dirigente_funcoes` etc. | **Não** |

Os itens 1, 3 e 7 são os que os dirigentes mais olham (economia, alunos novos e movimento).

## Regras

- **O novo vence.** Se o antigo estiver diferente, o antigo é corrigido. Se alguém mexeu no antigo depois do último
  espelhamento, corrige do mesmo jeito, mas avisa no relatório.
- **Campos que só existem no antigo** não são tocados.
- **Dinheiro nunca é corrigido sozinho.** Recibo faltando é lançado; recibo diferente (valor ou meses) vai para revisão
  humana, porque cancelar recibo no antigo é irreversível.
- **Datas:** o robô de recebimento lança no caixa do dia. Um pagamento de ontem precisa entrar no caixa daquela data, e o
  robô hoje recusa o dia se ele estiver fechado (`abrirDia` → `editavel`). Por isso o espelho deve rodar **todo dia à
  noite**, para lançar no mesmo dia. Atrasos ficam para revisão.
- **Nada em dobro:** cada item espelhado fica num registro com a chave do novo (ex.: id do recibo no Mercury) e o número
  que o antigo gerou. Rodar duas vezes não lança duas vezes.

## Fases

1. **Só relatório (sem gravar).** Uma rotina diária compara os dois e mostra numa tela do Portal "o que está no novo e
   falta no antigo". Já serve para conferência manual desde o primeiro dia.
2. **Gravar o que o robô já sabe**: itens 1, 2 e 4, com **aprovação de uma pessoa** antes de cada lote nas duas
   primeiras semanas.
3. **Mapear as telas que faltam** (itens 3, 5, 6, 7): primeiro só leitura, depois teste de gravação num cadastro de teste,
   como foi feito com `scripts/mercurio-write-test.ts`.
4. **Automático**, com aprovação mantida só para dinheiro com divergência.

Há um botão de desligar por escola (`EspelhoMercuryConfig.modo`) e outro geral (`ESPELHO_MERCURY_LIGADO`).

## Código (pronto, em espera)

| Arquivo | O que faz |
|---|---|
| `src/lib/espelho-mercury/tipos.ts` | Formato comum dos dois lados e das ações |
| `src/lib/espelho-mercury/ler-novo.ts` | Lê a filial na API do Mercury (ativos completos; inativos que mudaram) |
| `src/lib/espelho-mercury/ler-antigo.ts` | Lê a unidade no oinabview (cadastro, composição, recibos, turmas, funções, produtos) |
| `src/lib/espelho-mercury/comparar.ts` | Função pura: compara e devolve as ações (testes em `tests/espelho-mercury.test.ts`) |
| `src/lib/espelho-mercury/manual.ts` | Passo a passo manual de cada tipo (o mesmo do documento de procedimentos) |
| `src/lib/espelho-mercury/rodar.ts` | Rodada noturna: lê, compara, grava em `EspelhoMercuryItem` |
| `src/lib/espelho-mercury/aplicar.ts` | Robô: grava no antigo os itens aprovados (dentro da rotina `fila-mercurio`) |
| `src/app/api/cron/espelho-mercury/route.ts` | Rotina noturna (02:30 UTC), já no `vercel.json`; em espera só registra que rodou |
| `src/app/(member)/espelho-mercurio/page.tsx` + `src/components/espelho-mercury/painel.tsx` | Tela: aprovar para o robô, "Fiz no antigo", "Não fazer" (com motivo), histórico |
| `src/lib/actions/espelho-mercury-actions.ts` | Aprovação e marcações: Escolástica decide cadastro, Economia decide dinheiro e composição, direção decide tudo |
| `prisma/migrations/20261104200000_espelho_mercury` | Tabelas `EspelhoMercuryConfig` e `EspelhoMercuryItem` (com RLS). **Não aplicada** |

Ciclo de um item: `pendente` → (`aprovado` → `feito_robo` ou `erro`) ou `feito_manual` / `ignorado`. Se a diferença
some sozinha, vira `resolvido`; se volta depois, reabre. Item feito não volta, mesmo que o banco de consulta do antigo
(cópia diária) demore a mostrar. Se continuar aparecendo 2 dias depois de feito, a tela avisa para conferir. O robô
não usa a fila `MercurioSyncTask` (que exige `Member`, e aluno novo ainda não é); grava direto a partir do item.

Limites conhecidos:

- O banco de consulta do antigo só tem **ativos**. Um aluno ativo no novo que não aparece no antigo pode ser novo ou
  estar inativo lá. A pendência diz para procurar em Inativos antes de cadastrar.
- O Mercury só dá o **total por rubrica** do movimento do mês, não cada despesa. A pendência mostra os totais, e os
  detalhes saem do próprio Mercúrio novo.
- Os nomes dos itens da composição são casados pelo texto com o catálogo do antigo. Se nenhum nome bater, nada é
  excluído e a pessoa vai para "conferir antes".
- A rotina tem 300 s. Se a leitura não couber (filial grande), ela falha inteira, avisa, e é preciso dividir a rodada.
- O robô lança a contribuição no caixa do **dia do pagamento**. Se o antigo já fechou o dia, o item vai para a
  secretaria.

## Como ligar (quando a migração da base de BGA terminar)

1. **Chave de produção** do Gabriel. Na Vercel: `MERCURY_API_URL=https://mercury-api.newacropolis-usa.org/external/v1`
   e `MERCURY_API_KEY=<chave nova>`. Atenção: isso também troca a base das outras leituras do Mercury no Portal
   (filiais dos EUA e escolas com `sistemaRegistro = "mercury"`), que passam a ler produção. É o desejado.
2. Refazer a medição de defasagem com a chave nova (a base deve estar em dia).
3. **Aplicar a migração** (com autorização do usuário):
   `npx prisma db execute --file prisma/migrations/20261104200000_espelho_mercury/migration.sql` e depois
   `npx prisma migrate resolve --applied 20261104200000_espelho_mercury`.
4. BGA: `School.sistemaRegistro = "mercury"`. Com isso o Portal **para de gravar direto no antigo** (pagamentos do
   Asaas, composição, cadastro), e não há lançamento em dobro. Enquanto a API do Mercury não grava, pagamento do Asaas
   precisa ser lançado à mão no novo; o espelho leva para o antigo.
5. Conferir `School.mercuryBranchId = "52"`, `mercurioUnidade = "BGA"`, `mercurioFilialLabel` e
   `mercurioCaixaLancamento` de BGA.
6. Criar a configuração: `INSERT INTO "EspelhoMercuryConfig" ("schoolId", modo, desde, "updatedAt") VALUES
   ('<id de BGA>', 'relatorio', '<primeiro dia no novo, AAAA-MM-DD>', now());`
7. Na Vercel: `ESPELHO_MERCURY_LIGADO=1` e redeploy.
8. Rodar a primeira comparação na mão: `GET /api/cron/espelho-mercury` com `Authorization: Bearer <CRON_SECRET>`.
   Conferir a lista em `/espelho-mercurio` (a página ainda não tem link no menu; incluir quando ligar).
9. Depois de uma ou duas semanas de lista conferida: `modo = 'aprovacao'` (o robô faz o que alguém aprovar). Mais
   adiante, se tudo bater, `modo = 'automatico'`.

Para desligar a qualquer momento: `ESPELHO_MERCURY_LIGADO` vazio (para tudo) ou `modo = 'desligado'` (só a escola).

## Riscos e perguntas para o Gabriel

1. **Chave de produção** para `mercury-api.newacropolis-usa.org`.
2. **Número de matrícula:** o novo e o antigo vão gerar números novos ao mesmo tempo. Quem gera a matrícula de um aluno
   novo de BGA? Se o novo usar um número que o antigo já deu a alguém de outra escola, há colisão. O ideal é cadastrar
   primeiro no antigo e usar o mesmo número no novo, ou o novo reservar uma faixa.
3. **A base de produção é tempo real?** A de teste estava congelada em 02/09 (medido hoje). Repetir a medição com a chave
   nova.
4. Existe na API um **feed de recibos por filial e período** (não só por pessoa)? Isso simplifica o item 1.
5. A API vai ter **gravação**? Hoje é só leitura. Isso afeta o item seguinte.

## Conflito com o que o Portal já faz

Hoje o Portal **lança no Mercúrio antigo** os pagamentos do Asaas (`lancar_contribuicao_paga`) e as alterações de
composição e de dados feitas no Portal. Com BGA no novo:

- esses lançamentos precisam ir **para o Mercury** (se a API ganhar gravação) ou ser feitos à mão no novo;
- e o espelho vai trazê-los de volta para o antigo. Se a fila antiga continuar ligada para BGA, **vai lançar em dobro**.

Decisão: trocar `School.sistemaRegistro` de BGA para `"mercury"` (passo 4 de "Como ligar"). O Portal para de gravar
direto no antigo, e o antigo passa a ser alimentado só pelo espelho.
