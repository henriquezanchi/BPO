# Coordenação entre agentes (Claude e Codex)

Dois agentes publicam neste repositório. Antes de começar um bloco, confira aqui se alguém já está nele, registre o seu e faça pull antes de cada commit.

## Em andamento: Claude (desde 19/10/2026)

Pedido do responsável pelo Portal, em 19/10:

1. **Avaliação de instrutores.**
   - Respostas anônimas no banco.
   - Vínculo interno professor ↔ turma ↔ disciplina ↔ aluno: o aluno só avalia os próprios professores e as próprias disciplinas.
   - Relatórios por resposta, por turma, por escola e por professor.
   - Fica invisível até a direção ou a Secretaria de Escolástica liberar no módulo dela. Liberado, vira um quadrinho no Portal.
2. **Painéis sem função real ficam ocultos** (GAF, Voluntariado etc.), mais uma **tela de administrador da filial** para liberar recursos aos membros: Voluntariado, GAF, propaganda da Acrópole Play, transparência financeira etc. Os administradores são escolhidos pelo chefe ou pelo sub-chefe da filial.
3. **Alteração de cadastro só por solicitação.** Nenhum dado de cadastro muda o Mercúrio sozinho. Os pedidos vão para revisão.
4. **Verificação por código ao trocar celular ou e-mail.**

5. **Relatório da Filial** no Painel do Diretor (`relatorio-tab.tsx`, resumo diário em `ResumoFilial`). Concluído em 19/10; no mesmo dia passou a fazer parte da aba Visão Geral (uma visão só, a pedido do usuário).
6. **Regra da contribuição** (verde/amarelo/vermelho com desconto até o dia 10) em `src/lib/situacao-contribuicao.ts`. Concluído em 19/10. Reutilize essa regra em vez de recriar.
7. **Tesouraria no módulo de Economia**: importar extrato, conferir o que já foi lançado no Mercúrio e lançar só o que falta. Adaptado do repositório `mercurio-tesouraria` (versão publicada de 11/10). Publicado em 19/10 em `/economia/tesouraria` (`src/pages/api/tesouraria`, código em `src/tesouraria/`, armazenamento no Postgres em vez de Redis). Ainda falta: corrigir a conferência de duplicidade (contar ocorrências, usar o FITID do OFX) e conferir pelo banco de consulta quando houver a tabela de movimento de caixas.
8. **Calendário inteligente** (aba Calendário do Diretor + aviso de conflito em `eventos-tab.tsx`). Publicado em 19/10.
9. **Compartilhar eventos públicos** (só `source="ulisses"`): WhatsApp, Instagram Story/Feed com arte gerada, Facebook, Telegram, e-mail, copiar link. Componente `components/member/compartilhar-evento.tsx`, regras em `lib/compartilhar-evento.ts`, arte em `lib/arte-evento.ts`. Em `agenda-panel.tsx` (área do Codex) entrou só uma linha, logo após o link de inscrição do organizador. Publicado em 19/10.

10. **Profissões e áreas de atuação** (Relatório da Filial + painel nacional para a direção nacional). Em andamento desde 19/10.
11. **Secretarias da filial e reuniões de secretaria** (cadastro de secretarias e responsáveis na Administração, com sugestão do Mercúrio). Em andamento desde 19/10.
12. **GAF, GDVE e secretarias** (publicado em 19/10). Grupos do Portal como `ClassGroup` de tipo `GAF`, `GDVE` e `SEC`; regras em `lib/grupos-portal.ts` (constantes para o navegador em `lib/grupos-comum.ts`), leituras em `lib/grupos-dados.ts`, ações em `lib/actions/grupos-actions.ts`. Atividades com responsáveis (`GrupoAtividade`) também para BF/BM/CS. Presença pós-encontro em `GrupoPresenca`. Página do grupo `/grupos/[id]`; Administração com abas Secretarias e GAF; Portal do Voluntário redesenhado (computador: duas colunas; celular: empilhado).
    - **Mudanças em código do Codex:** `group-meeting-actions.ts` — `leader()` e a resposta usam `papelNoGrupo` (a administração gere GAF e secretarias; GAF não exige acesso de voluntário); a série ganhou `intervaloSemanas` (1, 2 ou 4) em `group-meetings.ts`/`meeting-series.ts`; `meeting-manager.tsx` ganhou frequência e o resumo de presença. A Agenda (`member-data.ts`) usa `gruposDaAgenda`.
    - **Sincronização do Mercúrio:** `importar.ts` só remove vínculos de turmas e de BF/BM/CS (`TIPOS_DO_MERCURIO`); grupos do Portal não são tocados.

13. **Validação de saque via webhook do Asaas** (`/api/webhooks/asaas-saque`, token `ASAAS_SAQUE_TOKEN`). Publicado em 19/10. Aprova `PIX_REFUND` só quando bate com uma inscrição cujo reembolso o Portal enviou (`refundSubmittedAt` nos últimos 60 min, mesmo valor restante) e registra `reembolso_autorizado` no `EventAudit`; aprova `PAYMENT_SPLIT`; recusa os demais tipos, salvo os de `ASAAS_SAQUE_OUTROS_APROVADOS`. Configurado na conta principal, vale também para as subcontas. **Codex:** ao mudar a emissão para a subconta da filial, manter `refundSubmittedAt` marcado antes do POST de estorno, que é o que a validação usa.

14. **Área do Voluntário e áreas da filial** (publicado em 19/10). Um lugar só para voluntários e administração (`components/trabalho/shell-trabalho.tsx`, menu em `nav-trabalho.tsx`, destinos em `lib/area-trabalho.ts`). O Painel da Direção foi distribuído em áreas (`lib/areas-filial.ts`): Visão da filial (`/voluntario/filial`), Escolástica (`/escolastica`, com Membros sem dados financeiros), Economia (`/economia`: situação da contribuição, recuperação de crédito, contas e conciliações, composição e tesouraria), Eventos (`/voluntario/eventos`: gestão e calendário) e Café (`/voluntario/cafe`: Caixa Fortuna). `/diretor` redireciona para `/voluntario/filial`.
    - **Permissão por área:** `requireArea(schoolId, ...areas)` em `lib/auth.ts` substituiu `requireDirector` em todas as ações (inclusive `event-actions.ts` → área `eventos`). `requireEscolasticaOuDirecao` e `requireEconomiaOuDirecao` agora passam por `requireArea`. Entram: direção (chefe, sub-chefe, chefias, nacional), o cargo do Mercúrio (Escolástica/Economia) ou o responsável pela secretaria de mesmo nome no Portal. **Codex:** em ação nova de evento, use `requireArea(schoolId, "eventos")`.
    - **Sub-chefe:** tem todas as áreas por padrão; o chefe retira em Administração → Recursos (`AcessoRetiradoSubchefe`, inclusive `admin`).
    - `revalidatePath("/diretor")` virou `revalidatePath("/", "layout")`.

15. **Eventos internos: público com vários grupos e abertura a outras filiais** (19/10, pedido do usuário como prioridade). `Event.publicos` (lista: todos_ativos, membros, fv, provacionistas, hd, dirigentes; `audience` guarda o primeiro), `Event.abertoA` + `abertoValores` (filial, todas, filiais, regionais, estados) e `School.uf`. Regras em `lib/event-policy.ts` (`publicosDaPessoa`, `eventAudienceWhere`, `eventScopeWhere`, `REGIONAIS`); `Member.nivel/isHD/isDirigente/isFV` vêm do Mercúrio pelo importador. **Codex:** `enrollEvent` deixou de exigir a mesma escola (usa `eventScopeWhere`); o pagamento continua indo para a carteira da filial dona do evento. O teste de público em `tests/events.test.mjs` foi atualizado; as outras falhas desse arquivo já existiam antes.

16. **PWA e notificações push** (21/10, pedido do usuário: "como ainda não temos o app, prepare a versão PWA"). Service worker em `public/sw.js` (push, clique abre a tela ou a chamada, página `offline.html` sem cache de dados), registrado em todas as páginas por `components/pwa/registrar-service-worker.tsx`. Inscrições por aparelho em `PushSubscription` (com RLS). Envio só pelo servidor em `lib/push.ts` (`enviarPush`, `avisarSemEsperar`; chaves `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, sem `NEXT_PUBLIC_`). Ativação no Portal do Aluno (`components/pwa/ativar-notificacoes.tsx`: cartão na tela inicial e controle no painel de Ajuda). Envios na hora: atividade nova do instrutor (`createActivity`), decisão das solicitações de cadastro e de contribuição, pagamento da contribuição confirmado (`confirmarPagamento`) e inscrição paga em evento (`confirmEventPayment`). Envios agendados em `lib/notificacoes-agendadas.ts`, rodados por `/api/cron/notificacoes` a cada 5 min: lembrete 30 min antes e "Você participou?" até 3 h depois dos encontros de GAF/GDVE/secretarias (marcas `GroupMeeting.lembreteEnviadoEm`/`presencaPerguntadaEm`), pedido novo para Escolástica/Economia, evento interno novo (público + abertura, `eventoAlcancaFilial` em `event-policy.ts`) e vencimento da contribuição (dias 7 e 10, só filiais com `mercurioEscrita`); repetição evitada pela tabela `PushEnviado`. Ícones: símbolo oficial recortado de `na-logo.png` (`app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`, `public/pwa-*.png`). **Codex:** para notificar algo novo, use `avisarSemEsperar(memberIds, { titulo, corpo, url, etiqueta })`; uma falha no push nunca deve desfazer a ação.

17. **Agenda, lanche compartilhado e prova com temas** (21/10). Agenda do aluno (`agenda-panel.tsx`): abaixo do dia selecionado, lista "Próximos eventos" de outras datas (6 por vez, "Carregar mais eventos"). `Event.lancheCompartilhado` (caixa no cadastro do evento, destaque no cartão; **Codex:** passa por `validateInternalEvent` e `InternalEventInput`). `Activity.materiaSigla/materiaNome/temas`: prova/trabalho/leitura escolhem a matéria em curso na turma (`TurmaMateria`) e os temas do catálogo `lib/temas-curriculo.ts` (N1: NET, NSC, NFH; PSI 1 a 13; demais matérias quando o usuário mandar as listas), base também para o currículo dos instrutores. Biblioteca (Área de Estudos) aponta para bastiao.oinabn.com.br e só aparece para membros (2º nível em diante; `bibliotecaLiberada`).

18. **Eventos: avisos aos inscritos, desistência e lista de espera** (22/10). Os `EventNotice` (`eventNoticePlan`) passam a ser entregues por push em `avisosDeEventosInscritos` (`lib/notificacoes-agendadas.ts`, rotina de 5 min): status `processando` → `enviado`, `sem_canal` (pessoa sem notificações ativas) ou `expirado` (fora da janela de validade de cada tipo). A confirmação de inscrição paga continua saindo em `confirmEventPayment`; o aviso `inscricao` pago só é marcado como enviado. Desistência e lista de espera em `lib/actions/event-self-actions.ts` e `lib/event-waitlist.ts` (tabela `EventWaitlist`, com RLS): gratuita cancela na hora; PIX não pago cancela a cobrança no Asaas (`asaasDeleteEventPayment`) antes de apagar a inscrição; paga: dentro do prazo do evento (`Event.prazoDesistenciaDias`, padrão 3; opções 7, 3, 1 ou sem devolução, escolhidas no cadastro) marca `EventRegistration.desistenciaEm` e entra na mesma fila de reembolso (`event-refunds.ts`, condição `ELEGIVEL`: evento cancelado com devolução OU desistência); fora do prazo vai à Economia. **Codex:** inscrições com `desistenciaEm` não ocupam vaga (contagens com `desistenciaEm: null` em `enrollEvent`, `salvarEvento`, recepção, painel e agenda) e quem desistiu não se reinscreve sozinho. **Codex:** `enrollEvent` agora soma as reservas da lista de espera (`reservasAtivasWhere`, 12 h) ao conferir o limite de vagas; a inscrição cancelada pelo aluno é apagada (`EventAudit` `inscricao_cancelada_pelo_aluno`).

19. **Ponte na Cloudflare para *.acropolebrasil.com.br** (22/10). O Cloudflare da Nova Acrópole desafia (403, cf-mitigated: challenge) toda chamada vinda da Vercel para Ulisses, Ágora e o login unificado; de dentro da Cloudflare passa. Worker em `infra/ponte-cloudflare` (conta de testes; migrar para a conta da escola), só aceita esses domínios e exige o cabeçalho `x-ponte-chave`. A ponte roda fixa em `placement.region = "aws:us-east-1"`: rodando em São Paulo (GRU, onde cai quem chama da Vercel) também é desafiada; fixa nos EUA passa (importação do Ulisses ok nas 7 filiais em 22/10). No Portal, use `fetchAcropole` (`lib/ponte.ts`) para qualquer chamada a esses sistemas; com `PONTE_URL`/`PONTE_CHAVE` passa pela ponte, sem eles vai direto.

20. **Login unificado da Nova Acrópole** (22/10). Keycloak realm `oinabnb`, client público `portal-aluno` com PKCE (sem segredo), retorno em `/auth/acropole/callback` (produção e localhost:3000 cadastrados pelo Heitor). Rotas `/auth/acropole/login` e `/auth/acropole/callback`, lógica em `lib/login-acropole.ts`; a troca do código passa pela ponte. Acha o cadastro pelo e-mail e abre a sessão Supabase por magic link gerado no servidor (`generateLink` + `verifyOtp`); quem não tinha login ganha um (senha aleatória), logins existentes nunca são recriados.

21. **Compartilhamento, cartaz e ajustes de 22-23/10** (Claude). Detalhes, pendências e passo a passo para retomar em `docs/HANDOFF-CLAUDE.md`.
    - **Compartilhar:** abertura em tom intermediário (`ABERTURAS` em `lib/compartilhar-evento.ts`), sem emoji fora do plano básico (`semEmoji`; o WhatsApp do Windows troca por "?"); Facebook copia a mensagem para colar (não aceita texto pronto); Instagram só no celular (no computador explica e oferece a arte); post oficial do Instagram por evento (`Event.linkPostagemOficial`, campo na lista de eventos da administração).
    - **Cartaz como postagem:** com imagem do evento, a postagem é o próprio cartaz (`cartazComoPostagem` em `lib/arte-evento.ts`) com faixa verde só com o que falta. A imagem do S3 do Ulisses passa por `/api/imagem-evento` (sem CORS no bucket).
    - **Leitura do cartaz por IA:** `lib/leitura-cartaz.ts` (Claude Haiku 5.5, saída estruturada), chamada no fim de `/api/cron/ulisses`; resultado em `Event.cartazLeitura` + `cartazLidoUrl` (relê só se a imagem mudar). Inscrição só conta com link, site ou QR code.
    - **Ulisses:** `ehCopia()` em `lib/ulisses/publico.ts` ignora "[CÓPIA] …", "Cópia de …", "(cópia)", "… - Cópia" (os já importados são arquivados).
    - **Login:** só "Entrar com a conta Nova Acrópole" na tela; e-mail e senha só em `/login?modo=senha` até o teste ponta a ponta; exige e-mail confirmado no Keycloak.
    - **Outros:** Biblioteca → `bastiao.oinabn.com.br`, só para membros; "Portal do Membro"/"Portal do Aluno" pelo nível; "Meus eventos" dentro da Agenda e redesenhado; ícone do WhatsApp em cada evento; "Inscreva-se" em todos os botões; carteira Fortuna sem "(sua unidade)"; ícones do PWA e favicon a partir do símbolo oficial.
    - **Codex:** o compartilhamento foi mexido pelos dois agentes em 22/10 (convite interno, arte do WhatsApp, `versao-compartilhamento.json`). Antes de alterar `compartilhar-evento.ts`, `compartilhar-evento.tsx` ou `arte-evento.ts`, ler o histórico recente desses arquivos.

Situação dos blocos 1 a 3 em 19/10: concluídos (avaliação, administração da filial e cadastro por solicitação). O bloco 4 (verificação por código) aguarda a escolha do provedor de envio.

Não mexer nesses blocos sem combinar. Os demais pendentes de `CONTINUIDADE-VOLUNTARIADO-DIARIOS.md` (escalas, ED/Pré-ED, diário, informe mensal) seguem livres.

## Compartilhamento de eventos internos

Compartilhamento de eventos internos (Codex, 22/10/2026): convite do WhatsApp com descrição completa, preço/gratuidade e orientações, título sem asteriscos duplicados e link `/portal?evento=<id>`. A página do Portal abre a Agenda no evento disponível ao membro; proxy e redirecionamento de sessão preservam o parâmetro após o login. Arquivos: `compartilhar-evento.ts`, `agenda-panel.tsx`, `member-portal-client.tsx`, `app/(member)/portal/page.tsx`, `proxy.ts`. Sem migração.

Complemento: prévia e compartilhamento de PNG no WhatsApp (`CompartilharWhatsApp` em `components/member/compartilhar-evento.tsx`). Sem cartaz, o canvas existente (`lib/arte-evento.ts`) gera o modelo com marca, título, data, local e valor quando couber; eventos internos não são rotulados como abertos ao público. Sem API paga ou gravação no servidor. Limpeza do convite também elimina `�`, emojis BMP e substitutos isolados. O convite completo acompanha o arquivo como texto, sem ser desenhado na imagem do WhatsApp; a prévia exibe o convite e permite copiar, inclusive como alternativa quando o aparelho descarta a legenda. Teste de navegador: `tests/browser/whatsapp-art.mjs`.

## Regra de segurança: toda tabela nova com RLS

Em 19/10/2026, 44 das 55 tabelas do schema `public` estavam sem RLS. A chave pública do Supabase, que vai no navegador, lia `Member`, `PaymentCharge`, `ContactChangeLog` etc. pela API REST. A falha foi corrigida pela migração `20261019130000_rls_todas_tabelas`.

**Toda migração que cria tabela precisa terminar com `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;`.** O Portal acessa o banco só pelo servidor (Prisma), que não depende disso. Para conferir:

```sql
SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
```

A consulta deve voltar vazia.


## 22. Codex — Aberturas, rede de secretarias e substituição do Lead Forte (23/10/2026)

Implementados `/voluntario/aberturas` e `/voluntario/secretarias`, com planejamento, docentes/escalas, orçamento/resultados, ponte privada CRM, snapshots versionados e aprendizado agregado. Consulte `docs/CONTINUIDADE-ABERTURAS-CRM-2026-10-23.md` e `docs/ABERTURAS-TURMAS.md` antes de alterar. Migração `20261023020000_aberturas_secretarias` já aplicada e registrada, tabelas com RLS. Lead Forte/Jornada/Retorno por contagem foram descontinuados por instrução expressa do usuário; não restaurar. Motor factual UMD compartilhado com CRM, versão 1.0.2; cópias devem ser idênticas. Segredos ficam no Vault, nunca no cliente. Não há novos disparos de WhatsApp. A base acadêmica segue identificada como 17/10; sincronização recente não altera essa data.


## 23. Secretarias independentes (23/10/2026)

O usuário rejeitou o menu central Rede de Secretarias. Cada secretaria contém Orientações e gestão, materiais, mandatos nacional/regional/local e escalas. Nacional de Economia não recebe acesso a Abertura nem aos dados financeiros operacionais por esse mandato. Loader e formulários são fixados na secretaria atual; namespace e território são conferidos no servidor. Sem migração nova ou perda de dados. O endereço central antigo apenas redireciona. Não restaurar painel que reúna secretarias.


## 24. Claude — Ágora pelo token do próprio aluno (23/10/2026)

Direção do Heitor: o Portal não cria papéis nem copia dados do Ágora; chama a API do Ágora com o token do login unificado do aluno. Diário de Classe fica para depois. Teste real em 23/10: token do `portal-aluno` (`aud: account`) recebe 403 no Ágora (client `eventos`); depende do Marcos incluir `eventos` no `aud` (mapper Audience) ou habilitar token exchange (exige `portal-aluno` confidencial). Decisão do usuário: `portal-aluno` confidencial + token exchange; `lib/login-acropole.ts` já manda `client_secret` quando `KEYCLOAK_CLIENT_SECRET` existe (sem a variável, segue público). Script de reteste: `node --env-file=.env scripts/testar-token-agora.mjs`. Detalhes e próximos passos em `docs/HANDOFF-CLAUDE.md`, pendência 3. Sem migração. Atualização 23/10 14h30: `portal-aluno` já confidencial e `KEYCLOAK_CLIENT_SECRET` na Vercel (produção republicada). Token exchange indisponível na versão atual do Keycloak (501 "Feature not enabled"); Heitor vai priorizar a migração. Alternativa: mapper Audience `eventos` no token do login.


## 25. Claude — Telas de TV da filial (24/10/2026)

Pedido do usuário: link para exibir os eventos numa TV da filial, cartaz à esquerda e dados com QR de inscrição à direita, trocando a cada 5 s, com TVs diferentes por público. Decisões do usuário: fundo escuro verde Heket, próximos 30 dias, eventos de outras filiais abertos à filial entram (mesma regra da Agenda: `eventScopeWhere` + `agendaUlissesBranchWhere`).

- Página pública `/tv/<token>` (sem login, `noindex`); o token (24 caracteres aleatórios) é o segredo. "Trocar link" gera outro token e derruba o antigo.
- Públicos por tela: `aberto_publico` (eventos `source = ulisses`) e as chaves de `EVENT_AUDIENCES` (casam com `Event.publicos`; Ágora e calendário nacional ficam de fora, como na Agenda).
- QR: Ulisses → `registrationUrl`; interno → `/portal?evento=<id>` (exige login). SVG gerado no servidor com `qrcode` (nova dependência, + `@types/qrcode`).
- Cartaz: `posterPath` (link assinado de 1 h) ou `imageUrl` do Ulisses; sem cartaz, logo da marca em dourado. Por isso a tela faz `router.refresh()` a cada 5 min.
- Gestão: Eventos → aba "Telas (TV)", ações em `lib/actions/telas-actions.ts` (`requireArea(schoolId, "eventos")`).
- Migração aditiva `20261024120000_telas_eventos` aplicada e registrada; tabela com RLS. Testes: 79/50/29 (igual à linha de base). Conferido em 1920×1080, 1366×768 e 1080×1920 com eventos reais de Goiânia.

Ajustes do mesmo dia (pedidos do usuário ao ver a TV do Universitário):
- Troca a cada **10 s** (era 5 s).
- Sobreposição corrigida: a linha do slide fica presa à altura da TV (`grid-template-rows: minmax(0, 1fr)`); antes, dados longos esticavam a linha, a arte descia e o QR invadia o rodapé. O bloco do meio usa `useCaber` (`tela-tv.tsx`): se não couber, `data-aperto` 1 = descrição em 2 linhas, 2 = sem descrição, 3 = título em 2 linhas. Espaçamentos reduzidos (QR 19vh); TV vertical 35/65.
- **Resumo por IA** da descrição (`lib/resumo-tela.ts`, Claude Haiku 5.5, esforço baixo): chamada curta, uma vez por descrição, guardada em `Event.resumoTela`; `resumoTelaDe` = impressão (sha1) da descrição resumida — se a descrição mudar, resume de novo. Gerado no cron diário do Ulisses (`/api/cron/ulisses`, eventos dos próximos 45 dias, até 20 por rodada) e pela própria TV via `after()` (até 8 por carga; aparece na atualização seguinte, 5 min). Só descrições com mais de 160 caracteres; sem resumo, a TV mostra as primeiras frases completas (`primeiraFrase`), nunca cortadas com "…".
- Migração aditiva `20261024180000_resumo_tela` aplicada e registrada (autorizada pelo usuário). 11 resumos já gerados.
- Tela "TV de pátio" criada para Goiânia Universitário (só "Aberto ao público").

Segunda rodada do mesmo dia (pedidos do usuário: conexão pelo controle remoto, orientação e "tudo" de conteúdos):
- **Conexão da TV sem teclado** (`lib/telas-conexao.ts`, `app/api/tv/conexao`, `app/tv/page.tsx`, `components/tv/parear-tv.tsx`): a TV abre `/tv`, recebe código de 6 números + QR (`/tv/conectar?c=…`, válido 15 min); voluntário logado com a área `eventos` escolhe a tela (QR → `app/tv/conectar`, ou campo "Conectar uma TV" no cartão da tela). A TV guarda só o segredo, consulta a cada 3 s e vai para `/tv/<token>`; o token fica no `localStorage` (`portal-tv:token`) e `/tv` volta direto para ele ao religar. `/tv?nova=1` força código novo. Link trocado/tela excluída → `TelaVencida` limpa a memória e volta para `/tv`. Rota pública limitada a 300 códigos pendentes.
- **Orientação** por tela (`TelaEventos.orientacao`: auto | direita | esquerda): fora de "auto", `/tv/<token>` põe a própria tela num iframe girado 90° (`?quadro=1`), que se vê em pé e usa o layout vertical.
- **Conteúdos** por tela (`TelaEventos.conteudos`, chaves em `CONTEUDOS_TELA`): um a cada dois eventos. Matrículas (Aberturas `planejada`/`em_curso` com inscrição aberta; QR = aula inaugural do Ulisses no mesmo dia, senão WhatsApp da secretaria — hoje nenhuma filial tem abertura cadastrada), frase da semana (`lib/telas-frases.ts`, só autores clássicos com obra), cartões da filial (`TelaCartao`: matricula | aviso | apoio | instagram | play, com link opcional e "mostrar até"), programação da semana (≥ 2 eventos em 7 dias) e aniversariantes (membros `mercurioAtivo`, nome + último sobrenome, páginas de 14; **bloqueado** em tela com `aberto_publico`, na validação e na montagem).
- **Margem de segurança** (overscan das TVs): nada importante a menos de ~5% da borda; rodapé numa linha (filial com reticências; data só no rodapé de largura total). Conferido por medição automática em 1920×1080, 1366×768, 1919×909, 1080×1920 e 768×1366.
- Migração aditiva `20261024210000_telas_conteudos_conexao` aplicada e registrada (autorizada pelo usuário): `conteudos`, `orientacao`, tabelas `TelaCartao` e `TvConexao` com RLS. "TV de pátio" ligada a matrículas, frase, avisos, apoio, redes e programação.
- Gestão logada (aba Telas, `/tv/conectar`) verificada só por tipos/lint: não há conta de teste. A ligação TV↔tela foi testada de ponta a ponta simulando a ação no banco.

## 26. Claude — Mercúrio por views, liberação de acessos e abas da Escolástica (25/10/2026)

- **Importação do Mercúrio com as views novas** (`mercurio-db/importar.ts`, `client.ts`, `resumo-filial.ts`, `resumo-profissoes.ts`): a view `cadastro` está sem `cad_dirigente`, `cad_pedagogo` e `cad_empresa`. Sem elas, a importação mantém dirigente/pedagogo do Portal (só acrescenta instrutor de turma ativa), o resumo conta dirigentes pelo Portal e profissões ignoram a empresa. `colunasDoCadastro()` detecta quando voltarem.
- **Regressão corrigida:** `fichas` ainda é cópia de 17/10. Agora o mês com recibo online válido de item da composição conta como pago (recibos `reciboc`/`reciboi` são views ao vivo), e mês pago pelo Portal sem recibo do Mercúrio não é rebaixado. Todas as filiais reimportadas.
- **Liberar acessos** (`voluntario/acessos/page.tsx`): responsável por grupo sem acesso próprio via o link no menu e voltava ao Início; agora a página explica que o Chefe de Filial libera primeiro.
- **Escolástica:** "Orientações e gestão" entrou em `ABAS_ESCOLASTICA` (aparece também na Avaliação dos instrutores) e ganhou título e abas; continua com o controle de acesso próprio de `AreaSecretaria` (nacional/regional entram sem a área da filial).
- **Dono do sistema** (`lib/dono-do-sistema.ts`, pedido do usuário: acesso a todas as funcionalidades): matrícula 21596. `ehAdministradorNacional` devolve verdadeiro para ele (todas as filiais e áreas via `escolasChefiadas`/`areasNaFilial`, liberar acessos, `/nacional`, secretarias da rede) e `getAuthenticatedMember` o devolve com `isDiretor: true` (telas que conferem direção da própria filial). Não grava nada no banco; para incluir outro dono, acrescentar a matrícula ao conjunto. Novas checagens de permissão devem passar por `ehAdministradorNacional`/`areasNaFilial` para o dono continuar entrando.
- **Sub-Chefe libera acessos** (pedido do usuário): `ehChefeDeFilial` em `acesso-voluntario.ts` inclui `isSubChefe`; `escolasQueLibera` = filiais chefiadas + a própria, se Sub-Chefe (só para liberar; `escolasChefiadas` não mudou, para não ampliar Administração, Aberturas etc.). Menu e página de Liberar acessos seguem a mesma regra.

## 27. Claude — Etapa 1 da lista de demandas do usuário (25/10/2026)

- **Situação da Contribuição** (`contribution-status-panel.tsx`): resumo mais curto; seletor de ano só com mais de um ano (a importação traz só o ano corrente); "Regularize primeiro" só quando há mês anterior ao atual em aberto.
- **Incluir novo item:** o membro só inclui CONTRIBUIÇÃO BIBLIOTECA, DOAÇÃO CRIANÇA PARA O BEM MENSAL, CONTRIBUIÇÃO VOLUNTARIADO e DOAÇÃO MENSAL DE MEMBRO/PROVACIONISTA (`rubricaIncluivelPeloMembro` em `rubrica-visibilidade.ts`), na lista (`member-data.ts`) e no servidor (`solicitarItemComposicao` confere o catálogo da filial e usa o rótulo dele).
- **TVs:** saiu o conteúdo/cartão "Círculo de Amigos / doação" (`apoio`); a TV de pátio foi atualizada no banco.
- **Evento cancelado** (`lib/evento-cancelado.ts`): na Agenda, só enquanto o reembolso do inscrito não é confirmado e no máximo 5 dias depois do cancelamento (data do `EventAudit` "cancelado"); em Meus eventos vai para a seção "Cancelados", no fim.
- **Minha jornada sem 2026:** não é erro; o Mercúrio não tem participações em cursos de 2026 em Barra do Garças nem no Universitário (Boa Viagem e Lago Sul lançam).
- Código das frases por filial ficou para o bloco 28.

## 28. Claude — Frase da semana por filial (25/10/2026)

- **Lista padrão** (`lib/telas-frases.ts`): 174 frases de 48 autores em grupos por autor, intercalados por `rodizio` (autor muda a cada semana). Entraram Lúcia Helena Galvão, Luis Carlos Marques (assina Luis Carlos Marques Fonseca), Michel Echenique, autores do programa de estudos (Buda, Bhagavad Gita, Lao-Tsé, Confúcio, Ptahhotep, Platão, Pitágoras, Marco Aurélio, Sêneca, Epicteto, Plotino…) e outros citados nos sites oficiais (coluna "Citas célebres" da Revista Esfinge). Cada frase tem `fonte` (página oficial da Nova Acrópole) e foi conferida no texto original; tradução nossa quando a página está em outro idioma. Frases apócrifas ficaram fora mesmo quando aparecem em site da NA. Lista aprovada pelo usuário.
- **Por filial:** tabela `FraseTela` (RLS) e aba Telas → Frases (`components/director/frases-tela.tsx`, ações em `telas-actions.ts`, área `eventos`): incluir, editar, ativar/desativar, apagar e importar a lista padrão. A TV usa as frases ativas da filial; sem nenhuma, a padrão. `obra` é opcional no rodapé da TV.
- Migração aditiva `20261025120000_frases_tela` aplicada e registrada (autorizada pelo usuário em 25/10).
- **Liberar acessos com filtros** (pedido do usuário): filtro por filial (quando há mais de uma), por secretaria (grupos SEC, secretário de Economia/Escolástica e mandatos ativos; opção "Sem secretaria") e lista em ordem alfabética (`localeCompare` pt-BR, também dentro de "Sugeridos"). Com filtro ativo, a divisão Sugeridos/Demais some e aparece "N de M na lista". `candidatosParaLiberar` devolve `schoolId`, `cidade` e `secretarias`.

## 29. Codex — organização da interface, calendário e planejamento (25/10/2026)

Blocos colapsáveis por padrão via `ui/collapsible-section.tsx`, com exceções existentes preservadas; atividades ordenadas e datas passadas identificadas. Calendário exibe três títulos e reticências, detalhes completos por dia e atalho de administração por evento. Planejador transferido para o formulário de Eventos (`event-date-suggestions.tsx`), usando o público existente e sem migração. Orpheu adicionado na área do Instrutor com o endereço confirmado pelo usuário. Decisões em `docs/ORGANIZACAO-DA-INTERFACE.md`. Base integrada: b741af8. Sem alteração no Mercúrio ou nas permissões.

Revisão do Claude (25/10/2026), na integração com a master: merge sem conflito de código (só este arquivo). Ajustes: "Evento compartilhado" na Agenda abre por padrão (quem chega por link compartilhado precisa ver o evento); a seção "Cancelados" de Meus eventos (bloco 27) também ficou recolhível; texto dos cartões da TV sem "Círculo de Amigos" (removido no bloco 27). Conferido: o aviso de conflitos passou a usar o fuso do dispositivo, igual ao salvamento do formulário. Tipos, lint e testes (79/50/29, igual à base) passaram.

## 30. Claude — Frases a cada volta da TV (25/10/2026)

- Pedido do usuário: sair a "frase da semana" e variar a frase. `SlideFrase` agora leva todas as frases ativas da filial (ou a lista padrão) e um `inicio` sorteado no servidor; `tela-tv.tsx` mostra `frases[(inicio + volta) % n]`, com `volta` contada a partir do slide anterior ao da frase (o texto não troca enquanto pré-carrega ou sai). O contador `atual` passou a só crescer (`indice = atual % total`). O `inicio` fica guardado no estado da TV, então a atualização dos dados (5 min) não troca a frase no meio. A ordem da lista padrão (`rodizio`) já alterna autores. Saíram `fraseDaSemana`, o rótulo "Frase da semana" da TV e o destaque "Na TV esta semana" da gestão; o conteúdo da tela chama-se "Frases".
