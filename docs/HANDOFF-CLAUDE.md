# Passagem de trabalho (Claude → Codex)

Atualizado em 23/10/2026. Este documento existe para que o Codex (ou outra sessão) retome o trabalho do Claude sem depender da conversa. Ele complementa, sem repetir:

- `docs/COORDENACAO-AGENTES.md`: quem mexe em quê; blocos 1 a 21 descrevem cada entrega e o que o Codex precisa respeitar.
- `docs/EVENTOS-PORTAL.md`: documento do Codex sobre eventos, Ulisses, Ágora e compartilhamento.

Regra de ouro: **antes de cada commit, `git pull --rebase --autostash`**. Os dois agentes publicam no mesmo `master`.

> **PRIORIDADE — cobranças (regra do usuário, 25/10/2026): toda cobrança do Portal sai SEMPRE pela subconta Asaas da filial**, para o aluno ver o nome da Nova Acrópole e **nunca** o da conta principal (que é a empresa do usuário, HENRIQUE ZANCHI AUDIOVISUAL E IDIOMAS LTDA). Vale para eventos, contribuição (Pix e cartão), Pix automático, recarga do Fortuna e site de matrículas.
> - Emitir: `contaDaEscola`/`contaDaEscolaId` (`lib/asaas/conta-escola.ts`) e passar a conta a cada função de `lib/asaas/client.ts` (último parâmetro `conta`). **Sem chave da subconta, a filial não cobra on-line**; nunca cair na conta principal. Não criar cobrança sem `conta`.
> - Margem do BPO: `splitDoBpo`/`splitDoBpoCartao` (`lib/asaas/split.ts`) mandam só a margem (100 − `PERCENTUAL_SPLIT_ESCOLA`) para a carteira da conta principal (`walletPrincipal`, ou `ASAAS_WALLET_ID_PRINCIPAL`). A taxa do Asaas sai da subconta.
> - Consultar, estornar ou excluir: `contaDeLeitura`/`contaDeLeituraId`; o cliente cai na conta principal só em 404 de `/payments/{id}` ou `/pix/automatic/authorizations/{id}` (cobranças antigas).
> - A chave fica em `School.asaasSubaccountApiKey`, **omitida por padrão em todas as consultas** (`omit` global em `lib/db.ts`), porque `member.school` vai para o navegador. Para ler: `select: { asaasSubaccountApiKey: true }` ou `omit: { asaasSubaccountApiKey: false }`.
> - Ligar uma filial: `npx tsx scripts/ligar-subconta-asaas.ts <UNIDADE>` (pede a chave sem mostrar, confere a carteira, grava e cadastra o webhook do Portal na subconta). Detalhes no bloco 51 da COORDENACAO.

---

## 1. Estado atual (o que está no ar)

| Frente | Situação | Onde está |
|---|---|---|
| PWA e notificações push | No ar. Chaves VAPID na Vercel e no `.env`. | Bloco 16; `public/sw.js`, `lib/push.ts`, `components/pwa/` |
| Avisos agendados | No ar (rotina a cada 5 min): encontros dos grupos, pedidos para Escolástica/Economia, evento novo, vencimento da contribuição, avisos de quem se inscreveu, lista de espera | `lib/notificacoes-agendadas.ts`, `/api/cron/notificacoes` |
| Agenda do aluno | Próximos eventos abaixo do dia, "Carregar mais", "Meus eventos" no topo da Agenda, ícone do WhatsApp em cada evento, botão "Inscreva-se" | `components/member/panels/agenda-panel.tsx` |
| Meus eventos | Página redesenhada (data em destaque, categoria, situação colorida, próximos/anteriores, recepção) | `app/(member)/eventos/page.tsx`, `components/member/meus-eventos.tsx` |
| Eventos internos | Lanche compartilhado, desistência pelo aluno (gratuita, PIX não pago, paga com devolução até o prazo), lista de espera, post oficial do Instagram | Blocos 17, 18 e 21 |
| Prova com temas | Matéria em curso + temas do catálogo; N1 tem prova única de conclusão | `lib/temas-curriculo.ts`, `create-activity-form.tsx` |
| Ulisses | Importação diária **funcionando** pela ponte na Cloudflare; ignora eventos "cópia" | Bloco 19; `lib/ulisses/publico.ts`, `lib/ponte.ts` |
| Leitura de cartaz por IA | No ar (Claude Haiku 5.5). Cada cartaz é lido uma vez, na importação diária | `lib/leitura-cartaz.ts` |
| Login | **Só o login unificado da Nova Acrópole** aparece. E-mail e senha só em `/login?modo=senha` (emergência) | Bloco 20; `lib/login-acropole.ts`, `app/auth/acropole/` |
| Biblioteca | Abre `bastiao.oinabn.com.br`; só para membros (2º nível em diante) | `study-area-panel.tsx`, `bibliotecaLiberada` em `member-data.ts` |
| Rótulo do topo | "Portal do Membro" para membros, "Portal do Aluno" para os demais | `member-portal-client.tsx` |
| Recife Boa Viagem (BOA) | Aberta: 266 ativos importados, 257 logins | `scripts/abrir-filial-db.ts` |
| Telas de TV (24/10) | Link público por TV (`/tv/<token>`, sem login): cartaz à esquerda, dados + QR de inscrição à direita, cada slide fica o tempo de leitura do texto (200 palavras/min + 3 s com cartaz, entre 5 e 45 s; `lib/tempo-tela.ts`, bloco 33), próximos 30 dias, públicos escolhidos por tela ("Aberto ao público" = Ulisses + públicos internos). Gestão em Eventos → aba "Telas (TV)" (área `eventos`). Tabela `TelaEventos` (RLS), migração `20261024120000_telas_eventos` aplicada. Atualiza dados a cada 5 min e recarrega a cada 6 h; TV vertical suportada. Descrição = resumo por IA (`Event.resumoTela`, migração `20261024180000_resumo_tela`), gerado no cron do Ulisses e pela TV; sem resumo, primeiras frases completas. Conexão pelo controle remoto (`/tv` mostra código + QR; voluntário conecta em `/tv/conectar` ou na aba), orientação girada por tela, conteúdos intercalados (matrículas, frase da semana, cartões da filial, programação, aniversariantes só em TV interna), margem de segurança contra overscan; migração `20261024210000_telas_conteudos_conexao` | Bloco 25; `lib/telas-eventos.ts`, `lib/telas-publicos.ts`, `components/tv/`, `app/tv/[token]/`, `components/director/telas-tab.tsx` |
| Frases nas TVs (25/10) | Lista padrão com 174 frases de 48 autores (`FRASES_COM_FONTE` em `lib/telas-frases.ts`), cada uma com link da fonte num site oficial da Nova Acrópole e conferida no original; a TV mostra a próxima frase a cada volta da rotação, a partir de um ponto sorteado (autores alternam). Cada filial pode ter a própria lista (aba Telas → Frases: incluir, editar, desativar, importar a padrão); filial sem frase ativa usa a padrão. Tabela `FraseTela` (RLS), migração `20261025120000_frases_tela` aplicada (autorizada). **Nunca alterar nem cortar uma citação**; frase sem fonte oficial não entra | Blocos 28 e 30; `lib/telas-frases.ts`, `components/director/frases-tela.tsx`, `actions/telas-actions.ts` |
| Visão geral (25/10) | Uma tela da filial ao nacional (`/voluntario/filial?alcance=`), índices por área; absorveu o Painel Nacional (`/nacional` redireciona) | Bloco 40; `lib/panorama.ts`, `components/panorama/panorama.tsx` |

### Testes (baseline em 23/10/2026)

`node --import tsx --experimental-test-module-mocks --test tests/*.test.mjs` → **79 testes, 50 passam, 29 falham**. As 29 falhas já existiam antes (área do Codex: pagamentos, eventos antigos, Ágora). Ao terminar uma mudança, compare a lista de falhas com a anterior; só falha **nova** é problema.

---

## 2. Segredos e configuração (só nomes; valores ficam no `.env` e na Vercel)

| Variável | Para quê | Onde |
|---|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Notificações push | `.env` + Vercel (Production) |
| `PONTE_URL`, `PONTE_CHAVE` | Ponte na Cloudflare para *.acropolebrasil.com.br | `.env` + Vercel + segredo `PONTE_CHAVE` no Worker |
| `ANTHROPIC_API_KEY` | Leitura dos cartazes | `.env` + Vercel |
| `CRON_SECRET` | Autoriza as rotinas da Vercel | `.env` + Vercel |
| `KEYCLOAK_CLIENT_SECRET` | Segredo do client `portal-aluno` quando o Marcos o tornar confidencial (ainda não existe em 23/10) | `.env` + Vercel (Production) |

Nunca usar `NEXT_PUBLIC_` para segredo. A chave pública VAPID chega ao navegador por `chavePublicaPush()` (server action).

### Rotinas da Vercel (`vercel.json`)

| Rota | Horário | O que faz |
|---|---|---|
| `/api/cron/ulisses` | todo dia 09:00 UTC (06:00 Brasília) | Importa eventos do Ulisses pela ponte e lê os cartazes novos |
| `/api/cron/notificacoes` | a cada 5 min | Todos os avisos push agendados |
| `/api/cron/event-refunds` | a cada 5 min | Fila de reembolso (Codex) |

Para rodar uma rotina na mão: `curl -H "Authorization: Bearer $CRON_SECRET" https://portal-na-one.vercel.app/api/cron/<nome>`.

### Ponte na Cloudflare

- Conta **de testes**: henriquecarr@gmail.com (migrar para a conta da escola; ver pendência 4).
- Código: `infra/ponte-cloudflare` (Worker `ponte-portal-na`, endereço `https://ponte-portal-na.ponte-portal-na.workers.dev`).
- **Fixada em `aws:us-east-1`** (`[placement]` no `wrangler.toml`). Motivo: chamada pela Vercel, a ponte rodava em São Paulo (GRU) e o Cloudflare da Nova Acrópole a desafiava; nos EUA passa.
- Diagnóstico sem chave: `curl https://ponte-portal-na.ponte-portal-na.workers.dev/diagnostico` (status de Ulisses, Ágora e login).
- Publicar: `cd infra/ponte-cloudflare && npx wrangler deploy` (exige `npx wrangler login` na conta certa; o login expira em 2 min sem clique).
- No Portal, toda chamada a *.acropolebrasil.com.br usa `fetchAcropole()` de `lib/ponte.ts`.

---

## 3. Como fazer (passo a passo)

### Migração de banco (padrão do projeto)

1. Editar `prisma/schema.prisma`.
2. Criar `prisma/migrations/<AAAAMMDDHHMMSS>_<nome>/migration.sql` à mão. **Tabela nova termina com `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;`**.
3. `npx prisma db execute --file prisma/migrations/<pasta>/migration.sql`
4. `npx prisma migrate resolve --applied <pasta>`
5. `npx prisma generate`
6. Conferir: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script | grep -i <campo>` deve voltar vazio para o que foi criado. (Há diferenças antigas que não são nossas: `Member_responsavelId_idx` e a FK de `Event.schoolId`.)

### Conferência visual de uma tela

Não há conta de teste no banco. O Claude criava uma página temporária `src/app/previa-temp/page.tsx` com dados de exemplo, subia `npx next dev -p 3123`, tirava print com um script Playwright em `scripts/tmp/` e **apagava os dois** antes do commit. Depois de apagar, remover `.next/dev/types/validator.ts` se o `tsc` reclamar de `previa-temp`.

### Antes de cada commit

`npx tsc --noEmit` (ignorar avisos de `PageProps`/`LayoutProps` quando o servidor de desenvolvimento não está rodando), `npx eslint <arquivos>`, testes acima, `git pull --rebase --autostash`. Mensagem de commit em português, terminando com a linha de coautoria.

### Login unificado (Keycloak)

- Realm `oinabnb`, base `https://auth.acropolebrasil.com.br/as/`, client `portal-aluno` com PKCE. Nasceu público (orientação do Heitor); em 23/10 o usuário decidiu **torná-lo confidencial** para o token exchange com o Ágora. `lib/login-acropole.ts` manda `client_secret` (client_secret_post) quando `KEYCLOAK_CLIENT_SECRET` existe; sem a variável, segue como público.
- **Ordem da virada (senão o login para):** Marcos liga "Client authentication" no `portal-aluno` e passa o segredo → no mesmo momento gravar `KEYCLOAK_CLIENT_SECRET` na Vercel (Production) e no `.env` → redeploy na Vercel → testar o login. Enquanto a variável não estiver na Vercel, ninguém entra pelo login unificado.
- Endereços de retorno cadastrados pelo Heitor: `https://portal-na-one.vercel.app/auth/acropole/callback` e `http://localhost:3000/auth/acropole/callback` (por isso testar local na **porta 3000**).
- O Portal acha o cadastro pelo **e-mail confirmado** (`email_verified === true`), abre a sessão Supabase por magic link gerado no servidor e, se o cadastro ativo ainda não tinha login, cria um. **Nunca recriar login existente** (trocaria a senha).

---

## 4. Pendências, em ordem de prioridade

1. **Testar o login unificado de ponta a ponta.** Até 23/10 só a ida ao Keycloak foi confirmada (tela "Entrar em Organização Internacional Nova Acrópole"). Passo: entrar em `portal-na-one.vercel.app/login` numa janela anônima com uma conta real. Se falhar, olhar os logs da Vercel (`Login Nova Acrópole:`); se o Keycloak não mandar e-mail, o log lista os nomes dos campos recebidos. Depois de confirmado, remover o formulário de senha (`comSenha` em `login-client.tsx` e `?modo=senha` em `app/login/page.tsx`).
2. **Sincronização diária do Mercúrio está desligada.** A rotina antiga do Railway apagava participantes de grupos do Portal (código velho, deploys pausados porque a conta de teste do Railway está inativa); o horário dela foi zerado em 21/10. O banco de consulta do Mercúrio está parado desde 17/10 (cobrar o João Guilherme). Próximo passo: levar `scripts/sync-mercurio-db.ts` para uma rotina da Vercel (o importador atual só remove vínculos de `TIPOS_DO_MERCURIO`). **Não religar antes de o banco de consulta voltar a ser atualizado**, senão traz dados velhos de pagamento por cima. **Atualização 25/10:** o João Guilherme trocou `cadastro`, `reciboc` e `reciboi` por *views* (dados online, sem carga; recibos do dia já aparecem). `reciboc`/`reciboi` têm todas as colunas usadas; a view `cadastro` está **sem `cad_dirigente`, `cad_pedagogo` e `cad_empresa`** — o resumo da filial e o de profissões falham ("Unknown column") e a importação marcaria todos como não dirigentes. `sincronizarUnidade` agora confere as colunas antes de gravar e para com mensagem clara se faltar alguma. Depois que as 3 colunas voltarem, o bloqueio de "banco parado" deixa de existir e dá para religar a rotina. **Atualização 25/10 (tarde):** a view continua sem as 3 colunas; a importação passou a rodar mesmo assim, **mantendo** `isDirigente` e `isPedagogo` (instrutor de turma ativa ainda vira pedagogo) e contando dirigentes pelo Portal no resumo da filial; profissões classificam sem `cad_empresa`. Quando as colunas voltarem, tudo volta a usá-las sozinho (`colunasDoCadastro()` em `mercurio-db/client.ts`). **Atualização 26/10:** o João Guilherme incluiu `cad_dirigente` ("S"/"N"), `cad_empresa`, `cad_recuperado` e o pedagogo, que veio com o nome **`cad_cad_pedagogo`** (digitação; valores FOR, INS, HC, HO, HP e "???" = não). A importação aceita os dois nomes. `cad_contribuicao` não volta (sem uso há mais de 10 anos). Recibos com data futura são normais: compensação bancária de fim de semana/feriado entra no dia útil seguinte. **Cuidado:** `fichas` continua sendo cópia de 17/10 (só cadastro/recibos viraram views). A importação de 25/10 manhã regravou meses pagos depois de 17/10 como "em branco"; corrigido no mesmo dia: mês com recibo válido (não cancelado) de item da composição (`compaluno`) conta como pago, e mês pago pelo Portal (Asaas, `mercurioRecId` nulo) nunca volta a "em aberto". Todas as filiais foram reimportadas.
3. **Ágora.** Mapeado em 22/10: front Angular em `eventos.acropolebrasil.com.br` (rotas com `#/`), API Spring em `/api` com sessão por cookie + CSRF; dados exigem login. Endpoints úteis: `GET /api/eventos/slug/{slug}`, `/api/eventos/periodo`, `/api/eventos/acoes`, `/api/evento-pagamentos/primeiro-lote-vigente`, `/api/eventos/inscricoes/minha`. A inscrição tem formulário próprio por evento, lotes e pagamento próprio: **não refazer no Portal**. Plano: Portal lista os eventos do Ágora e o botão leva a `#/e/<slug>` já logado pelo login unificado. Falta do Marcos uma chave de leitura (ou client de serviço no Keycloak) para listar eventos por unidade.
   - **Nova direção (Heitor, 23/10): sem papéis nem cópia no Portal.** O Portal vira um túnel: chama a API do Ágora com o token do próprio aluno (login unificado), sem pedir senha de novo. Prioridade é o Ágora; o Diário de Classe ficou para depois (pedido do usuário).
   - Sondagem de 23/10: o Ágora usa o client `eventos` no realm `oinabnb` (login: `/api/sso` → Keycloak → `/api/login-sso?code=` → cookie `JSESSIONID`). Com `Authorization: Bearer <lixo>` a API responde 500 (com `Basic`/`Token`, 403): **há filtro de Bearer no backend**.
   - Teste com token real do usuário (`node scripts/testar-token-agora.mjs`, abre o login no navegador, retorno em `localhost:3000`, porta precisa estar livre): token do `portal-aluno` tem `aud: "account"`, `azp: portal-aluno`, escopos `openid email profile`, validade 120 min; refresh 720 min. **O Ágora recusou (403)** em `/usuarios/usuario-logado`, `/eventos/periodo`, `/eventos/inscricoes/minha` e `/sedes`. Causa provável: o token não traz `eventos` no `aud`.
   - **Decisão do usuário (23/10): `portal-aluno` confidencial + Standard token exchange** (a documentação do Keycloak não permite troca por client público). Pedido ao Marcos: ligar "Client authentication" e "Standard token exchange" no `portal-aluno`; permitir que o token trocado tenha `eventos` no `aud` (as audiências vêm dos client scopes/papéis do client que pede a troca — ex.: client scope opcional com mapper Audience `eventos`); confirmar se a API do Ágora aceita Bearer ou só sessão. Ordem da virada na seção 3 ("Login unificado").
   - **Estado em 23/10, 14h30:** Heitor tornou o `portal-aluno` confidencial; `KEYCLOAK_CLIENT_SECRET` está no `.env` e na Vercel (Production), e a produção foi republicada (login com segredo confirmado em teste local). Token exchange respondeu **501 "Feature not enabled"**: o Keycloak deles é anterior à versão com troca padrão (não há `token-exchange` em `grant_types_supported` do `.well-known`). Heitor confirmou e vai **priorizar a migração do Keycloak**; depois disso, rodar o reteste. Alternativa que não depende da migração: mapper **Audience** `eventos` no access token do `portal-aluno` (client scope padrão/dedicado) e usar o token do login direto no Ágora. O token do login ainda sai com `aud: account`.
   - Pedido ao Marcos (22/10) de alterar a "API de consulta" com os campos de exibição: **provavelmente desnecessário** no modelo túnel (a API do site já entrega os dados e aplica as regras de visibilidade). O usuário vai pedir para pausar, depois do teste com token aceito.
   - Reteste: `node --env-file=.env scripts/testar-token-agora.mjs` (com `KEYCLOAK_CLIENT_SECRET` no `.env`). O script testa o token do login e depois troca por um token com `audience=eventos`. 200 em `/usuarios/usuario-logado` com o token trocado = túnel liberado.
   - Do lado do Portal, quando liberar: guardar o token/refresh do aluno criptografado ligado à sessão (hoje é descartado no callback, `app/auth/acropole/callback/route.ts`), renovar pelo refresh, chamar o Ágora pela ponte. Avisos push de evento novo continuam pela importação pública do Ulisses (sem aluno logado não há token).
4. **Migrar a ponte para a conta Cloudflare da escola**: `npx wrangler login` na conta da escola → `npx wrangler deploy` → `npx wrangler secret put PONTE_CHAVE` (pode gerar chave nova) → trocar `PONTE_URL`/`PONTE_CHAVE` no `.env` e na Vercel → rodar `/api/cron/ulisses` e conferir 7 de 7 filiais.
5. **Catálogo de temas**: faltam as listas das demais matérias (só N1/NET-NSC-NFH, PSI 1-13 e ISO/IS1 estão em `lib/temas-curriculo.ts`). Base também para o currículo dos instrutores e para as apostilas (seção 5).
6. **Recife Boa Viagem**: 9 pessoas sem login (1 sem e-mail; 8 com e-mail usado por outra conta). Com o login unificado, cada uma precisa de e-mail próprio no cadastro da escola.
7. **Grupos de Barra do Garças**: os 6 grupos do Portal perderam os participantes (rotina antiga do Railway). O usuário vai reincluir à mão.

---

## 5. Em análise: controle de apostilas (pedido do usuário em 23/10/2026)

### O que o usuário quer

Estoque de apostilas por matéria e tema, na Escolástica:

- baixa automática quando a apostila é entregue em aula, só para os presentes, registrando quem já recebeu cada apostila;
- previsão de quantas serão necessárias e quando, pelo planejamento de aulas;
- pedido de impressão com antecedência quando o estoque não cobrir uma aula futura. Exemplo: 10 de Ética tema 3, aula de 24/10 para 8 pessoas e de 15/11 para 12; avisar uma semana antes quantas imprimir;
- dia fixo de impressão por filial (semanal, quinzenal ou mensal), com um relatório único do que imprimir.

### Achado importante (23/10)

**O banco de consulta do Mercúrio não guarda presenças.** São 26 tabelas: cadastro, turmas, `turmas_materias`, `sig_materias`, fichas, recibos e afins; nada de frequência, diário, aula ou estoque. As presenças ficam só no **Diário de Classe** (`pedagogia.acropolebrasil.com.br`), que é da Acrópole Brasil e fica atrás do mesmo Cloudflare (usar a ponte).

### Mapeamento do Diário de Classe (23/10, só código público, sem login)

- Front Angular em `pedagogia.acropolebrasil.com.br`, API Spring em `/api`, atrás do mesmo Cloudflare (usar a ponte; `auth`/`eventos`/`api` já estão liberados nela, **`pedagogia` ainda não está em `ALLOWED`** de `infra/ponte-cloudflare/src/index.ts`).
- Login igual ao do Ágora: `/api/sso-url` + `/api/login-sso` (Keycloak), sessão por cookie + CSRF (`/api/csrf` devolve `X-XSRF-TOKEN`). Há também login com credencial do Mercúrio (rota de tela `auth/login-mercurio`). Dados exigem login (403). Versão `/api/versao` = 26.10.4 (Ágora 26.10.5): mesma base de código, provavelmente da mesma equipe do Ágora (Marcos) — **confirmar quem é o responsável**.
- **O Diário já tem estoque de apostilas**, só sem automação:
  - Estoque: telas `material/estoque` ("Estoque de Impressão de Material", com **estoque mínimo** `minEstoque`), API `GET/POST/DELETE /api/estoque-materiais`.
  - Solicitações de impressão: tela `material/impressao` (matéria, tema, turma, quantidade, detalhe, data de impressão, data de entrega; "Registrar que foi Impresso", "Registrar que foi entregue ao solicitante"; filtros "só não impressos/não entregues"), API `GET/POST /api/impressoes-materiais`, `PUT /api/impressoes-materiais/{id}/impressao`, `PUT .../{id}/entrega`.
  - Entrega de material didático aos alunos: tela `material/entregar` e `material/relatorio`, API `GET/POST /api/entregas-tema`, `GET /api/entregas-tema/last`, `GET /api/entregas-tema/relatorio`.
  - Planejamento: tela `planejamento/edit`, API `GET/PUT/DELETE /api/materias/{id}/planejamentos`, `/api/planejamentos/{id}`, `/api/planejamentos/ultimo`, `/api/planejamentos/{id}/capitulos/{cap}`, `GET /api/materias/{id}/temas`, `GET /api/capitulos`.
  - Aulas e presença: tela `aulas/registrar`, API `GET/POST /api/aulas`, `/api/aulas/{id}`, `/api/aulas/registro-quick`, relatórios `/api/aulas/relatorios/*` (resumo de presenças, faltas consecutivas, sem registro…); turmas `GET /api/turmas/{id}/alunos`, `/api/turmas/{id}/materias-turma`.

### Recomendação (revisada após o mapeamento)

**Não criar um estoque paralelo no Portal.** O estoque, as solicitações de impressão e as entregas continuam no Diário (fonte única). O Portal entra como **camada de automação** em cima dos dados do Diário, lendo e gravando pela API dele:

1. **Baixa automática:** quando o professor registra a aula no Diário, o Portal (rotina de 5 em 5 minutos) vê a aula nova, pergunta ao professor por push "Entregou as apostilas de <matéria> tema <n>?" e, no "Sim", grava no Diário a entrega (`/api/entregas-tema`) para os alunos presentes, o que baixa o estoque.
2. **Previsão:** cruza o planejamento (aulas futuras por turma, matéria e tema) com o número de alunos da turma e o estoque; projeta o saldo de cada apostila por data.
3. **Pedido de impressão:** no dia de impressão da filial (semanal, quinzenal ou mensal, configurado no Portal), cria no Diário as solicitações (`/api/impressoes-materiais`) de tudo o que faltará até o próximo dia de impressão, e manda à Escolástica um relatório único do que imprimir.
4. **Faltosos (o usuário disse que em geral recebem depois):** a lista "quem ainda não recebeu" vem de presentes × entregas registradas; entra no relatório e na pergunta ao professor da aula seguinte.

**Pré-requisito:** acesso de serviço à API do Diário (chave de leitura e escrita, ou client de serviço no Keycloak), pedido ao responsável técnico. Extensão do Chrome continua sendo último recurso.

### Respostas do usuário (23/10) e o que ainda falta

- Planejamento das aulas: **no Diário de Classe**.
- Responsável técnico pelo Diário: **o usuário ainda não sabe** (hipótese: equipe do Ágora/Marcos, pela base de código igual).
- Faltosos: **em geral recebem depois**.
- Pedido ao usuário: prints das telas `material/estoque`, `material/impressao`, `material/entregar`, `material/relatorio`, `planejamento/edit` e `aulas/registrar`, para mapear os campos antes do acesso à API.


## Correção da Escolástica — 23/10/2026

Erro reproduzido: `/escolastica` falhava com `ABAS_ESCOLASTICA is not iterable`. A página Server Component tentava espalhar uma constante exportada por `components/trabalho/areas.tsx` (`use client`). Configuração movida para `lib/abas-escolastica.ts`, módulo neutro, e imports das páginas principal/avaliação corrigidos. Permissões e dados preservados. Não reexportar configuração compartilhada por módulos client para uso no servidor. Reprodução local antes: HTTP 500; depois: HTTP 200, quatro links corretos e nenhum erro JavaScript em desktop/mobile. Rota temporária de verificação removida antes da publicação.

## Site de matrículas — onde fica o link (25/10/2026)

Cada abertura tem um link público `/matricula/<token>` (Fase 1, bloco 48 da COORDENACAO). O link aparece numa faixa verde "Link de matrícula" com **Abrir** e **Copiar link** em dois lugares: no cartão da abertura (Aberturas de Turmas → Suas aberturas) e no detalhe da abertura selecionada (Planejamento). Para fechar ou reabrir: Editar parâmetros → "Matrículas pelo site". A página pública não mostra a sala (pedido do usuário). Detalhes no bloco 49.

## Atendimentos individuais com o instrutor (25/10/2026)

Instrutor: Instrutor → "Atendimentos individuais" (`/professor/atendimentos`) abre faixas de horário. Aluno: Agenda → "Conversar com meu instrutor" (`/atendimentos`). Direção/Escolástica/nacional: Escolástica → "Atendimentos dos instrutores". Horários no fuso da filial (UF). Detalhes, tabelas e regras no bloco 50 da COORDENACAO. Para rodar os testes e comparar com a linha de base: `npx tsx --experimental-test-module-mocks --test tests/*.test.ts tests/*.test.mjs` (30 falhas antigas).

## Asaas — subconta de Barra do Garças (25/10/2026)

- Subconta "ORGANIZACAO NOVA ACROPOLE" (tipo associação) é a wallet de BGA (`School.asaasWalletId`). Link de ativação/senha reenviado pela API (`POST /v3/accounts/{id}/resendActivationLink`, a pedido do usuário). **Só pode ser reenviado uma vez**; não repetir.
- Próximo passo: o usuário entra na subconta, gera a chave em Integrações → Chaves de API e a chave é gravada em `School.asaasSubaccountApiKey` por stdin (nunca no chat). Aí o site de matrículas passa a cobrar.
- Não ligar whitelist de IP na conta principal (a Vercel não tem IP fixo; quebraria a cobrança dos eventos). Criar subcontas pela API inicia o "período de avaliação" do Asaas (limite de R$ 2.000 por subconta até a homologação regulatória). A conta principal é a empresa do usuário; cobrança por split mostraria esse nome.
