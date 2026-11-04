# Espelho Mercúrio novo → antigo: o que fazer no Mercúrio antigo, item por item

Enquanto uma filial lança no Mercúrio novo e as outras escolas e os dirigentes ainda leem o antigo, tudo o que entra
no novo precisa ser copiado para o antigo. O Portal compara os dois toda noite e lista as diferenças em
**/espelho-mercurio**. Cada item da lista mostra os dados e o mesmo passo a passo deste documento. O robô faz o que
souber, e o que ele não souber ou não conseguir fica para a secretaria fazer à mão.

**Regra geral:** o Mercúrio novo é o que vale. Depois de fazer à mão, clique em **"Fiz no antigo"** no item e, se for
dinheiro, anote o número do recibo gerado no antigo.

**Telas "A CONFIRMAR":** são telas que o robô ainda não percorreu. Quem fizer pela primeira vez anota o caminho certo
aqui **e** em `src/lib/espelho-mercury/manual.ts`, que é a mesma lista mostrada na tela. Este documento é gerado a
partir desse arquivo: se mudar um, mude o outro.

## Resumo: o que o robô faz e o que fica à mão

| O que mudou no novo | Quem faz no antigo |
|---|---|
| Contato (celular, telefone, e-mail, cidade, UF) | Robô |
| Dados pessoais (nascimento, naturalidade, profissão, estado civil, escolaridade, RG) | Robô |
| Composição da contribuição (incluir, excluir, alterar valor) | Robô |
| Pagamento de contribuição de **um** mês | Robô, no caixa do dia do pagamento. Se o dia estiver fechado, vai para a secretaria |
| Pagamento de vários meses num recibo só | Secretaria |
| Recibo que não é contribuição (evento, livraria, doação...) | Secretaria |
| Cancelamento de recibo | Secretaria, depois de conferir (não tem volta) |
| Aluno novo | Secretaria |
| Inativação, reingresso, nível, turma, data de ingresso | Secretaria |
| Turma nova | Secretaria |
| Despesas e outras entradas do caixa (movimento do mês) | Secretaria. O novo só informa o total por rubrica |
| Cargos e funções | Secretaria |
| Matrícula em conflito; ativo no antigo e ausente no novo | Conferir antes |

Para ensinar o robô alguma das tarefas manuais: mapear a tela só lendo (como em `scripts/mercurio-read-test.ts`),
testar a gravação num cadastro de teste (`scripts/mercurio-write-test.ts`), criar o método no adaptador
(`src/lib/mercurio/adapter.ts`), um novo `TipoRobo` em `src/lib/espelho-mercury/tipos.ts` e o caso em `aplicar.ts`.
Para despesas existe a ferramenta irmã `C:\Scrapper\mercurio-tesouraria`, citada em `browser-session.ts`, que já
lança despesa no caixa.

---

## Cadastrar aluno novo

*só à mão*

1. Primeiro procure a matrícula em CADASTRO da filial → Inativos. Se ela estiver lá, é reingresso (veja "Reativar aluno"), não cadastro novo.
2. Mercúrio antigo → CADASTRO da filial → inclusão de novo cadastro (A CONFIRMAR: nome exato do botão/menu).
3. Use EXATAMENTE a matrícula do Mercúrio novo. Se o antigo não deixar escolher o número, pare e avise: a matrícula vai divergir entre os dois sistemas.
4. Preencha nome, data de ingresso, nível e turma; depois as abas ENDEREÇOS, PESSOAIS e IDENTIFICAÇÃO com os dados abaixo.
5. Monte a composição da contribuição (Tesouraria → composição do aluno) com os itens abaixo.

## Matrícula em conflito

*só à mão*

1. Não lance nada para esta pessoa até resolver.
2. Se é a mesma pessoa em outra unidade: faça a transferência para esta filial no antigo (A CONFIRMAR: caminho da transferência).
3. Se é outra pessoa: a matrícula foi gerada em duplicidade. Avise o Gabriel (Mercúrio novo) e o João Guilherme (antigo).

## Ativo no antigo, ausente no novo

*só à mão*

1. Confira no Mercúrio novo se a pessoa foi migrada (busca por nome e por matrícula).
2. Se saiu da escola: inative no novo; na próxima rodada o Portal pede a inativação no antigo.
3. Se ficou fora da migração: peça ao Gabriel para incluir.

## Inativar aluno

*só à mão*

1. Mercúrio antigo → CADASTRO da filial → Ativos → clique no nome.
2. Faça a baixa/inativação com a data e o motivo abaixo (A CONFIRMAR: aba/botão da baixa, provavelmente HISTÓRICO).

## Reativar aluno (reingresso)

*só à mão*

1. Mercúrio antigo → CADASTRO da filial → Inativos → clique no nome.
2. Registre o reingresso (A CONFIRMAR: caminho exato) e confira nível e turma.

## Alterar nível

*só à mão*

1. Mercúrio antigo → CADASTRO da filial → Ativos → clique no nome.
2. Troque o nível para o valor correto abaixo e grave (A CONFIRMAR: em que aba fica o nível).

## Alterar turma

*só à mão*

1. Mercúrio antigo → CADASTRO da filial → Turmas → abra a turma correta e inclua o aluno; ou pela ficha do aluno (A CONFIRMAR).
2. Se a turma ainda não existe no antigo, crie a turma primeiro (veja "Criar turma").

## Corrigir data de ingresso

*só à mão*

1. Mercúrio antigo → CADASTRO da filial → Ativos → clique no nome.
2. Corrija a data de ingresso para a data abaixo e grave (A CONFIRMAR: aba).

## Atualizar contato

*o robô faz (com aprovação)*

1. Mercúrio antigo → CADASTRO da filial → Ativos → clique no nome → aba ENDEREÇOS.
2. Celular/WhatsApp vai em DDD + Fone; telefone alternativo em DDD + Celular (campos da direita); e-mail, cidade e UF nos campos com esse nome.
3. Clique em Gravar.

## Atualizar dados pessoais

*o robô faz (com aprovação)*

1. Mercúrio antigo → CADASTRO da filial → Ativos → clique no nome.
2. Aba PESSOAIS: nascimento (dia/mês/ano), naturalidade, estado civil, escolaridade, profissão. Gravar.
3. Aba IDENTIFICAÇÃO: RG. Gravar.

## Incluir item na composição

*o robô faz (com aprovação)*

1. Mercúrio antigo → ficha do aluno → Composição das Contribuições (Tesouraria, tela tes_conedit).
2. Inclua o item abaixo e ajuste o valor para o indicado. Gravar.

## Excluir item da composição

*o robô faz (com aprovação)*

1. Mercúrio antigo → ficha do aluno → Composição das Contribuições.
2. Exclua o item abaixo (ele não existe mais no Mercúrio novo).

## Alterar valor na composição

*o robô faz (com aprovação)*

1. Mercúrio antigo → ficha do aluno → Composição das Contribuições.
2. Altere o valor do item abaixo para o valor correto. Gravar.

## Composição sem correspondência

*só à mão*

1. Os nomes dos itens no Mercúrio novo não batem com o catálogo do antigo.
2. Na Composição das Contribuições do antigo, escolha o item equivalente e ajuste o valor, conferindo o total final com o do novo.
3. Se for sempre o mesmo nome divergente, avise para o Portal aprender a correspondência.

## Lançar pagamento de contribuição

*o robô faz só em parte*

1. Mercúrio antigo → TESOURARIA da filial → Caixas → escolha o caixa da filial → navegue até o mês → abra o DIA DO PAGAMENTO (abaixo).
2. Recebimento → Contribuições → digite a matrícula → marque o(s) mês(es) abaixo → confira o total com o valor abaixo → Lançar.
3. Finalize o recibo. Se o dia já estiver fechado, lance no dia de hoje e anote a data real do pagamento na observação.
4. O robô só faz quando o recibo é de um mês só; recibo com vários meses fica para a secretaria.

## Lançar recibo que não é contribuição

*só à mão*

1. Veja no Mercúrio novo o recibo indicado (número abaixo) para saber a rubrica (evento, doação, livraria...).
2. Mercúrio antigo → TESOURARIA → Caixas → dia do pagamento → Recebimento → escolha a mesma rubrica, mesmo valor e mesmo interessado.

## Cancelar recibo

*só à mão*

1. Confira no novo que o cancelamento é mesmo definitivo: cancelar no antigo não tem volta.
2. Mercúrio antigo → TESOURARIA → Recibos Emitidos → mês do recibo → abra o recibo do antigo indicado abaixo → cancelar (A CONFIRMAR: botão).

## Criar turma

*só à mão*

1. Mercúrio antigo → CADASTRO da filial → Turmas → nova turma (A CONFIRMAR: botão).
2. Use o mesmo nome, nível, dia e horário do Mercúrio novo (abaixo).

## Conferir movimento do caixa do mês

*só à mão*

1. O Mercúrio novo só informa os totais por rubrica do mês (abaixo), não cada lançamento.
2. Recibos de alunos já aparecem como pendências separadas. Aqui o que importa são as SAÍDAS (despesas) e entradas que não são recibo de aluno.
3. Mercúrio antigo → TESOURARIA → Caixas → lance cada despesa no dia em que ocorreu (pegue os detalhes no Mercúrio novo) até os totais por rubrica baterem.

## Conferir função/cargo

*só à mão*

1. A pessoa tem cargo no Mercúrio novo e nenhuma função atual no antigo.
2. Mercúrio antigo → ficha da pessoa → funções de dirigente (A CONFIRMAR) → inclua a função com a data de início.

