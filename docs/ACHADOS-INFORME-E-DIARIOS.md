# Achados de apoio: informe mensal e diários

Material levantado em 18/10/2026 para completar `CONTINUIDADE-VOLUNTARIADO-DIARIOS.md`. Lá estão registrados dois bloqueios: o formulário do informe não pôde ser lido, e a versão publicada dos diários não pôde ser conferida. Este documento cobre os dois. Nada aqui foi implementado.

## Informe mensal: estrutura real do formulário

Fonte: o Google Form indicado, lido a partir dos dados públicos do próprio formulário. São 8 páginas, transcritas abaixo na ordem original. Os campos marcados com `*` são obrigatórios.

Descrição do formulário: "Prezados Ch Filial — Por favor preencher as informações abaixo de forma sintética. O Relatório é uma ótima oportunidade para refletirmos sobre o andamento da estrutura e sobre quais pontos podemos atuar para melhorar nossa ação e a formação de nossos discípulos."

1. **Página inicial**
   - E-mail * (resposta curta)
2. **IDENTIFICAÇÃO**
   - Responsável pelo Preenchimento * (resposta curta)
   - Região * (múltipla escolha): Centro-Oeste | Distrito Federal | Nordeste | Norte
   - Filial * (lista suspensa). São 75 opções no formato "UF - Cidade - Bairro", por exemplo "GO - Goiânia - Setor Universitário" e "MT - Barra do Garças".
   - Competência * (lista suspensa): MAIO/2026 … DEZEMBRO/2026
3. **Resumo e avaliação do Chefe sobre o andamento da Filial.** O formulário avisa: "Nenhum dos tópicos abaixo são obrigatórios. São só indicativos para auxiliar a análise do Ch. Filial". Todos são parágrafos:
   - Difusão do Curso de Filosofia e Captação de Novos Alunos
   - Formação e Desenvolvimento dos Membros
   - Economia e Geração de Recursos
   - Manutenção e Melhorias da Escola
   - Grupos de Acompanhamento Filosófico / Nível Preliminar
   - Plano de Recuperação dos ex-membros
   - Provacionistas de FFVV
   - Formação das FFVV e GDVE
   - Formação de Instrutores e Dirigentes
   - Auto análise sobre a Condução da Filial
4. **Atividades mais destacadas.** O formulário pede: "comentar somente as atividades mais destacadas de cada círculo". Todos são parágrafos:
   - 1º Círculo (FFVV)
   - 2º Círculo (Membros)
   - 3º Círculo (Nível 1 / Público Externo)
5. **Visitas do DN e Dirigentes – ATIVIDADES COM MEMBROS**
   - Dirigente - MEMBROS * (múltipla escolha): NÃO HOUVE VISITA | DN Luis Carlos | Ana Beatriz | Carlos Rangel | José Henrique | Ana Cristina | Eduardo Rosa | Renata Peluso | Luiz Fernando
   - Data
   - Tema (parágrafo)
6. **Visitas … – ATIVIDADES COM FFVV.** Mesmos três campos ("Dirigente - FFVV *", Data, Tema).
7. **Visitas … – ATIVIDADES COM INSTRUTORES.** Mesmos três campos.
8. **Visitas … – OUTRAS ATIVIDADES.** Mesmos três campos.

No Portal, as páginas 1 e 2 podem vir preenchidas sozinhas: e-mail e responsável a partir do login, filial e região a partir da `School`, competência a partir do mês corrente.

### Quem acompanha cada filial (dado oficial do Mercúrio)

O campo `unidades.uni_coordenador` traz a matrícula do dirigente que acompanha a filial. Os nomes coincidem com a lista de dirigentes do formulário. Situação das unidades ativas em 18/10/2026:

| Coordenador(a) | Matrícula | Filiais |
|---|---|---|
| Carlos Rangel Neves Otto | 3006 | ASU, ATI, BOA, CAM, CAR, DER, FAT, FME, FMS, FOR, FSL, JPE, JUA, MOS, NAT, NCA, NNP, NPT, NZN, PET, PTN, SBL (22) |
| Ana Cristina Machado | 119 | ALT, APS, ARA, BGA, CAT, CBA, CNP, ELD, GAR, GY2, GYN, ITU, JAM, PER, PLM, RON, RVD, SIN, SOR, STO (20) |
| Renata Peluso de Oliveira | 557 | ACL, ASL, ASN, CLD, GAM, GUA, LGS, SAM, SMA, SOB, SUD, TAG, VAL (13) |
| Eduardo Francisco Rosa | 129 | ANA, ANG, BLM, BVI, MAN, MCP, PNB, PTV, RBR, SLM, TER (11) |
| Luciane Manuela Passos Bittar | 6451 | BSB, PLA |
| Gustavo Tomás Costa | 3650 | BOD |
| (sem coordenador) | 0 | ACP, AGO, FNA, ITA, MSJ, SER |

Isso pode ser a base de "chefe de grupo lê os informes dos membros do seu grupo". **Falta o responsável confirmar** que `uni_coordenador` é esse grupo de leitura antes de usá-lo como regra de acesso. Consulta usada:

```sql
SELECT u.uni_coordenador, c.cad_nome, GROUP_CONCAT(u.uni_id) FROM unidades u LEFT JOIN cadastro c ON c.cad_matr = u.uni_coordenador WHERE u.uni_ativa = 'S' GROUP BY 1, 2
```

## Diários: qual código está realmente publicado

Para conferir, baixei o pacote JavaScript de cada site no ar e procurei textos que só existem em uma das versões do código.

- **https://diario-filosofico-fv.vercel.app/** (`/assets/index-BI73-fzq.js`) **corresponde ao HEAD** do repositório `diario-filosofico-fv`.
  - Contém: "Firmar Compromisso", "Acesso Restrito", "Pedidos de Acesso", "Balanço de Serviço", `carta-degrau`, `gdve-groups`, "Trilha de Formação", "Relatório Mensal do Ciclo", "O Guardião".
  - Não contém: Gemini, "Tutor Socrático".
- **https://diario-filosofico-azure.vercel.app/** (`/assets/index-OCsX5XJC.js`) **NÃO corresponde ao HEAD `9a35b21`** do repositório `diario-filosofico`.
  - Corresponde ao commit `3215147` ("abre novamente"). Nesse commit, o `src/App.jsx` é idêntico ao de `ba1fd8e`.
  - Contém: "Salvar Prólogo", as três perguntas do Epílogo ("Em que falhei hoje?", "O que fiz bem?", "O que deixei de fazer?"), "Tutor Socrático", "Olho de Argos", chamadas ao Gemini.
  - Não contém: "Acesso Restrito", "O Guardião", `fvStatus`.
  - O HEAD acrescenta, sem publicar: bloqueio por `fvStatus`, tela Guardião gravando em `userSettings` e um seletor de data quebrado (`currentDate`/`setCurrentDate` não declarados).
  - Para portar o comportamento que os membros usam hoje, use `git show 3215147:src/App.jsx`. Para estruturas de dados, considere as duas versões, porque `userSettings` só existe no HEAD.
- **Pastas aninhadas antigas:** `diario-filosofico-fv/diario-filosofico-fv/` (último commit em 13/05) é uma cópia antiga com git próprio. Ignorar.

O diário FV tem dois defeitos já no código publicado. Isso importa se alguém pensar em reaproveitar essas telas:
- `getFvMonthlyTotals` não está definido, e a exportação "Relatório CD (TXT)" quebra.
- `totalPraticasPsicologia` não está definido, e "Gerar Relatório e Copiar" do Relatório Mensal do Ciclo quebra.
