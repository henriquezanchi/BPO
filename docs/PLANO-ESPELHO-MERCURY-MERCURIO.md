# Plano — espelhar o Mercúrio novo (Mercury) no Mercúrio antigo

Situação em 04/11/2026: o Gabriel vai migrar a base de BGA e, a partir de sexta, 06/11/2026, a escola passa a lançar só no
Mercúrio novo. As outras escolas e os dirigentes continuam lendo o Mercúrio antigo, então tudo o que BGA lançar no novo
precisa aparecer também no antigo. **O novo é sempre a fonte da verdade.** Este documento só planeja: nada está ligado.

## Como funciona (resumo)

1. **Ler o novo** pela API do Mercury (produção: `https://mercury-api.newacropolis-usa.org/external/v1`, informada pelo
   Gabriel em 04/11/2026). A chave atual do Portal (`MERCURY_API_KEY`) é da base de teste e dá 401 na de produção:
   **falta pedir ao Gabriel uma chave de produção.**
2. **Ler o antigo** pelo banco de consulta (oinabview), que é barato e não abre navegador.
3. **Comparar** os dois por matrícula, normalizando para um formato comum, e gerar a lista de diferenças.
4. **Gravar no antigo** com o robô (Playwright), reaproveitando a fila `MercurioSyncTask` e a rotina
   `/api/cron/fila-mercurio` (a cada 10 min), com a mesma trava de concorrência.
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

Há um botão de desligar por escola (`School`), e o espelho só roda para escolas marcadas como "já no Mercúrio novo".

## Peças de código (quando for implementar)

- `src/lib/espelho-mercury/ler-novo.ts`: busca no Mercury o que mudou desde o último espelhamento
  (`updatedSince`; recibos e movimentos do mês) e normaliza.
- `src/lib/espelho-mercury/ler-antigo.ts`: mesma normalização a partir do oinabview.
- `src/lib/espelho-mercury/comparar.ts`: função pura que recebe os dois lados e devolve a lista de ações. É a parte que
  mais merece testes.
- `src/lib/espelho-mercury/aplicar.ts`: transforma as ações aprovadas em tarefas da fila `MercurioSyncTask` (novos
  `taskType`).
- Tabela nova `EspelhoMercuryItem` (com RLS): tipo, chave no novo, chave no antigo, carimbo do estado, situação
  (pendente, aprovado, espelhado, revisão, erro). Obs.: `MercurioSyncTask.memberId` é obrigatório, e aluno novo ainda não
  é `Member`; a tabela nova resolve isso.
- Tela `/escolastica/espelho-mercurio` com o relatório diário e o botão de aprovar.

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

Decisão necessária antes de sexta: desligar, para BGA, o lançamento direto no antigo (`School.mercurioCaixaLancamento`
= null) e deixar o antigo ser alimentado só pelo espelho.
