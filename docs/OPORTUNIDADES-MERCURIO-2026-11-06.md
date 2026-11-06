# Mapa do Mercúrio (banco de consulta) e o que ainda dá para mostrar no Portal — 06/11/2026

Levantamento só de leitura no `oinabview` (25 tabelas), comparado com o que o Portal já usa. Para cada ideia: de onde
vem o dado, se ele está de fato preenchido e para quem serve.

## O que o banco tem e o Portal ainda não usa

| Tabela / coluna | Conteúdo | Preenchido? |
|---|---|---|
| `cadastro.cad_midia_ingresso` + `sig_minscr` | Como a pessoa chegou à escola (contato pessoal, internet, propaganda paga, redes sociais, folhetos, aula de provacionismo...) | **Sim**: 74% no país (39.347 de 53.278); em BGA, 118 de 122 |
| `turmas.tur_previsao_formatura`, `tur_sala`, `tur_tipo` | Previsão de formatura, sala (ex.: PLATÃO, ONLINE) e tipo da turma | Sim, mas com previsões vencidas (BGA: AMON 28/07/2026, ESPECIAL 01/12/2025) |
| `dirigente_condecoracoes` + `sig_dirigente_condecoracoes` | Machado (1 a 4 correntes, cobre, prata, ouro), Tocha | 373 registros no país |
| `condecoracoes` + `sig_condecoracoes` | Ordem ao Mérito, Caduceu de Ouro, Brigadista do Ano | Só 6 registros |
| `dirigente_funcoes.dfn_abrangencia`, `dfn_conselho`, `dfn_regiao` | Alcance da função (local, regional, nacional) e conselho | Sim |
| `precos` | Preço de tabela de cada produto por unidade | 9.399 linhas |
| `sig_cursos_integra.sdu_data/local/instrutor` | Catálogo dos cursos de integração | Só passado: nenhum curso com data futura, então não serve como agenda |
| `reciboc.rec_formapg` | Forma de pagamento do recibo | **Vazio** em BGA em 2026: não usar |
| `cadastro.cad_machado` + `sig_dirigente_machado` | Situação de Machado (ativo, retiro, solicitação) | Em BGA, todos "???" |

O que o Portal **já usa**: cadastro, composição (`compaluno`), fichas e recibos (contribuição), turmas e matérias
(aparecem na agenda do aluno), cursos de integração feitos, funções (declarações e equipe), profissões, motivo de
baixa, níveis, unidades.

## Sugestões, por ordem de valor

### Para a direção e quem cuida das aberturas de turma

1. **De onde vêm os alunos.** Com `cad_midia_ingresso`: quantos alunos chegaram por cada canal e quantos de cada canal
   continuam ativos depois de 3, 6 e 12 meses. Responde se vale pagar propaganda (em BGA, 22 vieram por propaganda
   paga e 54 por contato pessoal). Cabe na Visão da filial e no relatório das aberturas.
2. **Alertas de qualidade do cadastro para a Escolástica**: turma com previsão de formatura vencida, aluno ativo sem
   turma, aluno sem canal de entrada. Entra em "Pendências e solicitações".

### Para o aluno

3. **Previsão de formatura e sala da turma** no cartão da turma ("Sua turma se forma em junho de 2027", "Sala Platão"
   ou "Online"). Mostrar só previsão futura, por causa das vencidas.
4. **Tempo de casa**: "Hoje faz 2 anos que você entrou na Nova Acrópole" (de `cad_ingresso`/`cad_reingresso`), como
   aviso no dia e numa conquista.
5. **Pedir a própria declaração de matrícula** pelo Portal. A Escolástica aprova e assina; reaproveita o gerador de
   declarações que já existe.

### Para o voluntário

6. **Minha trajetória**: as funções que exerceu, com período e alcance (local, regional, nacional), e as distinções
   (Machado, Tocha, Ordem ao Mérito...). Só a própria pessoa vê. **Precisa da decisão do usuário**: distinção pode
   ser assunto reservado na escola.

## Saúde do código (06/11/2026)

- `tsc`, `eslint` (projeto inteiro) e `next build`: limpos.
- Testes: 180 passam. Onze arquivos `.mjs` pareciam quebrados porque precisam da opção
  `--experimental-test-module-mocks` do Node. Agora há `npm test`, que roda todos do jeito certo.
- Sugestão: um GitHub Actions que rode `tsc`, `lint` e `npm test` a cada envio, antes do deploy da Vercel. Hoje
  nada impede subir código com teste quebrando.
