# Passagem de trabalho (Claude → Codex)

Atualizado em 23/10/2026. Este documento existe para que o Codex (ou outra sessão) retome o trabalho do Claude sem depender da conversa. Ele complementa, sem repetir:

- `docs/COORDENACAO-AGENTES.md`: quem mexe em quê; blocos 1 a 21 descrevem cada entrega e o que o Codex precisa respeitar.
- `docs/EVENTOS-PORTAL.md`: documento do Codex sobre eventos, Ulisses, Ágora e compartilhamento.

Regra de ouro: **antes de cada commit, `git pull --rebase --autostash`**. Os dois agentes publicam no mesmo `master`.

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

- Realm `oinabnb`, base `https://auth.acropolebrasil.com.br/as/`, client público `portal-aluno`, **PKCE sem segredo** (orientação do Heitor).
- Endereços de retorno cadastrados pelo Heitor: `https://portal-na-one.vercel.app/auth/acropole/callback` e `http://localhost:3000/auth/acropole/callback` (por isso testar local na **porta 3000**).
- O Portal acha o cadastro pelo **e-mail confirmado** (`email_verified === true`), abre a sessão Supabase por magic link gerado no servidor e, se o cadastro ativo ainda não tinha login, cria um. **Nunca recriar login existente** (trocaria a senha).

---

## 4. Pendências, em ordem de prioridade

1. **Testar o login unificado de ponta a ponta.** Até 23/10 só a ida ao Keycloak foi confirmada (tela "Entrar em Organização Internacional Nova Acrópole"). Passo: entrar em `portal-na-one.vercel.app/login` numa janela anônima com uma conta real. Se falhar, olhar os logs da Vercel (`Login Nova Acrópole:`); se o Keycloak não mandar e-mail, o log lista os nomes dos campos recebidos. Depois de confirmado, remover o formulário de senha (`comSenha` em `login-client.tsx` e `?modo=senha` em `app/login/page.tsx`).
2. **Sincronização diária do Mercúrio está desligada.** A rotina antiga do Railway apagava participantes de grupos do Portal (código velho, deploys pausados porque a conta de teste do Railway está inativa); o horário dela foi zerado em 21/10. O banco de consulta do Mercúrio está parado desde 17/10 (cobrar o João Guilherme). Próximo passo: levar `scripts/sync-mercurio-db.ts` para uma rotina da Vercel (o importador atual só remove vínculos de `TIPOS_DO_MERCURIO`). **Não religar antes de o banco de consulta voltar a ser atualizado**, senão traz dados velhos de pagamento por cima.
3. **Ágora.** Mapeado em 22/10: front Angular em `eventos.acropolebrasil.com.br` (rotas com `#/`), API Spring em `/api` com sessão por cookie + CSRF; dados exigem login. Endpoints úteis: `GET /api/eventos/slug/{slug}`, `/api/eventos/periodo`, `/api/eventos/acoes`, `/api/evento-pagamentos/primeiro-lote-vigente`, `/api/eventos/inscricoes/minha`. A inscrição tem formulário próprio por evento, lotes e pagamento próprio: **não refazer no Portal**. Plano: Portal lista os eventos do Ágora e o botão leva a `#/e/<slug>` já logado pelo login unificado. Falta do Marcos uma chave de leitura (ou client de serviço no Keycloak) para listar eventos por unidade.
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

### Recomendação

Não tornar o Diário obsoleto nem pedir digitação dupla. Ordem de preferência:

1. **Ler as presenças direto do Diário de Classe pela API dele** (mesmo padrão do Ágora: provavelmente Spring + Keycloak). Pedir ao responsável pelo Diário uma chave de leitura, ou um client de serviço no Keycloak. Com a ponte e o login unificado já prontos, é o caminho mais firme e funciona no celular do professor.
2. **Pergunta ao professor pelo Portal, por push, depois da aula**: "Hoje teve Ética tema 3 na turma X. Entregou apostilas?" (Sim / Não). Um toque. Combinado com a lista de presentes do item 1, dá baixa sozinho. Sem o item 1, o professor confirma quantas entregou.
3. **Extensão do Chrome** só como último recurso: precisa ser instalada em cada computador, não funciona no celular e quebra quando o Diário muda de tela.

### Peças já existentes que servem

- `TurmaMateria` (matéria em curso por turma, vinda do Mercúrio).
- `lib/temas-curriculo.ts` (temas por matéria; a apostila pode ser identificada por matéria + tema).
- Notificações push e a rotina de 5 em 5 minutos (`lib/notificacoes-agendadas.ts`) para a pergunta pós-aula e o aviso de impressão.
- Áreas da filial (`areas-filial.ts`): a tela fica na área **Escolástica**.

### Modelo de dados proposto (ainda não criado)

- `Apostila` (filial, matéria, tema, título).
- `EstoqueApostila` (apostila, quantidade, atualizado em).
- `MovimentoApostila` (entrada por impressão, saída por entrega, ajuste; quem; quando).
- `EntregaApostila` (apostila, membro, aula, data): quem já recebeu.
- `AulaPlanejada` (turma, matéria, tema, data, alunos previstos): vem do planejamento. Falta definir a fonte: Diário de Classe ou cadastro no Portal.
- Configuração por filial: dia e frequência de impressão.

### Perguntas em aberto para o usuário

- Onde está o planejamento das aulas (data + tema por turma)? No Diário de Classe ou em outro lugar?
- Quem é o responsável técnico pelo Diário de Classe (para pedir a chave de leitura)?
- Aluno que faltou recebe a apostila depois (entrega avulsa)?
