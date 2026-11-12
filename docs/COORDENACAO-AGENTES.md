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

## 31. Claude — Agenda e compartilhamento de eventos (25/10/2026)

- **Agenda** (`agenda-panel.tsx`): o calendário abre sempre em hoje (antes abria no primeiro dia com evento). Cartão de evento fechado por padrão: mostra tipo, título, data, local (e "Cancelado"); cartaz, descrição, inscrição e demais detalhes abrem ao tocar (`<details>`). O "Evento compartilhado" (link `?evento=`) abre aberto. Descrições com `whitespace-pre-line` (as quebras de linha do Ulisses e dos eventos internos já vinham no banco, só não eram exibidas).
- **Compartilhar** (`lib/compartilhar-evento.ts`): saiu a frase em primeira pessoa ("Quero dividir um evento…", `aberturaDoEvento`) e a do evento interno ("Vamos participar juntos?"). WhatsApp, Facebook, Telegram e e-mail levam a descrição inteira (`textoCompleto`, sem "…"); Instagram continua com `resumo` de 1200 por causa do limite da legenda. Testes de compartilhamento atualizados.

## 32. Claude — Grupos, etapa 1: correções (25/10/2026)

Plano aprovado pelo usuário: (1) corrigir erros, (2) tela única de grupos, (3) tipos "grupo de estudo" e "leitura comentada" (criados por qualquer instrutor, Chefe, Sub-Chefe, administradores da filial e secretaria de Escolástica). Correções:
- **Avisos e enquetes de GAF** chegam aos participantes sem acesso de voluntário (`member-data.ts`: mesma regra de `gruposDaAgenda`, sem grupos encerrados; GDVE só FV).
- **Quem gere o grupo publica** (`requireTeacherOfClass` em `auth.ts`): para GAF, secretarias, GDVE e FV vale `papelNoGrupo().podeGerir` — a administração da filial publica no GAF sem ser integrante; o responsável de GAF não precisa de acesso de voluntário. Turmas seguem exigindo vínculo de professor. A tela de avisos (`/professor/turma/[id]`) só aparece para quem tem vínculo; o acesso da administração pela tela entra na etapa 2.
- **Calendário da filial** sem grupos encerrados e sem encontros de GDVE.
- **Nome repetido:** criar/editar grupo avisa "Já existe uma turma/um grupo com o nome…" (antes, erro genérico do banco). A importação do Mercúrio (`importar.ts`) e `scripts/sync-teacher-classes.ts` renomeiam o grupo do Portal homônimo de uma turma ("Nome (GAF)") em vez de misturar alunos nele.
- **Uma lista de secretarias:** a oferta de voluntariado do Portal do Aluno usa `SECRETARIAS_OFERTA` (nomes do catálogo `SECRETARIAS_PADRAO`: "Café", "Difusão e Comunicação", "Técnica e Manutenção") e o servidor só aceita esses nomes.
- Fica para a etapa 3 (precisa de coluna nova): o pedido para participar de GAF ligado a um grupo específico.

## 33. Claude — Tempo de tela pelo texto (25/10/2026)

- Pedido do usuário: tempo flexível por slide. `lib/tempo-tela.ts`: palavras visíveis (com letra ou número) ÷ 200 por minuto (leitura silenciosa de adulto, 200–250 ppm; usamos o limite mais lento porque quem lê a TV está de passagem) + 3 s quando o evento tem cartaz; mínimo 5 s, máximo 45 s. `tela-tv.tsx` troca por `setTimeout` com o tempo do slide atual (frase conta com a frase da volta) e a barra de progresso usa o mesmo tempo. Na TV de pátio: eventos com cartaz 19–21 s, frase 8 s. Teste em `tests/tempo-tela.test.mjs`.

## 34. Claude — Notificações: eventos de todas as fontes, resumo da semana e convite em janela (25/10/2026)

- **Eventos** (`notificacoes-agendadas.ts`): `avisosDeEventosNovos` agora cobre eventos do Portal e do Ulisses, pelo mesmo filtro da Agenda (`eventosQueAPessoaVe`: escopo/abertura, públicos e filial do Ulisses). Novos eventos de uma rodada vão numa notificação só por pessoa ("3 eventos novos na Agenda", até 3 linhas), só entre 8h e 21h de Brasília (os do Ulisses, importados às 6h, esperam; janela de 36 h desde a criação). `resumoDaSemana`: segunda-feira, 8h–12h, um resumo dos eventos dos próximos 7 dias (chave `semana:<memberId>:<data>`). Rota `/api/cron/notificacoes` devolve também `semana`.
- **Convite** (`components/pwa/ativar-notificacoes.tsx`, variante "cartao"): virou janela "Aceita receber notificações sobre eventos, contribuições e muito mais?" com Sim / Pergunte-me depois (volta em 7 dias) / Não (só ele encerra o convite neste aparelho; `localStorage` `na-notificacoes-resposta`). Abre 3 s depois de entrar no Portal (não durante o tour do 1º acesso) e, por `pedirNotificacoes(motivo)`, depois de inscrição em evento, pedido de GAF e confirmação de presença em encontro (ignora o adiamento, respeita o "Não"). No iPhone sem o Portal instalado, a janela explica a instalação. A chave antiga `na-notificacoes-dispensado` deixou de valer (quem dispensou volta a ser convidado, a pedido do usuário).
- Situação em 25/10: 14 pessoas já entraram no Portal (10 em Barra do Garças); 3 com notificação ativa.

## 35. Claude — Gestão de eventos no padrão de "Meus eventos" e Avaliação dos instrutores alinhada (25/10/2026)

- **Gestão de eventos** (`eventos-tab.tsx`, pedido do usuário: "parecida com Meus eventos"): cada evento é um `<details>` fechado cujo resumo segue `CartaoEvento` (data em bloco verde/cinza com `partes()` de `meus-eventos.tsx`, categoria dourada — "Evento interno · públicos" ou "Do Ulisses · aberto ao público" —, título, hora e local, etiquetas: inscrições abertas/vagas esgotadas/já aconteceu/cancelado, vagas, presenças, valor, lanche). Seções Próximos / Já aconteceram / Cancelados. O link "Administrar evento" do calendário (`#evento-<id>`) abre e rola até o cartão. "Novo evento interno" virou cartão com "+" (abre ao editar). Ações viraram botões. Conferido em prévia local (1280 px escuro e 390 px claro).
- **Avaliação dos instrutores** (`escolastica/avaliacao/page.tsx`): saiu `largura="estreita"` (as outras abas da Escolástica usam a largura padrão; a barra de abas rolava) e o título "Avaliação dos instrutores", que tinha virado bloco recolhível, deu lugar ao texto de orientação, como nas demais abas.

## 36. Claude — Grupos, etapa 2: um lugar só (25/10/2026)

- **`/grupos`** (novo, item "Grupos" em Meu trabalho, para quem tem acesso de voluntário, é FV, está em grupo ou administra filial): abas "Meus grupos" (com o cartão "Criar grupo", que mostra só os tipos que a pessoa cria), "Secretarias da filial" e "GAF da filial" (administração; os mesmos `SecretariasAdmin`/`GafAdmin`, com sugestões do Mercúrio e pedidos de GAF; seletor de filial para quem administra várias) e "GDVE" (FV com acesso; `CriarGdve`).
- **Administração** (`/admin`): ficou só "Recursos e administradores"; `?aba=secretarias|gaf` redireciona para `/grupos` na mesma filial. O Início do voluntário troca o "Criar GDVE" por um link para Grupos.
- **Página do grupo** (`/grupos/[id]`, `grupo-painel.tsx`): abas em qualquer tela, guardadas na URL (`?aba=`): Encontros, Avisos e enquetes (só para quem coordena; `components/grupos/avisos-do-grupo.tsx`, o conteúdo que estava em `/professor/turma/[id]`), Atividades, Pessoas/Equipe, Sobre e Orientações (secretarias, `AreaSecretaria`). `/professor/turma/[id]` de grupo redireciona para `/grupos/[id]?aba=avisos`; a lista do Instrutor aponta direto para lá. Turmas continuam em Professor.
- Não verificado em tela logada (sem conta de teste); tipos, lint e testes (mesmas 29 falhas da base).
- Próximo (etapa 3, precisa de migração autorizada): tipos "grupo de estudo" e "leitura comentada", pedido de GAF ligado a um grupo ("Quero participar") e, se aprovado, a aba Conversa.

## 37. Claude — Grupos, etapa 3: grupo de estudo e leitura comentada (25/10/2026)

- **Tipos novos sem migração** (`ClassGroup.tipo` é texto): `ESTUDO` ("Grupo de estudo") e `LEITURA` ("Leitura comentada") em `TIPOS_GRUPO`. Conjuntos em `grupos-comum.ts`: `TIPOS_DO_PORTAL` (GAF, SEC, GDVE, ESTUDO, LEITURA), `TIPOS_DE_ALUNOS`/`ehDeAlunos` (GAF, ESTUDO, LEITURA: não dependem de acesso de voluntário — agenda, avisos, notificações de encontros). Onde havia `"GAF"` fixo para essas regras (papel, elegibilidade "só membros", agenda, encontros, formulário, painel), passou a valer o conjunto.
- **Quem cria** (pedido do usuário): `podeCriarEstudo` em `grupos-portal.ts` — administração da filial (Chefe, Sub-Chefe, administradores) ou nacional, pedagogo ou professor de turma da filial, ou quem tem a área Escolástica. **Quem coordena**: administração, Escolástica da filial ou responsável. `Pessoa` em `grupos-portal.ts` ganhou `isSecretarioEscolastica`/`isSecretarioEconomia` (usados por `areasNaFilial`).
- **Telas:** aba "Estudo e leitura" em `/grupos` (`EstudosAdmin` em `grupos-admin.tsx`; também no cartão "Criar grupo"); seção no Início do voluntário. No Portal do Aluno, quadrinho "Grupos de estudo" (só se houver grupo que aceita a pessoa) com `GruposEstudoPanel`: os seus e os abertos, com **"Quero participar"** (`entrarNoGrupoDeEstudo`: entra na hora, conferindo `candidatoElegivel`; pede notificações em seguida). Campo "Programa de estudos" vira "Obra e trechos" na leitura comentada.
- Conferido com dados reais: dono e pedagogo de BGA criam; aluno comum não; aluno não entra em grupo "só membros" e entra em grupo aberto a alunos.
- Ainda com migração pendente de autorização: pedido de GAF ligado a um GAF específico (`GafRequest.classGroupId`) e a aba Conversa (chat).

## 38. Claude — Grupos e Secretarias separados (25/10/2026)

- Pedido do usuário: "divida grupos e secretarias". **`/secretarias`** (novo; item "Secretarias da filial" no menu, seção Secretarias, para quem administra filial ou está numa secretaria): a administração vê e cria todas as secretarias da filial (`SecretariasAdmin`, com sugestões do Mercúrio; seletor de filial); as demais pessoas veem as suas. Cada secretaria continua abrindo em `/grupos/[id]` (menu marca "Secretarias da filial").
- **`/grupos`** ficou com GAF, estudo e leitura, grupos de FV e GDVE; `?aba=secretarias` redireciona para `/secretarias`. Administração → Secretarias leva a `/secretarias`. `/voluntario/secretarias` (antigo) redireciona para `/secretarias`. `/secretarias/[nome]` (secretarias em rede, mandatos) não mudou.

## 39. Claude — Pedido de GAF com o grupo escolhido; Liberar acessos na Administração (25/10/2026)

- **Migração aditiva `20261025200000_gaf_pedido_grupo`** (autorizada pelo usuário): `GafRequest.classGroupId` (opcional, FK `ClassGroup`, `ON DELETE SET NULL`, índice). Pedidos antigos ficam sem GAF.
- **Portal do Aluno** (`GafPanel` em `misc-panels.tsx`): lista os GAFs da filial que aceitam a pessoa e de que ela não participa (`gafsDisponiveis` em `member-data.ts`); o aluno escolhe um e envia o pedido (`solicitarAdesaoGaf(memberId, classGroupId)` confere GAF ativo da filial, elegibilidade, vínculo e pedido repetido). Sem GAF disponível, o pedido geral de antes.
- **Coordenação do GAF**: na página do grupo, aba Pessoas, "Pedidos para participar" com Aceitar (inclui a pessoa, conferindo elegibilidade) e Recusar (`responderPedidoGaf`, só quem gere o grupo). Em Grupos → GAF da filial, a lista de pedidos mostra o GAF escolhido.
- **Administração** (`components/admin/abas-admin.tsx`): abas "Recursos e administradores" e "Liberar acessos" (esta só para Chefe, Sub-Chefe e administração nacional). `/voluntario/acessos` aparece como aba da Administração para quem administra e libera; o item "Liberar acessos" do menu fica só para quem libera sem administrar (responsável de grupo de FV). As abas Secretarias/GAF saíram (têm menu próprio; links antigos redirecionam).

## 40. Claude — Visão geral: da filial ao nacional, por área (25/10/2026)

- Pedidos do usuário: painel nacional e da filial com os mesmos índices; "já temos a visão da filial, apenas expanda para níveis maiores"; "distribua os índices por área, não foque tanto em economia"; eliminar o Painel Nacional agregando os índices dos dois.
- **`lib/panorama.ts`**: `alcancesDaPessoa` (própria filial e chefiadas; administração nacional/dono também cada filial, regionais de `REGIONAIS` com 2+ filiais e "Todas as filiais") e `carregarPanorama(escolas, todas)`: soma dos `ResumoFilial` do Mercúrio (pessoas, níveis, entradas/saídas 12 meses, motivos de saída, contribuição do mês, receita, turmas) + Portal (contas, quem já entrou — `auth.users.last_sign_in_at` —, notificações, pedidos, pendências, falhas), eventos (próximos 30 dias, inscritos, presença dos últimos 30), aberturas (ativas; base de interessados e matrículas do cache do CRM — base histórica, não só da campanha), voluntariado (acessos liberados, secretarias, GAF, estudos/leituras, FV, GDVE), profissões (resumo nacional inteiro em "Todas", recortado pelas unidades nos demais) e, para uma filial só, aniversariantes, turmas e a rodada de avaliação dos instrutores. Linha por filial para a tabela.
- **`components/panorama/panorama.tsx`** e **`/voluntario/filial`** ("Visão geral" no menu, para direção, chefia e administração nacional): seletor de alcance (`?alcance=<schoolId>|regional-<id>|todas`), cartões por área (Pessoas e Escolástica, Eventos, Abertura de turmas, Voluntariado e grupos, Portal e comunicação, Economia), tabela "Por filial" (linhas levam ao alcance da filial), aniversariantes e profissões recolhidos. "Abrir" leva à área só quando o alcance é a própria filial. O financeiro detalhado do Portal (antiga Visão da filial) fica em Economia → Detalhes, só na própria filial (`VisaoGeralTab comRelatorio={false}`).
- **Painel Nacional**: saiu do menu; `/nacional` redireciona para `/voluntario/filial?alcance=todas`.
- Conferido em prévia local com dados reais (1280 px escuro, 390 px claro). Contribuição do mês vem de `fichas` (cópia do Mercúrio de 17/10) até o João Guilherme liberar a view atualizada.

## 41. Claude — Visão geral com seletor de filiais; sem "CRM" nas telas (25/10/2026)

- **Seletor** (`components/panorama/seletor-filiais.tsx`, pedido do usuário): lista suspensa com as filiais por regional e estado (`gruposPorRegiao`), caixas de marcar em cada nível (regional/estado marcam todas as filiais deles), atalhos Todas / Só a minha / Limpar e "Aplicar". `escolherAlcance` lê `?filiais=id,id` (ou `?alcance=`), reconhece quando a seleção é uma regional ou todas e só aceita filiais que a pessoa pode ver. Conferido em prévia local (abrir, marcar GO, aplicar → "Regional Centro-Oeste").
- Texto do topo: os números são das filiais inteiras no Mercúrio (não só de quem usa o Portal), das filiais abertas no Portal.
- **"CRM" fora das telas** (pedido do usuário: o sistema é dele e da empresa dele): textos visíveis e mensagens de erro de Aberturas e da Visão geral passaram a dizer "base de interessados" / "integração"; "Registro salvo no BPO" virou "no Portal" e o sobretítulo "BPO · Eventos" de Aberturas virou "Planejamento e resultados". Nomes internos de código (crm.ts, LeadCRM…) ficam. "CRM com traje completo" (FV) é outro termo e ficou.

## 42. Claude — Resumos de toda a OINAB-N, pagamentos ao vivo, data visível; telas mais cuidadas (25/10/2026)

- **Pagamentos no resumo** (`mercurio-db/resumo-filial.ts`): `fichas` é cópia (17/10); recibos são view ao vivo. O resumo passou a contar como pago o mês com recibo válido de contribuição (mesma regra da importação: produto da composição em `compaluno` ou "CONTRIBUI…"), no mês atual e nos atrasos do ano. BGA: de 3% para 24/31 pagos. Consultas grandes com paginação (`emPaginas`, limite de 5.000 linhas do banco de consulta).
- **Todas as unidades** (pedido do usuário): `gerarResumoFilial(uni, schoolId | null, unidade)` grava unidades fora do Portal em `ResumoNacional` chave `unidade:<id>` (sem migração). `mercurio-db/atualizar-resumos.ts` atualiza os resumos mais antigos (profissões, filiais do Portal e demais unidades da lista de profissões), poucos por rodada; rota **`/api/cron/resumos`** a cada 15 min (vercel.json), 4 por rodada, validade 20 h. Só lê o Mercúrio.
- **Visão geral**: a administração nacional vê também as unidades fora do Portal (id `uni:<unidade>`, marcadas "fora do Portal", sem números do Portal) no seletor, nas regionais e em "Todas". Topo com selo "Atualizado em dd/mm às hh:mm" (resumo mais antigo do alcance; intervalo quando variam) e a data da ficha. Economia ocupa a largura toda; financeiro do Portal em três colunas.
- **Administração**: seções em cartões (`components/ui/cartao-secao.tsx`: ícone, título, descrição, recolhível) — Recursos do Portal do Aluno, Administradores da filial, Acessos do sub-chefe, Esqueceu a senha.
- **Abertura de turmas**: saiu o sobretítulo; título "Aberturas de Turmas".

## 43. Claude — Abertura de turmas: orçamento por item, custo por matrícula, palestra de abertura e dia da semana automático (25/10/2026)

- **Categorias de custo** (`lib/aberturas/categorias.ts`): tráfego pago e divulgação, impressos, coffee break, aluguel de equipamentos, espaço e estrutura, materiais, outros — usadas no orçamento e nas despesas (`validacao.ts`, `form-registro.tsx`; nomes legíveis na lista de despesas).
- **Orçamento opcional** (`campo-orcamento.tsx`): em branco, valor único ou "Detalhar por item" com soma. `salvarAbertura` valida `orcamentoItens` (JSON categoria → reais), grava o total em `orcamentoCentavos` e um registro `tipo:"orcamento"` (`{itens, totalCentavos}`) no histórico da abertura (sem migração); a edição lê o último.
- **Custo por matrícula** (`graficos.tsx`): por abertura, "Custo previsto por matrícula" (orçamento ÷ meta) e "Custo real por nova matrícula (CAC)" (despesa realizada ÷ matrículas novas confirmadas no Mercúrio, cálculo que já existia em `relatorios.ts`). Em Investimentos, tabela "orçado × gasto" por item (gasto acima do orçado em vermelho).
- **Formulário**: dica de "Inscrições até" encurtada; "Dia da semana" saiu (calculado da primeira aula e mostrado na dica do horário); campo "Palestra cultural de abertura" (padrão: 7 dias antes, só em abertura nova) que cria um registro `palestra` no Ciclo cultural no horário da turma (90 min); se já houver palestra, aparece só para leitura.
- **Aberturas à vista** (pedido do usuário: o rascunho criado "sumia"): faixa "Suas aberturas" no topo do Resumo (`SuasAberturas` em `painel-aberturas.tsx`), um cartão por abertura no padrão de "Meus eventos" (data, situação, horário e sala, **inscritos/vagas** = interessados vinculados à abertura ÷ capacidade, matrículas confirmadas) com atalhos Planejamento, Lançar despesa e Interessados. Depois de criar ou salvar, a tela vai para o Planejamento da abertura. Em Investimentos, "Registrar investimento" virou **"Lançar despesa"** e abre expandido.

## 44. Claude — Quem usa e quem não usa o Portal (25/10/2026)

- Pedido do usuário: índice de ativos, de quem usa e de quem não usa o Portal, com lista de cada, filtrável por filial, estado e regional. **`/voluntario/filial/uso`** (link "Ver quem usa e quem não usa" no cartão Portal e comunicação da Visão geral, mantendo a seleção; mesmo `SeletorFiliais` e mesmas permissões da Visão geral).
- `lib/uso-portal.ts`: ativos do Mercúrio das unidades escolhidas (`cadastro` ATI, paginado com `emPaginas`, exportado de `resumo-filial.ts`) cruzados pela matrícula com quem já entrou no Portal (`auth.users.last_sign_in_at`) e quem tem notificação. `components/panorama/lista-uso.tsx`: três números, listas "Não usam" / "Usam" (último acesso, sino = notificações), busca por nome ou matrícula, 100 por vez.
- Em 25/10: OINAB-N inteira (68 unidades) 7.994 ativos, 13 usam; BGA 32 ativos, 9 usam, 3 com notificações. Todas as unidades levam ~9 s (consulta ao Mercúrio).

## 45. Claude — Situação dos interessados com um toque (25/10/2026)

- Pedido do usuário: "não consigo interagir nos interessados". `components/aberturas/situacao-interessado.tsx` no cartão de cada interessado (aba Interessados, com abertura escolhida): botões Quer conhecer / Quer participar / Vai se inscrever / Prefere depois / Sem interesse (sinal `interesse_declarado`, declarado) e Foi à palestra (`presenca_palestra`, observado), Pediu matrícula, Não quer contato (declarados). Cada toque grava um sinal datado com origem "Portal" por `registrarAbertura` (mesmas validações do formulário completo) e recarrega; o cartão marca a última situação e os fatos já registrados.
- Resumos do Mercúrio: primeira geração completa concluída (68 unidades); daqui em diante, `/api/cron/resumos`.
- **Fonte de cada número na Visão geral** (pedido do usuário: "tudo que for dado do Portal tem que ficar explícito"): etiqueta MERCÚRIO (cadastro oficial da escola inteira), PORTAL (só o que foi cadastrado ou liberado no Portal) ou INTERESSADOS em cada número, legenda no topo e nas colunas da tabela por filial; rótulos dos números do Portal dizem "no Portal". Dirigentes não aparecem como dado do Mercúrio enquanto a view não trouxer `cad_dirigente`.

## 46. Claude — Gavetas só para encerrados/cancelados e ajustes de navegação (25/10/2026)

- Pedido do usuário: "gavetas apenas para as encerradas ou canceladas; as ativas aparecem sem gavetas". `CollapsibleSection` passou a abrir por padrão (`defaultOpen = true`); fechadas só onde é encerrado/cancelado: Cancelados de Meus eventos, rodadas encerradas da Avaliação dos instrutores (`campanhas-panel.tsx` separa abertas/encerradas), "Já aconteceram" e "Cancelados" na Gestão de eventos. Início do voluntário e Instrutor sem gavetas. Meus eventos: Recepção, Próximos e Anteriores sem gaveta.
- **Agenda**: ordem Próximos eventos (sempre aberto, sem gaveta) → Meus eventos → calendário; tocar num próximo evento seleciona o dia e rola até o calendário.
- **Situação da Contribuição**: sem "Nenhum atraso." repetido e sem "Sem juros"; "Atualizado em…" pequeno, à direita do título.
- **Orientações e gestão** em Economia, Eventos e Café agora mantêm título e abas (antes o menu da secretaria sumia); abas em constantes (`ABAS_ECONOMIA`, `ABAS_EVENTOS`).
- **Aberturas**: indicadores Aberturas/Capacidade levam ao Planejamento e Orçamento planejado a Investimentos.
- Fortuna: o cartão da carteira sempre aparece no Portal do Aluno e a consulta do dono devolve saldos localmente; aguardando o print do usuário para saber onde não aparece.

## 47. Claude — Sugestão da melhor data e meta de 80% (25/10/2026)

- **"Sugerir a melhor data"** no formulário de abertura nova (`components/aberturas/sugestao-data.tsx`, ação `sugerirDataAbertura`): usa `compararPlanejamento` (mesmo motor de Equipe e horários) com uma abertura provisória (sala, capacidade e professores já preenchidos), segunda a sábado, 19h30/19h/15h/9h, de 3 a 10 semanas à frente; nota = situação (viável/pendente/impedido), professores livres, ocupação, impedimentos e pessoas que já vêm à escola naquele dia (alunos das turmas no resumo do Mercúrio). Mostra as 3 melhores combinações com motivos; "Usar" preenche data e horário (e a palestra de abertura volta a 7 dias antes). Avisa quando não há disponibilidade de professores cadastrada. Em BGA, ~0,6 s por horário.
- **Meta de matrículas** = 80% da capacidade até ser editada; horário de início passou a ser controlado (para a sugestão preencher).
- MATRICULA_CPF_CHAVE criada na Vercel (produção) e no `.env` local, para a Fase 1 do site de matrículas.

## 48. Claude — Site de matrículas, Fase 1 (25/10/2026)

Decisões do usuário: cobra a 1ª contribuição mensal; cobrança na **subconta Asaas da filial** (nome da filial na cobrança); gravação no Mercúrio direta na Fase 2 (João Guilherme libera depois dos testes em BGA e no Universitário); CPF cifrado até o lançamento.
- **Migração aditiva `20261025230000_matricula_online`** (autorizada): `AberturaTurma.matriculaToken` (único; aberturas existentes ganharam um), `matriculaAberta` (padrão true), `valorContribuicaoCentavos`; tabela `MatriculaOnline` (RLS) com os dados do cadastro do Mercúrio, `cpfInicio`, `cpfCifrado`, status `aguardando_pagamento | aguardando_escola | paga | lancada | cancelada`, cobrança Asaas.
- **`MATRICULA_CPF_CHAVE`** (32 bytes, base64) na Vercel (produção) e no `.env`; `lib/cpf-cifrado.ts` (AES-256-GCM, validação de CPF).
- **Página pública `/matricula/<token>`** (`app/matricula/[token]`, `components/matricula/form-matricula.tsx`): turma, vagas, valor; dados do cadastro (nome, e-mail, celular, nascimento, sexo, naturalidade, nacionalidade, estado civil, escolaridade, profissão, CPF, RG/órgão/emissão, endereço com ViaCEP, como conheceu) e consentimento. Fechada se a abertura estiver cancelada/concluída, com matrículas desligadas ou lotada (pagas ≥ capacidade).
- **Cobrança** (`lib/asaas/subconta.ts`, separado do cliente dos eventos): só se a filial tiver `School.asaasSubaccountApiKey` e a abertura tiver valor; cobrança `UNDEFINED` (Pix na tela com QR e copia-e-cola; cartão/boleto na página do Asaas). Confirmação por consulta: a página confere a cada 5 s e `/api/cron/notificacoes` confere as pendentes dos últimos 5 dias (`conferirMatriculasPendentes`) — não depende de webhook por subconta. Paga → `paga` + pendência da Escolástica ("lançar no Mercúrio e na turma"). Sem cobrança online → `aguardando_escola` + pendência para combinar.
- **Aberturas**: token na criação; formulário com "Valor da 1ª contribuição" e "Matrículas pelo site" (abertas/fechadas); cartão com "Copiar link de matrícula" e "N pelo site, M pagas".
- **Pendente** (atualizado em 01/11/2026): só Barra do Garças tem a chave da subconta guardada, e a subconta ainda está em análise no Asaas (ata de eleição enviada pela API em 01/11; CNH e selfie da diretora só pelo app do Asaas). Nas demais filiais o site recebe a matrícula, mas não cobra. Envio do formulário e pagamento não testados de ponta a ponta; fazer um teste de R$ 1 quando a subconta for aprovada.

## 49. Claude — Link de matrícula mais visível e sem sala na página pública (25/10/2026)

- Pedido do usuário: "onde eu acho o link de matrícula?" e "não precisa indicar a sala". `LinkMatricula` virou faixa verde com ícone, "Link de matrícula aberto/fechado", **Abrir** e **Copiar link**; aparece no cartão de cada abertura (Suas aberturas) e no detalhe da abertura selecionada (Planejamento), acima da associação da turma do Mercúrio. Página `/matricula/<token>` não mostra mais a sala (e `aberturaPorToken` não a consulta).

## 50. Claude — Atendimentos individuais com o instrutor (25/10/2026)

Pedido do usuário: agenda do instrutor para os alunos marcarem conversas individuais; o instrutor abre e fecha horários; a conversa vai para o calendário dos dois; números por instrutor para a Direção (quem não liberou horários, mais livres, mais cheios). Decisões: só alunos das turmas do instrutor marcam; faixa semanal (ou numa data) fatiada em conversas de 20/30/45/60 min.
- **Migração aditiva `20261026000000_atendimentos`** (autorizada, aplicada e resolvida): `AtendimentoJanela` (instrutorId, diaSemana ou data, inicio/fimMinuto, duracaoMinutos, modalidade presencial|online|ambos, local, linkOnline, datasFechadas[], ativa) e `AtendimentoReserva` (instrutorId, alunoId?, inicio/fim, status marcada|realizada|faltou|cancelada|bloqueio, canceladoPor, motivo, lembreteEnviadoEm). RLS nas duas. **Índice único parcial** `(instrutorId, inicio) WHERE status IN ('marcada','bloqueio')` só no SQL: impede marcação dupla simultânea (P2002 → "alguém acabou de marcar").
- `lib/atendimentos.ts`: `gerarHorarios` (fatia faixas das próximas 4 semanas, antecedência mínima de 24 h (pedido do usuário), no **fuso da filial pela UF** — `fusoDaEscola`: MT=Cuiabá, MS, AM, RR, RO, AC; resto Brasília; usa `parseLocal` de group-meetings), `instrutoresParaAtendimento` (professores das turmas do aluno no Portal + `TurmaMateria.instrutorMemberId`), `ehInstrutor` (isPedagogo ou professor de turma), `numerosDosInstrutores`.
- `lib/actions/atendimento-actions.ts`: salvarJanela (sem sobreposição), excluirJanela (desativa; conversas marcadas continuam), alternarDia, alternarHorario (bloqueio), registrarResultado (realizada/faltou, só depois do horário), marcarAtendimento (1 conversa futura por instrutor; push ao instrutor), cancelarAtendimento (aluno ou instrutor; push ao outro).
- Telas: `/professor/atendimentos` (link "Atendimentos individuais" em /professor): números, "Como foi?", próximas conversas, faixas, próximas 4 semanas com toque para fechar/reabrir horário e "Fechar o dia". `/atendimentos` (aluno): instrutores das turmas e horários livres, assunto opcional, presencial/online quando o instrutor deixa escolher. Agenda do Portal: novo item `atendimento` (aluno e instrutor) e atalho "Conversar com meu instrutor" para quem tem instrutor (`podeMarcarAtendimento`).
- Gestão: aba **Atendimentos dos instrutores** na Escolástica (`/escolastica/atendimentos`, mesma permissão da Avaliação; nacional vê todas as filiais com seletor por UF) e item no menu "Gestão da filial" para chefes/sub-chefes. Cartões (com horários x sem, abertos, marcadas, realizadas 30 d) e tabela por instrutor com filtros Sem horários / Mais livres / Mais cheios.
- Lembrete push 2 h antes para os dois (`avisosDeAtendimentos` em `/api/cron/notificacoes`).
- Conferido: geração de horários e instrutores de um aluno real de BGA (terça 18h Cuiabá = 22h UTC); números BGA (6 instrutores, nenhum com horários) e nacional (77 instrutores) em < 0,4 s; telas em prévia local (desktop claro, celular escuro). Testes: mesmas falhas da linha de base (comando: `npx tsx --experimental-test-module-mocks --test tests/*.test.ts tests/*.test.mjs`). Fluxo completo de marcar/cancelar não exercitado em produção.

## 51. Claude — PRIORIDADE: toda cobrança pela subconta da filial (25/10/2026)

Regra do usuário: "temos que cobrar SEMPRE pela subconta de cada filial, para aparecer o nome da Nova Acrópole, e não o meu". A conta principal do Asaas é a empresa do usuário; até aqui eventos, contribuição, Pix automático e Fortuna eram emitidos nela com split para a filial.
- **`lib/asaas/client.ts`**: toda função recebe `conta?: ContaAsaas` (último parâmetro). Sem `conta` = conta principal, só para taxas da principal, criar subcontas e cobranças antigas. 404 de `/payments/{id}` ou `/pix/automatic/authorizations/{id}` com conta da filial cai na principal (legado). Criação nunca cai.
- **`lib/asaas/conta-escola.ts`**: `contaDaEscola(Id)` (emitir; sem chave lança `ContaEscolaPendente` com `MENSAGEM_CONTA_PENDENTE`), `contaDeLeitura(Id)`, `escolaCobraOnline`, `walletPrincipal` (GET /wallets da principal, em cache; ou `ASAAS_WALLET_ID_PRINCIPAL`).
- **`lib/asaas/split.ts`** invertido: `splitDoBpo(valor, conta)` manda a margem do BPO (2%) para a principal, limitada a "valor − taxa da subconta" (lança `ValorNaoCobreCustos` se valor ≤ taxa); `splitDoBpoCartao(valorBase)`. `calcularSplitEscola*` removidos.
- Fluxos trocados: inscrição de evento, consulta/desistência/reembolso de evento, webhook (agora também confere matrícula do site), contribuição Pix/cartão/consulta/cancelamento, Pix automático (ativar/consultar/desligar e o worker `scripts/process-pix-automatico.ts`, que pula filial sem subconta), recarga Fortuna, site de matrículas (`asaas/subconta.ts` com split do BPO e notificações do Asaas desligadas).
- Antes da troca não havia cobrança pendente nem Pix automático ativo na principal (conferido no banco).
- **Segurança**: `School.asaasSubaccountApiKey` omitida por padrão (`omit` global no `PrismaClient`, `lib/db.ts`); antes iria para o navegador em `member.school`.
- Telas: pagamento no Portal fica "em breve" (`emBreve`) quando a filial não tem a subconta ligada (`cobraOnline` no dashboard); eventos pagos mostram `MENSAGEM_CONTA_PENDENTE`; aba Eventos da Direção avisa que falta ligar a conta da filial.
- **`scripts/ligar-subconta-asaas.ts <UNIDADE>`**: pede a chave sem eco, confere que é da carteira da filial (`School.asaasWalletId`), grava e cadastra na subconta o webhook do Portal (mesma URL/eventos/token da principal).
- **Efeito imediato**: nenhuma filial tem a chave ainda, então **Barra do Garças fica sem cobrança on-line** (eventos pagos, contribuição, Fortuna) até ligar a subconta. Link de acesso da subconta de BGA já reenviado.
- Teste `tests/event-webhook.test.mjs`: mock do db ganhou `matriculaOnline`. Mesmas 30 falhas da linha de base.

## 52. Claude — Fortuna fora do ar em produção; cores dos próximos eventos (25/10/2026)

- **Fortuna**: em produção o saldo não carregava. Registro da Vercel: `Fortuna proxy (getClient) -> HTTP 404 "Application not found"`, ou seja, o proxy no Railway (`FORTUNA_PROXY_URL`) saiu do ar (conta do Railway inativa). Correção: `lib/fortuna/client.ts` passa a usar a ponte da Cloudflare (`fetchAcropole`, `lib/ponte.ts`) quando `PONTE_URL`/`PONTE_CHAVE` existem, ignorando o proxy; `infra/ponte-cloudflare/src/index.ts` ganhou `oinabnfortunaback.acropolebrasil.com.br` em ALLOWED e no /diagnostico. Ponte publicada com autorização do usuário (versão bdd25b21): `/diagnostico` mostra o Fortuna 200 sem desafio, e login + saldo pela ponte conferidos (2 saldos, 8 filiais). `FORTUNA_PROXY_URL` deixou de ser usado (pode sair da Vercel).
- **Próximos eventos** (Agenda): cor por categoria no bloco da data, no rótulo e no cartão — dourado (evento da escola), turquesa (nacional/regional), laranja (outra filial), verde (grupos, conversa individual), verde-escuro (turma), cinza (cancelado). `COR_PROXIMO`/`categoriaProximo` em `agenda-panel.tsx`.
- "Nada agendado para …" usava `formatDateBR` (UTC) e mostrava o dia seguinte depois das 21h; agora usa a data local.

- Orçamento da abertura (detalhado por item): nome do item acima do valor, em duas colunas (antes o campo esmagava o nome).

- Disponibilidade dos professores (Aberturas → Equipe e horários): o campo "Impedimentos (JSON)" virou "Datas em que não pode" (`components/aberturas/campo-impedimentos.tsx`): lista de datas com "Dia inteiro" ou faixa de horário; envia o mesmo JSON `[{data, inicioMinuto, fimMinuto}]` (dia inteiro = 0–1440), sem mudança no servidor.
- Calendário da filial: reunião de grupo mostra o nome do grupo como título (ex.: "GAF Online") e o nome da reunião no detalhe; conflito diz "Reunião de <grupo>".
- Encontrar uma data (novo evento): campo "Turno mais adequado" (qualquer, manhã 9h/10h, tarde 14h/15h/16h, noite 19h/19h30/20h) define os horários testados; o formato continua definindo os dias.

## 53. Claude — Públicos agregadores (25/10/2026)

Pedido do usuário: "a seleção do público deve ser agregadora, e não exclusiva". `ALCANCE_PUBLICO` e `publicosQueAlcancam` em `lib/event-policy.ts`: aberto ao público (Ulisses) alcança todos; todos os ativos → membros e abaixo; membros → FV, provacionistas, HD, dirigentes; FV → HD e dirigentes. `publicosDaPessoa` devolve os públicos que alcançam a pessoa (HD/dirigente agora veem eventos de FV; teste em `events.test.mjs` atualizado). TV (`telas-eventos.ts`): públicos internos filtram por `publicosQueAlcancam`, e eventos do Ulisses entram em qualquer TV (só "Aberto ao público" continua sem eventos internos). Calendário da filial: FV alcança HD e dirigentes nos conflitos. Conferido na TV Recepção de BGA: só membros ou só FV → Sábado de Integração + Dia Mundial da Filosofia (Ulisses); só aberto ao público → só o do Ulisses.

## 54. Claude — Turma de pedagogos: escala de apresentações e planos de aula (26/10/2026)

Pedido do usuário: as turmas de pedagogos têm encontros semanais de duração variável; cada pedagogo apresenta sua aula (15 min) ao instrutor dos pedagogos; escala com quem, quando e qual tema; plano de aula entregue 1 semana antes. Decisões: novo tipo de grupo; escala gerada e ajustável; o tema é a sequência dos temas da disciplina escolhida (continua de onde a última apresentação parou); migração autorizada.
- **Grupo `PED`** ("Turma de pedagogos", `grupos-comum.ts`, em `TIPOS_DO_PORTAL`). Cria: administração, Direção e Escolástica da filial (`podeCriarTurmaPedagogos`), aba "Turmas de pedagogos" em `/grupos`. Responsável = instrutor dos pedagogos; integrantes = instrutores (isPedagogo ou professor de turma); sem integrantes escolhidos, entram todos os instrutores ativos da filial. Não exige acesso de voluntário (`dispensaAcessoVoluntario`, usado em `gruposDaAgenda` e nos avisos de encontros).
- **Migração `20261026120000_escala_pedagogos`** (aplicada e resolvida): `ApresentacaoPedagogo` (grupo, pedagogo, data "YYYY-MM-DD", ordem, materiaSigla, tema, topicos, status agendada|apresentada|faltou|cancelada) e `PlanoAula` (1:1; síntese, prática filosófica, ponte para a vida, consequências, arquivo, status rascunho|entregue|devolvido|aprovado, comentário do instrutor). RLS nas duas. Arquivos no bucket privado `planos-aula` (criado no primeiro envio), enviados direto do navegador por link assinado (`createSignedUploadUrl` + `uploadToSignedUrl`), até 20 MB; abertos por link assinado de 10 min.
- `lib/escala-pedagogos.ts`: `previaDaEscala` (rodízio: todos uma vez, quem apresentou há mais tempo primeiro; N por encontro; datas dos encontros da aba Encontros ou semanais), `proximosTemas`, `prazoDoPlano` (data − 7), `situacaoDoPlano`. Ações em `lib/actions/escala-actions.ts`.
- Aba **"Escala de apresentações"** (primeira aba do grupo PED; `components/grupos/escala-pedagogos.tsx` + `escala-servidor.tsx`): pedagogo vê "Minhas apresentações" com o plano (arquivo + 4 pontos, rascunho/entregar, correções do instrutor); gestão vê números (próximas, a revisar, atrasados), "Gerar a próxima rodada" com prévia editável, escala por data com ver plano/aprovar/devolver, ajustar, remover; "Já aconteceram" em gaveta, com "Apresentou/Não apresentou". Rascunho de um pedagogo só ele vê.
- Avisos: escala gravada → pedagogos; plano entregue → instrutor; aprovado/devolvido → pedagogo; cron `avisosDePlanosDeAula` (8h–21h): 3 dias antes do prazo e no dia (pedagogo), dia seguinte ao prazo (instrutor e pedagogo).
- `/professor`: cartão "Sua apresentação na turma de pedagogos" com data, tema e situação do plano.
- Disciplinas disponíveis = as do catálogo (`TEMAS_POR_MATERIA`: NET, NSC, NFH, IS1, PSI); novas entram com as listas de temas.
- Arte do WhatsApp (Compartilhar no WhatsApp): formato próprio `whatsapp` 1080×1080 em `lib/arte-evento.ts` (antes usava o feed 4:5, que o chat corta). Com cartaz: cartaz inteiro sobre o fundo desfocado e a faixa verde (data, local, inscrição) embaixo, sem cobrir o cartaz; sem cartaz: arte da marca em versão quadrada. Instagram continua com story e feed.

## 55. Claude — Mercúrio: colunas de volta na view `cadastro` (26/10/2026)

- `cad_dirigente` ("S"/"N"), `cad_empresa`, `cad_recuperado` e o pedagogo voltaram; o pedagogo veio como `cad_cad_pedagogo` e `sincronizarUnidade` copia para `cad_pedagogo` quando só o nome errado existe. `cad_contribuicao` não volta. `cad_recuperado` ainda não é usado pelo Portal.
- Reimportação completa das 8 filiais com unidade + resumos e profissões (agora com `cad_empresa`).
- **Recuperados na Visão geral** (pedido do usuário 26/10): `pessoas.recuperados` (ativos com `cad_recuperado=S`, quem saiu e voltou) e `movimento.meses[].recuperados` (reingressos por mês, sem quem tem `cad_reingresso = cad_ingresso`) em `resumo-filial.ts`, somados em `panorama.ts`; linha "Recuperados ativos" na área Pessoas (com % dos ativos, voltaram em 12 meses e no mês) e no tooltip do gráfico de entradas/saídas. Campos opcionais: resumos antigos continuam válidos até serem regerados. BGA: 5 de 32 ativos; reingressos em jan (3), jul (1) e ago (2).

## 56. Claude — WhatsApp do financeiro e Instagram opcional, via Zernio (26/10/2026)

Decisões do usuário: a Zernio (https://docs.zernio.com) integra WhatsApp e Instagram; **WhatsApp só para o financeiro**, por **um número central para toda a rede**; o custo de cada mensagem (≈ R$ 0,04, utilidade da Meta no Brasil) fica na conta da filial e é **abatido do repasse**; **Instagram é pacote opcional de R$ 49/mês**, cobrado da filial pela empresa do usuário (cobrança mensal com nota, fora das cobranças dos alunos). Divulgação de eventos para membros continua pelo push do Portal e pelo Instagram (marketing no WhatsApp custa ≈ R$ 0,35 por pessoa e ficou de fora).
- **Migração `20261026180000_whatsapp_financeiro_instagram`** (autorizada pelo usuário; **ainda não aplicada**: a aplicação foi barrada pelo controle de permissões e espera confirmação). Tabelas `WhatsappEnvio` (um registro por aviso; `referencia` única = idempotência; status pendente|enviada|entregue|lida|falhou|ignorada; `custoCentavos` contado quando a Meta entrega), `WhatsappDescadastro` (quem respondeu SAIR) e `RedeSocialFilial` (Instagram da filial: contratada|conectada|desconectada|cancelada). RLS nas três.
- `lib/zernio/client.ts` (chave `ZERNIO_API_KEY`, só servidor): perfis por filial (`externalId` = School.id), link de conexão, contas, envio de modelo (`POST /inbox/conversations` com `templateName`), publicação no Instagram.
- `lib/whatsapp/modelos.ts`: os 5 modelos de utilidade (pt_BR) com texto e exemplo — contribuição recebida, lembrete (dia 10), em aberto (atraso), inscrição paga, matrícula paga; rodapé "Responda SAIR" e botões "Abrir o Portal"/"Sair da lista". Mudar texto = cadastrar de novo e esperar aprovação.
- `lib/whatsapp/financeiro.ts`: `enviarWhatsappFinanceiro` (só com `ZERNIO_WHATSAPP_ACCOUNT_ID`; sem ele nada sai nem é gravado), `avisarFinanceiroSemEsperar` (nunca derruba pagamento), `registrarSituacaoEnvio`, `descadastrarTelefone`, `custosDoMes`. `CUSTO_MENSAGEM_CENTAVOS = 4`.
- Disparos: `confirmarPagamento` (contribuição paga no Portal), `confirmEventPayment` (inscrição paga), `conferirPagamento` da matrícula pelo site, e recibo novo do Mercúrio em `sincronizarUnidade` (só recibo criado na rodada, não cancelado, emitido há até 3 dias, e não repete quem já recebeu a confirmação do Portal). Todos só consultam o banco com o WhatsApp ligado.
- **Régua de cobrança** (Direção → Recuperação): rascunhos agora têm o texto exato do modelo (dia 10 → lembrete; demais → em aberto), sem edição; "Aprovar e enviar" e "Aprovar e enviar todos" saem pelo número central (continua sem disparo automático, decisão antiga). Gatilho novo não pede mais texto. Quadro "WhatsApp do financeiro · mês": entregues, valor a abater do repasse, falhas, por modelo.
- Webhook `/api/webhooks/zernio` (HMAC-SHA256 do corpo, `X-Zernio-Signature`, segredo `ZERNIO_WEBHOOK_SECRET`): entrega/leitura/falha, SAIR (descadastra e confirma na janela grátis de 24 h), Instagram conectado/desconectado.
- **Instagram opcional**: cartão "Instagram da filial" na área Difusão e Comunicação (`oferta-instagram.tsx`; aparece só com a Zernio configurada e para direção/Difusão da filial): contratar (confirmação de R$ 49/mês) → conectar pela Zernio → volta em `/api/integracoes/instagram`; cancelar desliga a conta na Zernio. Contratar/cancelar avisa o dono pelo CallMeBot (`avisarDono` em `error-notify.ts`) para emitir/parar a cobrança mensal. **Ainda falta** o botão de publicar o evento no Instagram da filial (arte já existe em `arte-evento.ts`; upload por `POST /media/presign`).
- Scripts: `scripts/whatsapp-modelos.ts [--cadastrar]` (modelos na Meta) e `scripts/zernio-webhook.ts` (cria o webhook e grava o segredo no `.env.local` sem mostrar).
- Testes: `tests/whatsapp-financeiro.test.ts` (regras da Meta para os modelos, telefone, datas). Mesmas 30 falhas da linha de base.
- **Para ligar**: aplicar a migração; conectar o número central na Zernio (conta do usuário; cadastrar cartão, senão só 2 contas); `ZERNIO_WHATSAPP_ACCOUNT_ID` e `ZERNIO_API_KEY` na Vercel; rodar os dois scripts; copiar `ZERNIO_WEBHOOK_SECRET` para a Vercel. O nome exibido do número precisa ter relação com a empresa dona da conta (Meta); "Nova Acrópole" pode exigir comprovar o serviço prestado às filiais.
- **Acerto do repasse**: hoje o Portal só mede o custo por filial (quadro na Recuperação); o desconto efetivo (transferência da subconta ou abatimento no split) entra quando as subcontas tiverem chave.

## 57. Claude — Rotinas da Vercel no lugar do Railway, saúde do Portal, adoção e limpeza (26/10/2026)

Pedido do usuário: "faça tudo" (o que dependia só de código) e "providencie todas" (melhorias). WhatsApp e Instagram ficam parados (ver HANDOFF, atualização 26/10: **não aplicar** a migração do bloco 56).
- **Rotinas** (`lib/rotinas.ts`, `executarRotina`/`autorizadoCron`): todas as rotas de `api/cron` passaram a usar; falha de tarefa avisa o suporte (CallMeBot) e a última execução fica em `ResumoNacional` `rotina:<nome>`. Novas: `financeiro` (10 min), `mercurio` (:20/:50), `fila-mercurio` (10 min), `saude` (hora). `notificacoes` não para mais sem VAPID (lista de espera sempre roda); matrículas foram para `financeiro`.
- **Sincronização diária do Mercúrio** (`mercurio-db/rotina-diaria.ts`): uma filial por vez (a mais antiga, >20 h), lotes de 20 matrículas via `sincronizarUnidade(uni, { matriculas })`, depois `sincronizarUnidade(uni, { apenasFechamento: true })` (quem saiu, matérias, grupos, catálogo; consultas por matrícula puladas sem alvo). Estado em `ResumoNacional` `rotina-estado:mercurio`. Medido do computador: fechamento + 20 membros ≈ 93 s. Primeira rodada feita à mão (BSB inteira e o 1º lote de LGS).
- **Login unificado importa no primeiro acesso** (`mercurio-db/primeiro-acesso.ts`): sem cadastro no Portal com o e-mail, procura o ativo no Mercúrio pelo e-mail e importa (`importarMembro`) se a unidade já tem escola no Portal; outra unidade recebe "O Portal do Membro ainda não chegou à sua escola".
- **Fila de escrita no Mercúrio na Vercel**: `browser-session.ts` usa `@sparticuz/chromium` com `VERCEL` (igual à Tesouraria); `outputFileTracingIncludes` para `/api/cron/fila-mercurio`. **Sem credenciais o adaptador agora falha** (antes o mock devolvia `ok: true`); mock só com `MERCURIO_USAR_MOCK=1`.
- **Pix Automático**: lógica saiu do script para `lib/asaas/pix-automatico-ciclo.ts` (`confirmarContribuicoesPendentes` também confere avulsas pendentes dos últimos 3 dias; `criarCicloPixAutomatico`). O script continua para uso manual.
- **Fortuna**: `fortuna/confirmar-recarga.ts` (`confirmarRecargaFortuna`, à prova de corrida com `updateMany` pendente→pago) usado pela tela, pelo webhook do Asaas (novo) e pela rotina `financeiro` (`conferirRecargasPendentes`). Antes, recarga paga com a tela fechada não era creditada.
- **Saúde**: `lib/saude.ts` (7 verificações: banco, ponte `/diagnostico`, Ulisses, Keycloak, Fortuna, Mercúrio, Asaas — todas OK em 26/10) e página `/admin/saude` (administração nacional; atalho na área de trabalho, seção Nacional).
- **Adoção**: conteúdo de TV "Acesso ao Portal do Membro" (QR para `/login`, só TV com público interno; padrão das telas novas e ligado na Recepção de BGA); "Quem usa e quem não usa" com cache de 6 h dos ativos por unidade (`ResumoNacional` `ativos:<uni>`).
- **Site de matrículas**: campo-isca `site`; reenvio da mesma pessoa reaproveita a cobrança pendente; limites de 30 envios/hora por turma e 3/hora por e-mail; consulta ao Asaas no máximo a cada 15 s por matrícula (`conferirPagamentoDaTela`), tela pergunta a cada 8 s.
- **Recife Boa Viagem**: `ulissesFilialId = 26` (código "rbv" no Ulisses; antes nulo, sem eventos do Ulisses na Agenda e nas TVs).
- **Limpeza**: botão "Acessar Apostilas" escondido até haver conteúdo; removidos `Dockerfile`/`.dockerignore` (Railway), `scripts/fortuna-proxy-server.ts` e o caminho de proxy em `fortuna/client.ts` (`FORTUNA_PROXY_URL`/`FORTUNA_PROXY_SECRET` podem sair da Vercel), pasta vazia `src/app/(director)`; comentário de `billing-constants.ts` atualizado ao modelo da subconta. Dono do sistema configurável por `DONOS_DO_SISTEMA` (padrão 21596).
- **Testes**: as 30 falhas antigas foram corrigidas (agente em worktree, só testes): `tests/helpers/mock-module.mjs` adapta `mock.module({exports})` ao Node 24 (que ignora `exports`) e mocks atualizados ao código atual (subconta, `requireArea`, permissões de grupo). Sem bug em `src/`.
- **Barra do Garças cobrar**: a conta principal só gera chave de subconta com lista de IPs ligada (proibido: a Vercel não tem IP fixo). O usuário precisa entrar na subconta, gerar a chave e rodar `npx tsx scripts/ligar-subconta-asaas.ts BGA`.

## 58. Claude — Recepção, agenda, lista de presença e Boletim Aurora (26/10/2026)

- **Equipe de recepção não liberava ninguém**: `definirRecepcaoEmLote` só aceitava eventos `source: 'manual'`; nos do Ulisses (ex.: Dia Mundial da Filosofia em BGA) falhava para todos. Agora aceita `manual` e `ulisses` publicados da filial, inclui quem tem acesso de voluntário e devolve `semAcesso` (com `podeLiberar`, de `podeLiberar` em `acesso-voluntario.ts`). A tela (`event-reception-selector.tsx`) mostra todos os ativos (marca "sem acesso de voluntário") e, para quem a pessoa pode liberar, pergunta "Liberar o acesso e incluir"; para quem não pode, explica a quem pedir (Direção ou responsável pelo grupo, em "Liberar acessos"). Teste em `events.test.mjs` atualizado.
- **Lista da recepção** (`event-reception.tsx`): linhas compactas com a presença numa caixinha à direita (coluna "Presente"), sem um botão por pessoa.
- **Agenda**: tocar num próximo evento abre o detalhe dele já expandido e rola até ele (`itemAberto` em `agenda-panel.tsx`); evento da escola em verde suave em vez de dourado/laranja.
- **Boletim Aurora** (`lib/boletim-aurora.ts`): cartão abaixo dos atalhos da página inicial do Portal (escolas em português) com a edição mais recente (API do WordPress do acropole.org.br, categoria 104, cache de 6 h); sem resposta, link para a página do boletim.
- Ágora: o Marcos aceitou o token no cabeçalho Authorization e incluiu o id da imagem do evento (`/e/og/imagem/{id}` ou `/api/anexos/{id}/imagem`); reteste pendente do login do usuário (`scripts/testar-token-agora.mjs`).

## 59. Claude — Leituras do GAF (26/10/2026)

Pedido do usuário: o coordenador escolhe o texto de cada encontro do GAF pelo cronograma, ou deixa automático a partir do primeiro encontro com texto (podendo mudar); o participante toca e lê no site do GAF.
- **Migração `20261026210000_gaf_leituras`** (autorizada pelo usuário, aplicada e resolvida): `GroupMeeting.leituraGaf` (texto escolhido, `"nenhuma"` = sem leitura, nulo = automático). A tabela já tinha RLS.
- `lib/gaf-leituras.ts`: cronograma da Etapa Teseu (6 bimestres, 24 textos, links `gaf.oinabn.com.br/artigos/teseu/artigoNN.html`, tirados do site em 26/10); `leiturasEmSequencia` (escolha manual recomeça a sequência; "sem leitura" não avança; depois do #24 fica "a definir"). Maat e Prometeu estão "em construção" no site: entram quando o cronograma for publicado.
- `grupos-dados.ts` (`leiturasGaf`, 4 últimos e 8 próximos encontros, sequência sobre todos), ação `definirLeituraGaf` (só quem gere o GAF), cartão "Leituras dos encontros" na aba Encontros (`components/grupos/leituras-gaf.tsx`): seletor por encontro para a coordenação, link do texto para todos. Testes em `tests/gaf-leituras.test.ts`.
- Ágora (reteste 26/10, 19h): com o token no cabeçalho, ainda 403 em `/api/*` e também no Swagger (`/v3/api-docs`); o token do `portal-aluno` sai com `aud: account`. Pedido ao Marcos: aceitar o `portal-aluno` ou incluir `eventos` no `aud`, e informar o endereço da API externa. `scripts/testar-token-agora.mjs` agora também lê a documentação com o token.

## 60. Claude — Túnel do Ágora: eventos do Ágora na Agenda do aluno (27/10/2026)

Combinado com o Marcos (27/10): o Ágora aceita o token do login unificado do client `portal-aluno` quando ele traz o papel de client `agora_login` (atribuído pelo Marcos nos papéis padrão do realm), valida (assinatura, `iss`, `exp`, `azp`), acha o usuário e devolve um cookie de sessão; nas chamadas seguintes vai só o cookie (pedido dele: não consultar o banco do Ágora a cada chamada). Teste do usuário em 27/10: `/api/usuarios/usuario-logado`, `/api/eventos/periodo` (12 eventos) e `/api/sedes` com 200; documentação em `/v3/api-docs` (API externa em `/api/v1/pub/*`).
- **Migração `20261027190000_sessao_agora`** (autorizada, aplicada e resolvida): `SessaoAgora` (1 por membro; access/refresh do Keycloak e cookie do Ágora cifrados; validade; última falha). RLS.
- `lib/segredo-cifrado.ts`: AES-256-GCM com chave derivada (HKDF) de `MATRICULA_CPF_CHAVE` por finalidade (sem variável nova).
- `lib/login-acropole.ts`: `trocarCodigo` devolve `tokens`; `renovarTokens` (refresh). O callback (`app/auth/acropole/callback`) grava a sessão (`salvarSessaoAgora`) depois de abrir a sessão do Portal; falha não impede o login.
- `lib/agora/sessao.ts`: `chamarAgora(memberId, caminho)` pela ponte: cookie enquanto valer (≤ 2 h e ≤ validade do token); 401/403 → token (renova pelo refresh) e guarda o cookie novo do `Set-Cookie`. Sem sessão → `SemSessaoAgora` (quem entra com senha não vê o Ágora).
- `lib/agora/eventos.ts`: `/api/eventos/periodo` (90 dias) → itens `evento` da Agenda (`source: "agora"`, nacional/regional, cartaz `/e/og/imagem/{id}`, inscrição `#/e/<slug>`, botão "Inscrever-se no Ágora"), em paralelo em `getMemberDashboard`, no máximo 6 s. Formatos de data/imagem tratados com tolerância: **conferir no primeiro login real** (data, imagem, `nacional`/`regiao`).
- Testes em `tests/agora-tunel.test.ts` (cifra, datas, conversão). Suíte 121/121.
- Pendente: `/api/eventos/inscricoes/minha` exige `somentePendPag` (mostrar "minhas inscrições do Ágora" depois); XSRF só importa se o Portal for fazer escrita no Ágora.
- 27/10 (tarde): primeiro login real conferido (12 eventos, mesmos do Ágora). O Ágora manda só a data ("2026-10-31"): esses eventos viram "dia inteiro". Imagem vem como objeto `{id}`; `regiao` como código (RNN, RCO); `sede` como objeto; `situacao` INS_ON/PEND. Usuário achou eventos demais: regra de restrição em discussão (ver resposta ao usuário e pergunta ao Marcos).
- 27/10 (noite): por indicação do Marcos, a Agenda usa `/api/eventos/acoes` (a lista da página inicial do Ágora, já filtrada por ele: `INSCRICAO_NOVA`/`INSCRICAO_EDITAR`, valor, lote/prazo, região NAC/RCO/RNN), completada com `/api/eventos/periodo` (180 dias) para data/descrição/local. Cartão mostra valor, prazo e "Você já está inscrito(a)" (botão "Ver no Ágora"). Para o usuário (ROLE_MEMBRO + ROLE_ADMIN_SEDE em BGA) continuam 12; falta ver um membro comum.

## 61. Claude — Barra do Garças cobra pela subconta (27/10/2026)

- O usuário gerou a chave da subconta (`.env.local` `ASAAS_API_KEY_BG`, só local). `scripts/ligar-subconta-asaas.ts BGA --da-env ASAAS_API_KEY_BG` (rodar com `npx tsx --env-file=.env --env-file=.env.local`, porque o carregador do Next esvazia valores com `$`): chave conferida com a carteira, gravada em `School.asaasSubaccountApiKey`, webhook do Portal cadastrado na subconta (36 eventos). Nome nas cobranças: ORGANIZACAO NOVA ACROPOLE.
- Pix Automático **não está liberado** na subconta ("O Pix Automático não está disponível para sua conta no momento"): webhook cadastrado sem os eventos `PIX_AUTOMATIC*`; opção escondida no Portal por `pixAutomaticoLiberado` (`PIX_AUTOMATICO_UNIDADES`, ex. "BGA"; sem a variável ninguém vê) e recusada na ação.
- Ainda não testado em produção: primeiro pagamento real (confirmação pelo webhook da subconta, split de 2%, lançamento no Mercúrio pela rotina `fila-mercurio` com Chromium na Vercel).
- 27/10 (noite): eventos do Ágora sem horário (só data) não mostram hora; `duracao` é em DIAS (fim = início + duração - 1; o cartão mostra "31/10/2026 a 02/11/2026"); local em sigla ("ITA") vira o nome da sede; descrição em Markdown com <br> vira texto em linhas (`textoDoAgora`: títulos sem #, sem **, listas com •), até 3000 caracteres.
- 27/10 (noite): compartilhar evento do Ágora (WhatsApp, arte e painel): `eventoCompartilhavel` trata `source: "agora"` — arte com "EVENTO NACIONAL"/"EVENTO REGIONAL" (campo `chamada`), valor real "Inscrição: R$ 485" (`valorTexto`, de `/eventos/acoes`) e faixa "INSCRIÇÕES NO ÁGORA" com o domínio do Ágora; WhatsApp com "Inscrições no Ágora: <link>" e a descrição em linhas. Antes saía como "Encontro da escola", "Entrada gratuita" e "Confirme no Portal".
- 27/10 (noite): **pagamento de contribuição em BGA falhou**: o Asaas recusou ("O Pix não está disponível no momento. Para utilizá-lo, sua conta precisa estar aprovada"). `/myAccount/status` da subconta: commercialInfo APPROVED; bankAccountInfo, documentation e general PENDING; documentos não enviados: ata de eleição da última diretoria, identificação e selfie do responsável. Agora o Portal só cobra com subconta **ligada e aprovada** (`subcontaAprovada`/`escolasQueCobramOnline` em `asaas/conta-escola.ts`, cache 6 h aprovada / 10 min em análise; usado em `member-data` e no site de matrículas): até lá, "em breve" em vez de erro.
- Fila do Mercúrio na Vercel falhava ("Cannot find module …/playwright-core/browsers.json"): `outputFileTracingIncludes` da rota inclui os `.json` de `playwright-core`/`playwright`.
- **CallMeBot responde 403**: os alertas de erro/rotina não chegam ao WhatsApp do usuário (depende de reativar a chave do CallMeBot).
- "Meus eventos" (`/eventos`): seção "Inscrições no Ágora" com os eventos em que a pessoa já está inscrita lá (`INSCRICAO_EDITAR` de `/eventos/acoes`), link para o Ágora. Imagens do Ágora conferidas: `/e/og/imagem/{id}` responde PNG.
- 27/10 (noite): **login com e-mail e senha de volta à tela** (pedido do usuário: em Barra do Garças há quem não consiga entrar pelo login unificado). `/login` mostra sempre "Entrar com a conta Nova Acrópole" em primeiro e, abaixo, "ou entre com e-mail e senha" (senha inicial = 6 primeiros números do CPF; "Esqueci minha senha" continua). Acabou o `?modo=senha`. Mensagens de erro do callback do login unificado voltam a indicar a senha. BGA: 37 cadastros, todos com login no Portal. Quem foi criado pelo login unificado tem senha aleatória: a administração da filial volta para a inicial em "Esqueceu a senha?" (`voltarSenhaInicial`). Sem sessão do login unificado, o Ágora não aparece na Agenda (esperado).
- 27/10 (noite): **avaliação dos instrutores compartilhável no WhatsApp** (pedido do usuário). Em Escolástica → Avaliação, cada rodada **aberta** tem o botão "Compartilhar no WhatsApp" (`linkWhatsappDaAvaliacao` em `avaliacao-comum.ts`): abre o WhatsApp com o título da rodada em negrito, o convite ("leva poucos minutos, as respostas não guardam quem respondeu") e o link `/avaliacao`. Sem login, o link passa pelo `/login?next=/avaliacao`; sem nada pendente para a pessoa, volta ao Portal. Teste: `tests/avaliacao-whatsapp.test.ts`.
- 27/10 (noite, depois): **login com e-mail e senha escondido de novo** (pedido do usuário: "pode tirar então, o acesso com os primeiros dígitos do CPF"). Revertido o commit 07ff65c: `/login` mostra só "Entrar com a conta Nova Acrópole"; e-mail e senha seguem em `/login?modo=senha`, só para emergência. Quem não tem senha no login unificado cria pelo "Cadastre-se" / "Esqueceu sua senha?" da própria tela da Nova Acrópole (mesmo e-mail do Mercúrio, e-mail confirmado).
- 27/10 (noite): **inscritos do Ulisses no Portal** (pedido do usuário: o "Dia Mundial da Filosofia" de BGA aparecia sem inscritos no Portal). Novo `src/lib/ulisses/inscritos.ts`: credencial M2M do Auth0 (a mesma do CRM; env `ULISSES_API_CLIENT_ID`/`ULISSES_API_CLIENT_SECRET`), `POST /facade/filtrarEmails` pela ponte, casamento com os alunos da escola por e-mail ou celular, cache de 5 min, nada de dados do público guardado no Portal. Recepção (`/eventos/[id]/recepcao`) de evento do Ulisses lista os inscritos de lá (aluno da escola ou público externo) e a caixinha de presença grava no próprio Ulisses (`/facade/compareceu/{id}/{true|false}`, ação `marcarPresencaUlisses`, com auditoria em EventAudit). Painel → Eventos mostra "N inscrições no Ulisses"; Relatório da filial conta os inscritos do Ulisses. Para ligar: `node scripts/ligar-ulisses-inscritos.mjs` (copia a credencial do banco do CRM para o `.env` e a Vercel; a cópia automática pelo agente foi barrada pela permissão). Teste: `tests/ulisses-inscritos.test.ts`.
- 27/10 (noite): credencial do Ulisses ligada pelo usuário (`.env` e Vercel). Teste local: Dia Mundial da Filosofia 2026 (BGA, ulisses:24709:44:28089) = 5 inscritos no Ulisses, os 5 alunos da escola, resposta em ~1,2 s.
- 28/10: alertas do CallMeBot voltaram a chegar. Dois avisos passageiros: `resumos` (02:15, "fetch failed" no banco de consulta do Mercúrio em GUA/JPE/JUA/MCP; a rodada seguinte já passou) e `saude` (10:07, Ulisses sem resposta em 15 s; logo depois respondia em <1 s). Para não alertar por oscilação: `mercurio-db/client.ts` repete 1 vez (2 s depois) a requisição que falha por rede (só SELECT e login passam por ali); `saude.ts` repete cada verificação 1 vez (3 s depois) antes de dar falha.
- 28/10: as três tarefas do Windows "CRM - Ulisses *" (Diario 05:30, 6h Semana Evento, 3h Reta Final) foram **desativadas** (Disable-ScheduledTask; reativar com Enable-ScheduledTask) porque abriam telas no computador do usuário. Até a rotina em nuvem do CRM rodar (faltam os segredos PONTE_URL/PONTE_CHAVE no GitHub do CRMNovaAcropole, teste manual do workflow em modo ulisses_api e aplicar migracao_ulisses_api_nuvem.sql), o CRM fica sem atualização do Ulisses. O Portal não depende disso: lê os inscritos direto da API do Ulisses.
- 28/10: **turma XESOTRIS (BGA) "sem instrutor"**: no Mercúrio os 9 alunos estão com `cad_turma='XESOTRIS'`, mas a turma cadastrada (`turmas`) e os instrutores (`turmas_materias`: NET 43129, NSC 21596) estão em 'XESOTRIS1'. Mesmo caso em PTN ('XESOSTRIS' x 'XESOSTRIS26'). `importar.ts` agora usa `apelidosDeTurma` (`mercurio-db/turmas.ts`): código de turma do aluno que não existe em `turmas` + uma única turma da unidade com esse código seguido de números → os instrutores dela valem para a turma dos alunos. Fechamento de BGA rodado: XESOTRIS com Ética (Gilsonia) e Sociedade (Luiz Henrique). PTN corrige na próxima rotina. Teste: `tests/turmas-apelido.test.ts`.
- 29/10: **eventos do Ágora sumiram da Agenda do usuário em 28/10**: a sessão do Keycloak guardada em SessaoAgora tem refresh com prazo fixo (o dele venceu 28/10 18:03 BRT, ~1 dia depois do login), mas o login do Portal (Supabase) dura semanas — a pessoa nunca passa de novo pelo login unificado e o Ágora some sem aviso. Agora: `tokenDoAluno` não apaga a sessão quando o refresh falha (só limpa refresh e cookie); `agoraPrecisaReconectar` (sessao.ts) → `agoraReconectar` em member-data → Agenda mostra "Mostrar os eventos do Ágora" (link para `/auth/acropole/login?next=/portal`). Preparado `KEYCLOAK_OFFLINE=1` (pede `offline_access`, refresh de semanas): o realm anuncia o escopo e a tela de login aceita, mas **só ligar depois de o Marcos confirmar** que o client portal-aluno tem o escopo e os alunos o papel offline_access (senão a troca do código falha e o login quebra). Visto também: outra sessão recebeu 403 em `/api/eventos/periodo` (as ações vieram; só faltam descrição/local completos para essa pessoa).
- 29/10: **Área de Estudos**: "Acessar Biblioteca" agora leva a https://biblioteca.acropolebrasil.com.br/ e aparece para todos; novo botão **"Bastiões"** (https://bastiao.oinabn.com.br/) só para membros (mesma regra `bibliotecaLiberada` = público "membros": 2º nível em diante, FV, HD, dirigentes, provacionistas). `StudyAreaPanel`: prop `mostrarBastioes` (era `mostrarBiblioteca`). Subtítulo do quadro "Área de Estudos" igual para todos.
- 29/10: **cookie do Ágora** (Marcos: o cookie que o Ágora gera dura 1 dia e é renovado a cada requisição). Antes o Portal descartava o cookie depois de 2 h (`COOKIE_MAX_MS`) e voltava ao Bearer do Keycloak, que vence. Agora (`agora/sessao.ts`): usa o cookie enquanto o Ágora aceitar; cada uso renova o prazo (+1 dia, ou Max-Age/Expires do Set-Cookie) e junta Set-Cookie novos (`cookieRenovado`); só 401 descarta o cookie (403 = rota não liberada para a pessoa, ex. `/eventos/periodo`); `agoraPrecisaReconectar` considera o cookie válido. Quem abre o Portal ao menos 1 vez por dia não depende mais do prazo do Keycloak. Possível passo seguinte (só com o aval do Marcos): rotina que renova o cookie de quem não abre o Portal. Teste em `tests/agora-tunel.test.ts`.
- 29/10: **Agenda → Próximos eventos**: primeiro "Na sua escola" (eventos da escola, grupos, turma e conversas dos próximos 30 dias), depois "Outros eventos" (rede e outras filiais), só 3 à vista; o resto em "Carregar mais eventos (N)" (+6 por toque). Subtítulos só quando há os dois grupos.
- 29/10: Marcos viu no log do Ágora chamadas a `/api/versao` pedindo JSON (o endpoint responde text/plain → 400). Era o `/diagnostico` da ponte (usado pela verificação de saúde). `infra/ponte-cloudflare/src/index.ts` agora pede `text/plain` nesse alvo (200). **Falta publicar o Worker** (`npx wrangler deploy` na pasta; o deploy pelo agente foi barrado pela permissão). Teste do cookie com o Marcos: 07:28–07:29 BRT, `/api/eventos/acoes` e `/api/eventos/periodo` só com o cookie `naevtkn` → 200, Set-Cookie novo a cada resposta (Max-Age=86400).
- 29/10: **Próximos eventos em grade** (pedido do usuário: caber mais sem apertar): `LinhaProximo` virou cartão (data compacta + tipo no alto, título em até 2 linhas, horário embaixo), 2 por linha (`grid-cols-2`), nos dois grupos.
- 29/10: **eventos do Ágora de uma escola só para ela** (pedido do usuário: "Curso: Música" de Belém aparecia para as outras filiais). O código da sede do Ágora é o código da unidade no Mercúrio (BLM, BOA; centros FNA/ITA são `uni_status='INS'`). `eventoDeOutraEscola` (agora/eventos.ts): nacional = todos; sede numa escola (FIL/URB/CEN) = só essa escola (vale mesmo com `permiteSedeExterna`); sede num centro + título citando escolas ("Voluntariado Guará, Gama e Valparaíso"; bairro sem a cidade, "Fortaleza" vale para as de Fortaleza) = só essas; centro sem escola no título = região. Unidades do Mercúrio em cache de 12 h (3 s de prazo; sem elas, não filtra). Para BGA: de 12 para 3 (os nacionais). Testes em `tests/agora-tunel.test.ts`.
- 29/10: **GAF no Portal do aluno para quem já está num GAF** (pedido do usuário): em vez de "Conhecer o GAF", o quadro mostra o grupo — próximo encontro (dia e horário, cancelamento com motivo, detalhes públicos), botão "Entrar no encontro online" só se o GAF for online/misto e tiver link, texto para ler do encontro (link para o site do GAF), participantes (coordenação e integrantes) e, para quem coordena, link "Administrar o grupo (Portal do Voluntário)". Título do quadro = nome do GAF. Dados por `gafNoPortal` (grupos-dados.ts, reaproveita `detalheDoGrupo` e suas permissões), carregados ao abrir o quadro (`meusGafsNoPortal` em `actions/gaf-portal-actions.ts`); se falhar, mostra o resumo antigo. Quem não está em GAF continua vendo o convite e o pedido.
- 29/10: **cores dos eventos do Ágora coerentes**: `agendaDasAcoes` recebe a escola da pessoa e as unidades do Mercúrio; sede na própria escola = `scope: filial` (verde, "Evento da escola"); sede em escola de fora = laranja "Evento de X" (só se escapar do filtro, ex.: Mercúrio fora); centro da rede (Fazenda, Ítaca) ou sede desconhecida = turquesa. Rótulo dos eventos do Ágora nacionais/regionais leva a sede: "Evento nacional · Fazenda Nova Acrópole". Antes, sem `/eventos/periodo`, caía em "Evento de RCO"; agora regional. Compartilhar: escola = "EVENTO DA ESCOLA".
- 29/10: **Leituras do GAF (coordenação)**: cada encontro tem botões "Mudar" (abre a lista de textos, com Cancelar) e "Excluir" (encontro sem leitura); sem leitura → "Voltar ao cronograma". Antes só havia a lista de seleção. **"Administrar o grupo" no Portal do aluno** só para quem gere o GAF **e** tem acesso de voluntário (`temAcessoVoluntario`).
- 29/10: **tema segue o aparelho**: sem escolha salva no Portal (`na-theme`), o script de `layout.tsx` usa `prefers-color-scheme` e acompanha a troca do sistema; o botão de tema continua valendo como escolha manual (fica salva). **GAF cancelado**: o aviso fica e abaixo vem "Encontro seguinte" (data, detalhes, link online) e o texto desse encontro.
- 29/10: **Diário filosófico dentro do Portal** (pedido do usuário; migração **`20261029120000_diario_filosofico` autorizada e aplicada**, marcada com `migrate resolve`; `DiarioDia` e `DiarioPratica`, RLS ligada, conferido). Simplificação do Diário Filosófico (repo `diario-filosofico`, versão publicada `3215147`):
  - `/diario` (botão "Meu diário" no quadro do GAF): dias = hoje e no máximo 3 anteriores; Fogo Interno (dias seguidos com Epílogo, recorde, total, os 9 graus do diário antigo); frase do dia; Prólogo (virtude: lista das 30 com descrição/práticas/frase, sortear ou escrever a própria; "Meu compromisso para hoje"); práticas da pessoa (diária, dias da semana, a cada 14 dias, dia do mês) para marcar no dia; Epílogo (3 perguntas ou reflexão livre; "Não fiz o Prólogo hoje").
  - Privado: só a própria pessoa (ações em `actions/diario-actions.ts` sempre com o membro logado). Fora: IA, Balão, metas, relatórios, modo FV, anúncios.
  - Conteúdo em `diario-conteudo.ts` (30 virtudes e 26 frases copiadas do diário antigo); regras em `diario.ts` (testes em `tests/diario.test.ts`); leitura em `diario-dados.ts` (dia no fuso da escola).
  - **Frase do dia** também no fim do Portal (lista do Portal + as 26 do diário, fixa por dia).
  - Pendentes: lembretes do diário como push do Portal; importação do Firebase (`diario-filosofico`, chave de conta de serviço na pasta Downloads do usuário — não copiar para o repositório); livros na Área de Estudos (precisa de tabela nova, pedir autorização); GDVE com o "dia de FV" (diferente do modo FV oculto do diário antigo), a fazer depois.
- 29/10: **lembretes do diário** como push do Portal (`avisosDoDiario` na rotina notificacoes): Prólogo às 7h e Epílogo às 21h no fuso da escola, para quem usou o diário nos últimos 14 dias e não fez a parte do dia; 1 por dia (PushEnviado). **Atividades da turma**: as que já aconteceram ficam na gaveta fechada "Já aconteceram (N)".
- 29/10: **importação do Diário Filosófico (Firebase `diario-filosofico`)**: `scripts/importar-diario-firebase.ts` (firebase-admin, devDependency; chave de conta de serviço na pasta Downloads do usuário, fora do repositório; sem `--gravar` só conta). Pareia pelo e-mail **confirmado** no Firebase com um único cadastro do Portal; pula dias vazios (salvamento automático do app antigo); não sobrescreve dia escrito no Portal; reexecução sem duplicar (`origemId`). Rodado e gravado: 15 contas; 3 pareadas (112 dias, 3 práticas); 7 com e-mail não confirmado e 5 sem cadastro no Portal ficaram de fora (só contagem). Há duas chaves desse projeto na pasta Downloads (…0084038d01 antiga e …7303b6efc8 usada): sugerido revogar a antiga.
- 29/10: **entrada do diário**: o cartão laranja virou "noite e ouro" (verde Heket quase preto + dourado Helios, fechadura desenhada) com a situação de hoje antes de abrir (Prólogo feito/a fazer, Epílogo feito/a fazer, dias do Fogo Interno; `estadoDoDiarioHoje`, sem texto do diário). Ao tocar: tela cheia com fechadura acesa, duas portas se abrem sobre uma luz dourada e "Só a sua consciência entra aqui" (~1,7 s, `entrada-diario.tsx`, keyframes `diario-*` em globals.css); a página do diário começa com a luz se desfazendo. Quem pede menos movimento (prefers-reduced-motion) entra direto. Fogo Interno na mesma paleta.
- 29/10: **migração `20261029150000_anotacoes_observacoes_livros` autorizada e aplicada** (resolve marcado; RLS conferida): `Activity.observacaoInterna/observacaoAlunos`, `AnotacaoAula`, `LivroLeitura`.
- 29/10: **Área de Estudos** ganhou atalhos: "Anotações das aulas" (`/estudos/anotacoes`), "Meus livros" (`/estudos/livros`) e "Meu diário" (`/diario`, para quem não está em GAF também).
  - Anotações (`lib/anotacoes.ts`, `actions/anotacoes-actions.ts`, `components/estudos/anotacoes-cliente.tsx`): matéria = as da turma do aluno (TurmaMateria), tema do catálogo (ou escrito, se a matéria não tem catálogo); uma anotação por matéria e tema; compartilhar pelo Portal (professor confere; texto alterado volta a "pendente"); colegas veem só as "corretas" (resumo ou texto, com o primeiro nome); WhatsApp, "Salvar na nuvem / outro app" (menu de compartilhar do celular com arquivo .txt: Google Drive, e-mail...) e PDF (`/estudos/anotacoes/[id]/pdf`, impressão do navegador). Resumo por IA: Claude Haiku 5.5, esforço baixo, só com o que o aluno escreveu (1 a cada 2 min por anotação).
  - Livros: lendo, quero ler, tenho (ainda não li), lido.
- 29/10: **professor**: na página da turma, "Anotações dos alunos para conferir" (`conferir-anotacoes.tsx`, `anotacoesParaConferir`: matérias que o professor dá na turma; administração/Escolástica veem todas) com Correta / Incorreta / Desfazer, em segredo para o aluno. Atividades que já aconteceram: "Como foi" com observação para os alunos (aparece no cartão da Agenda, "Do professor:") e observação só para professores/administração (`salvarObservacoesAtividade`). A Agenda do aluno agora traz atividades dos últimos 30 dias. **Prova na Agenda**: mostra "Seu resumo" e "Resumo de um colega" (corretos) dos temas da prova, e o atalho para fazer anotações quando ainda não há resumo.
- 29/10: **diário só para quem participa de GAF** (página e ações; atalho saiu da Área de Estudos). **Presença no GAF (coordenação)**: no painel do grupo, "Marcar presença" dos últimos 8 encontros realizados (caixinhas por pessoa, mostra a justificativa de quem respondeu; `marcarPresencasDoEncontro`, grava na mesma GrupoPresenca da resposta do integrante) e "Relatório de presenças" (este mês, mês passado, 3 e 6 meses, ano ou datas livres; por pessoa: presenças/encontros e %, justificadas, faltas, sem registro; planilha CSV; `relatorioPresencas`).
- 29/10: **página inicial**: o quadro "Minha Contribuição" virou **"Economia"** (modal com o cartão da contribuição, atalho para Minha Contribuição e a carteira Fortuna). No topo, **Acesso rápido** (`acesso-rapido.tsx`): (1) contribuição atrasada, sem desconto ou a ≤ 5 dias do vencimento sem pagamento; (2) o quadro mais usado (≥ 4 aberturas em 30 dias, contadas só no aparelho, localStorage `na-uso:<memberId>`; Economia mostra o Fortuna); (3) sem nada: frase do dia alternando a cada 9 s com o Acrópole Play (se a filial liberou) + próximos 3 eventos. Frase no fim do Portal só quando não está no topo. Tour: passos da contribuição e do Fortuna viraram um, no quadro Economia.
- 29/10: **texto do GAF dentro do Portal** (`/gaf/texto/[codigo]`, `lib/gaf-texto.ts`): o site do GAF trava cada artigo com uma senha guardada só na sessão do navegador (auth.js → /index.html), por isso o link caía no site. O Portal busca o artigo no servidor (cache 1 dia), limpa (lista fixa de tags de texto, sem scripts/estilos/imagens/navegação, links só para as notas `#...`, uma passada só que escapa `<` solto) e mostra com anterior/próximo e "Fonte: site do GAF". Para quem participa de GAF ou tem Portal do Voluntário. Links trocados no quadro do GAF e na lista de leituras da coordenação. Mapa do site (29/10): etapas → Teseu com 24 artigos (`artigos/teseu/artigo01..24.html`, títulos iguais ao cronograma do Portal); Maat e Prometeu sem textos. Teste em `tests/gaf-leituras.test.ts`; os 24 artigos limpos com conteúdo.
- 29/10: **histórico do diário** (`/diario/historico`, `carregarHistorico` em `lib/diario-dados.ts`): registros por mês (setas entre os meses que têm registro), cada dia fechado com virtude e ícones de Prólogo/Epílogo; aberto mostra compromisso, práticas feitas, as três respostas e a reflexão livre. Só leitura; "Editar este dia" só nos 4 dias editáveis. Botão "Histórico" no topo de /diario. Só a própria pessoa, só quem participa de GAF. Resumo mensal por IA: custo estimado, **não implementado** (aguarda definição do usuário sobre o formato e os cuidados com registros pessoais).
- 29/10: **vitrine do Portal** (`components/member/vitrine.tsx`): no centro da página inicial, um destaque por vez trocando a cada 5 s (pausa ao passar o mouse/focar/tocar, botão de pausa, pontos, deslizar no celular). Destaques: contribuição (primeiro quando urgente), o quadro mais usado, próximos eventos, uma série da Acrópole Play por dia (`lib/acropole-play/series.ts`, 9 séries da página pública; o clique entra pelo login automático, que abre a Play no início), diário (só GAF, sem nenhum texto), Fortuna ("Coloque mais crédito e evite filas!" com o saldo), Criança para o Bem (inclui na contribuição quando a filial tem a rubrica, senão leva ao site), convite ao GAF (quem não participa), voluntariado (membros que ainda não são voluntários) e contribuição em dia. Frase do dia sempre no fim. Filiais em inglês mantêm o bloco anterior. **Voluntariado só para membros**: quadro e destaque só para quem é do 2º nível em diante ou já tem acesso liberado; `oferecerApoioVoluntario` recusa N1 no servidor; em `acesso-voluntario.ts`, responsável de grupo não libera nem vê N1, só o Chefe de Filial (selo "N1 · exceção" na tela de liberar). **Boas-vindas do voluntário** (`lib/boas-vindas-voluntario.ts`, `components/member/boas-vindas-voluntario.tsx`): no próximo acesso depois da liberação, 3 passos (agradecimento e áreas indicadas; o que pode fazer no Portal do Voluntário; termo em /voluntario/termo); some de vez ao chegar ao fim, "Ver depois" fecha só na sessão. Sem migração (o "já vi" fica no aparelho). Na data: 13 liberados, nenhum com termo assinado, 4 deles do N1.
- 29/10: **decisões do usuário**: (1) Bastiões = https://bastiao.oinabn.com.br/ (endereço oficial confirmado; o código já usa; `MAPA-INTEGRACOES-PORTAL.md` atualizado). (2) Texto de trabalho do GAF **continua dentro do Portal** (`/gaf/texto/[codigo]`) por enquanto; quando o site do GAF estiver no login unificado, o link passa a abrir o site. Não trocar antes disso.
- 29/10: **oportunidades de voluntariado** (pedido do usuário). Tabelas `OportunidadeVoluntariado` e `InteresseVoluntariado` (RLS; migração `20261029200000_oportunidades_voluntariado`, autorizada pelo usuário). Regras em `lib/oportunidades.ts` (+ `oportunidades-comum.ts` para o navegador): cadastram a Direção da filial (chefe, sub-chefe, administradores) e os responsáveis de secretarias/grupos (SEC, GDVE, BF, BM, CS, secretários, mandatos) com acesso de voluntário; veem só membros e quem já tem acesso de voluntário. Gestão em `/voluntario/oportunidades` (destino "Oportunidades" na Área do Voluntário, com contador de interessados aguardando): cadastrar/editar/encerrar, aceitar/recusar interessados, WhatsApp, e "Ofertas por área" (as ofertas da lista fixa, que antes só apareciam na ficha). Membro: quadro Voluntariado lista as oportunidades ("Quero ajudar" com recado, desfazer), a lista fixa de áreas continua abaixo. Aceito entra no grupo vinculado (SEC ou GDVE, regras de `candidatoElegivel`); em SEC ganha acesso de voluntário (e as boas-vindas). Avisos push: responsável (novo interessado, desistência de aceito, indicado como responsável), membro (aceito/recusado, abre `/portal?abrir=voluntariado`), Direção (oferta por área). Vitrine: com oportunidade aberta, o destaque de voluntariado mostra a mais próxima. Teste: `tests/oportunidades.test.ts`. **Só publicar depois de aplicar a migração.**
- 29/10: **turma de pedagogos aceita qualquer pessoa ativa da filial** (pedido do usuário: a escola inclui futuros instrutores antes de aparecerem como pedagogos no Mercúrio). `candidatoElegivel`/`filtroCandidatos` (grupos-portal.ts) sem a exigência de isPedagogo/instrutor de turma para PED; em branco continuam entrando todos os instrutores ativos.
- 29/10: **dia e horário dos encontros na criação de grupos** (pedido do usuário, turma de pedagogos): `form-grupo.tsx` ganhou dia da semana ("A definir" por padrão), início, término e frequência (semanal, quinzenal, a cada 4 semanas). Ao criar, cria a série com `createGroupMeetings` (mesma regra de "Reuniões do grupo"), começando na próxima ocorrência do dia, no fuso do aparelho. Vale para todos os grupos do Portal; na edição, os encontros continuam em "Reuniões do grupo".
- 29/10: **trilha individual dos pedagogos** (pedido do usuário: cada pedagogo apresenta todos os temas de todas as disciplinas para concluir o N1, sem ligação com os colegas). `lib/pedagogos-programa.ts`: programas (N1 = NET+NSC+NFH, 18 temas; demais matérias com catálogo como programa de uma disciplina), `proximoTema`/`temasFeitos`. `previaDaEscala` (escala-pedagogos.ts) dá a cada pessoa o próximo tema da própria trilha (contam agendada e apresentada de qualquer turma; faltou/cancelada repete), deixa de fora quem já tem todos marcados ou feitos. Tela: "Programa" no lugar de "Disciplina", ✓ nos temas já feitos, trocar a pessoa sugere o próximo dela, painel "Progresso na formação" (quem gere vê todos; o pedagogo, só o próprio; "Concluiu" com todos apresentados), tema com a disciplina na frente. Teste: `tests/pedagogos-programa.test.ts`. Nenhuma apresentação gravada até esta mudança.
- 29/10: **prazo do plano de aula em escala feita em cima da hora**: `prazoDoPlano(data, marcadaEm, fuso)` (escala-pedagogos.ts): 7 dias antes; se a apresentação foi marcada depois disso, o prazo vira a véspera (ou o dia da marcação). Usado na escala, no aviso do Instrutor e nos lembretes (`avisosDePlanosDeAula`, janela desde hoje; não cobra atraso no próprio dia). Antes, quem era escalado hoje para daqui a 6 dias já aparecia com "Plano atrasado".
- 29/10: **saúde do Portal, Ulisses**: a verificação só conferia se a API respondia (e mostrava "5 eventos" = itens do catálogo de BGA, inclusive atalhos sem data). Agora falha também se a importação diária (`rotina:ulisses`) não rodou nas últimas 26 h ou terminou com erro, e mostra a hora da última importação e os eventos futuros do Ulisses no Portal.
- 29/10: **temas apresentados antes do Portal** (pedido do usuário, pedagogos): em "Progresso na formação", quem gere a turma abre "Temas já apresentados" por pessoa e marca os temas do programa; `registrarTemasAnteriores` (escala-actions.ts) grava como `apresentada` com `data = DATA_ANTES_DO_PORTAL` ("2000-01-01", escala-pedagogos.ts), substituindo o registro anterior daquele programa; temas que vieram pela escala ficam travados. Contam na trilha e no progresso; não aparecem na escala nem em "Já aconteceram" (janela de 120 dias).
- 29/10: **turmas de pedagogos na Escolástica**: aba "Turmas de pedagogos" (`/escolastica/pedagogos`, `ABAS_ESCOLASTICA`), mesma tela de Grupos (`PedagogosAdmin`), permissão `podeCriarTurmaPedagogos` na própria filial.
- 29/10: **pedagogo no Portal do Aluno**: `minhaTurmaDePedagogos` (escala-pedagogos.ts) → `dashboard.pedagogos` (turma e próxima apresentação com prazo e situação do plano). Quadro "Turma de pedagogos" na grade (abre a escala do grupo) e destaque na vitrine quando o plano está por entregar, atrasado ou devolvido. Antes, quem entrava na turma sem ser instrutor no Mercúrio só chegava à escala pelo aviso no celular.
- 29/10: **anotação de outra aula** (pedido do usuário: palestras, cursos especiais...): em Anotações das aulas, opção "Outra aula" sempre disponível (mesmo sem matérias da turma), com tipo (`TIPOS_AVULSA`) e título livre; grava com `materiaSigla = AVULSA`, tipo em `materiaNome`, título em `tema` (`lib/anotacoes-comum.ts`, sem migração). Toda anotação mostra a data e a hora em que foi feita (createdAt) e da última atualização, no fuso da filial.
- 29/10: **busca de funções no Portal do Aluno** (pedido do usuário): campo "O que você procura?" no topo (`components/member/busca-portal.tsx`, só escolas em português). Catálogo `FUNCOES_PORTAL` (`lib/busca-portal.ts`: título, descrição e palavras do dia a dia) com busca local instantânea (sem acento, tolera 1–2 letras erradas, frases-chave). Se a local não acha pelo título, depois de 0,7 s chama `buscarFuncoesComIA` (`actions/busca-actions.ts`, Claude Haiku 5.5, esforço baixo, ~1,4 mil tokens por busca, cache em memória), que só escolhe entre as funções que a pessoa tem (ids conferidos). Vai para a IA só o texto digitado e o catálogo. Destinos montados em `member-portal-client.tsx` (`destinosBusca`) com as mesmas regras dos quadros. Teste: `tests/busca-portal.test.ts`. Ao criar função nova no Portal, incluir no catálogo e em `destinosBusca`.

- 2026-10-29 (Claude) — Rotina resumos: queda curta do banco de consulta do Mercúrio ("fetch failed", 28 e 29/10, voltou sozinha) não gera mais alerta. `atualizarResumos` para a rodada no primeiro "fetch failed" (`semConexao`); a rota grava `ResumoNacional` "mercurio-fora:resumos" (geradoEm = início da queda) e só lança erro (saúde + suporte) se passar de 1 h. Volta a responder: apaga a chave. Outros erros continuam alertando na hora.

- 2026-10-30 (Claude) — Termo de voluntariado: o Portal deixou de colher assinatura (Instituto Maat: só vale gov.br ou papel com 2 testemunhas). `/voluntario/termo` orienta a procurar a secretaria/Direção da filial e mostra o texto recolhido; boas-vindas do voluntário idem (aparecem 60 dias após a liberação, sem depender do termo). Removidos `sign-term-form.tsx` e `volunteer-term-actions.ts`; `termoVigente`/`mascararCpf` saíram de `volunteer-term.ts`. Tabela `VolunteerTermSignature` mantida e vazia (o registro de teste do usuário foi excluído a pedido), sem migração. Ver docs/CONTINUIDADE-VOLUNTARIADO-DIARIOS.md.

- 2026-10-31 (Claude) — Desempenho do Portal do Aluno: `getMemberDashboard` reorganizado em 3 estágios de `Promise.all` por dependência (antes ~12 awaits em série; Ágora começa na 1ª linha); enquetes trazem só `_count` e o voto da pessoa; inscrições/fila com `select`. `ensureGroupMeetingWindow` confere numa leitura se falta encontro e só abre transação para séries incompletas (antes gravava/travava cada série a cada acesso). `meusGrupos` confere permissões em paralelo; `resumir` conta integrantes com `_count`. Medido na conta 21596 (daqui): 2,6 s → 1,1 s.

- 2026-10-31 (Claude) — Correções de dinheiro/segurança nas actions: recarga Fortuna só credita numa carteira da própria pessoa (branchId conferido no Fortuna) e reaproveita o PIX igual em aberto (duplo toque); itens da composição arredondados a 2 casas e com teto de R$ 5.000 (maior item real: R$ 261); voto de enquete confere que a opção é da enquete; token do webhook Asaas comparado em tempo constante; foto de perfil só JPG/PNG/WebP (bucket público, SVG barrado); pedido de GAF sem grupo limitado a 1 por mês.

- 2026-10-31 (Claude) — Front do Portal do Aluno: (1) `lerValorBRL` (src/lib/valor-brl.ts, teste em tests/valor-brl.test.ts) na recarga Fortuna e na composição — "20.00" virava R$ 2.000; (2) recarga Fortuna usa `usePaymentPolling`+`PaymentStatus` (antes ficava "Aguardando" para sempre se a rede falhasse); (3) fuso da filial: `getMemberDashboard` devolve `fuso` e `hoje` (civil); vencimento, próximos eventos, avisos dos grupos, destaque do Play e toda a Agenda (contexto `FusoDaAgenda`) usam esse fuso — antes misturavam SP fixo, aparelho e UTC do SSR; (4) erros que sumiam ou quebravam a tela agora aparecem em português: cancelar cobrança, desativar débito automático, votar em enquete, oferecer voluntariado, criar enquete, foto de perfil, endereço (e "Nada foi alterado"), resposta a reunião, troca de senha, login (mensagens do Supabase traduzidas), e telas de Economia/Instagram; (5) busca com IA descarta resposta de consulta antiga; (6) Enter repetido não duplica a edição de valor; aria-labels no tour e na carteira Fortuna.

- 2026-10-31 (Claude) — Lançamento automático da contribuição no Mercúrio: a fila roda na Vercel (UTC), e `lancarPagamentoContribuicaoHoje` abria o caixa de "hoje" pelo relógio do servidor — pagamentos confirmados depois das 21h de Brasília iam para o caixa do dia seguinte. Agora o worker passa `diaDoCaixaBR` e a data do pagamento no fuso da filial (`src/lib/fuso-escola.ts`, módulo puro; `atendimentos.ts` reexporta `fusoDaEscola`).

- 2026-10-31 (Claude) — Cores da marca: 138 classes genéricas do Tailwind (red/amber/emerald/teal/blue/indigo/green-100) trocadas pelos tokens do guia em modo claro (na-danger/-dark/-light, na-warning, na-success, na-turquesa, na-green-dark; texto sobre o gradiente verde em text-white/85), em 29 arquivos; variantes `dark:` mantidas; gráficos (aberturas/graficos.tsx) e TV fora. Contraste: 11 textos informativos de text-gray-400 para text-gray-500; subtítulo dos quadros do Portal de 10 para 11px. "CRM com traje completo" mantido (pedido do usuário de 19/10; aguardando confirmação).

- 2026-10-31 (Claude) — Actions restantes da revisão: plano de pedagogo não recebe arquivo com apresentação fora de "agendada", e arquivo novo em plano aprovado volta para "entregue" (revisão do instrutor); `createActivity` valida como `manageActivity` (função `publicacaoValida`); remoção de responsável de grupo em transação com reconferência (nunca fica sem responsável); "Aprovar e enviar todos" da régua de cobrança conta falhas por item e não aborta sem contagem. Mantido de propósito: aceitar interessado acima das vagas (decisão de quem responde). Pendente (precisa de migração): índice único parcial para cobrança pendente do mesmo mês.

- 2026-10-31 (Claude) — "CRM com traje completo" (sigla interna, mantida) só aparece para quem é FV: Agenda do Portal (`fullUniform` = `souFV && ...` em member-data), lista e formulário de reuniões (`MeetingManager` com `verTraje`, vindo de `detalheDoGrupo().souFV`); quem não é FV e edita a reunião preserva a marcação por campo oculto. Diário: o [aluno] (matrícula [matrícula]) tinha 102 dias no diário antigo com o mesmo e-mail do cadastro, mas e-mail não confirmado no Firebase (a importação exige confirmado) — script ganhou `--somente` e `--aceitar` por matrícula; dia salvo no Portal agora fica com `origem: "portal"` (reimportação não sobrescreve). A gravação foi bloqueada pelo controle de permissões; comando entregue ao usuário. Segunda conta dele (11 dias, outro e-mail) aguarda confirmação.

- 2026-10-31 (Claude) — Painel do Diretor: `getDirectorDashboard` em 2 estágios de `Promise.all` (antes ~18 consultas em série); % conciliado por 2 counts; inscrições, Fortuna e régua com `select` do nome. Mês corrente no fuso da filial (`mesNoFuso` em `src/lib/fuso-escola.ts`, teste em tests/fuso-escola.test.ts): pagamentos/eventos pela meia-noite local, vencimentos pela data civil. Medido na filial do usuário: 1,75 s → 0,38 s, KPIs idênticos.

- 2026-10-31 (Claude) — Calendário da filial no fuso dela: `itensDoCalendario` monta aulas fixas, turmas planejadas e feriados com `fusoDaEscola(uf)` + `deslocamentoNoFuso` (antes "-03:00" fixo; em BGA-MT as aulas apareciam 1 h depois); `conflitosDoHorario`/`sugerirJanelas` recebem o fuso (calendario-actions busca o da filial). Conferido em BGA: aulas às 18:30 e 20:00 de MT.

- 2026-10-31 (Claude) — **Tratak** (pedido do usuário, "igual tinha no antigo diário"; `components/diario/tratak.tsx`): instrução (aparelho a ~1 m, coluna ereta, "?" explica), tela cheia preta com o círculo e o ponto por 3 min (tela não apaga: wakeLock), mover o mouse, tocar duas vezes, Esc, sair da tela cheia ou trocar de app interrompe e não conta; concluído, "Confirmar prática" chama `registrarTratak` (práticas de HOJE com a chave fixa `tratak`, `PRATICA_TRATAK` em lib/diario.ts; sem migração). Está no quadro do GAF (abaixo da entrada do diário) e em "Práticas do dia" do /diario; aparece no histórico como "Tratak". Diário: um aluno (com --aceitar) com as duas contas antigas importadas — 113 dias (06/02 a 31/10), nada sobrescrito; script com `--vincular "Nome=matrícula"` e proteção para dia vindo de outra conta.

- 2026-10-31 (Claude) — **Diário de FV no GDVE** (aba "Meu diário de FV", só a própria pessoa; migração `20261031200000_diario_fv` autorizada, aplicação entregue ao usuário porque o controle de permissões bloqueia produção). Detalhes, decisões e importação em docs/CONTINUIDADE-VOLUNTARIADO-DIARIOS.md. Tratak ganhou `registrar` opcional (FV grava no dia escolhido). Não publicar antes da migração: a rotina notificacoes consulta `DiarioFvDia`.
- 2026-10-31 (Claude) — **Diários não somem depois do primeiro registro** (GAF e FV), mesmo fora do grupo: `temDiario`/`temDiarioFv`, página `/diario/fv`, lembrete de práticas de FV também para quem saiu do GDVE. Detalhes em docs/CONTINUIDADE-VOLUNTARIADO-DIARIOS.md. Sem migração nova; vai junto com o commit do diário de FV (publicar só depois da migração `20261031200000_diario_fv`).
- 2026-10-31 (Claude) — Migração `20261031200000_diario_fv` aplicada pelo usuário; diário de FV publicado. Importação de FV gravada (`--aceitar [matrícula] --vincular "Henrique Zanchi=21596"`): 5 contas antigas pareadas em 3 pessoas ([matrícula]: 85 dias, 21596: 63, [matrícula]: 19), 3 fichas, Tratak acrescentado em 45 dias do diário comum. 4 contas sem e-mail confirmado e 2 sem cadastro ficaram de fora.
- 2026-10-31 (Claude) — **Diário de FV só para FV**: o app antigo guardava o Tratak na parte de FV mesmo de quem não é FV; a importação criou 19 dias vazios e uma ficha vazia para um aluno que não é FV, o que abriu o diário para ele. Agora `temDiarioFv` = participa de GDVE **ou** (tem registro **e** `ehFV`); painel, `/diario` e lembrete seguem a mesma regra; o importador não cria dia de FV só com Tratak, nem ficha vazia, nem nada de FV para quem não é FV (o Tratak vai só para o diário comum). Limpeza dos registros vazios (`scripts/_limpa-fv-vazio.ts`, uso único) executada pelo usuário em 01/11/2026.
- 2026-11-01 (Claude) — **Segurança e picos (ondas 1 a 3, autorizadas pelo usuário)**. Onda 1: `/api/imagem-evento` só aceita o bucket exato do Ulisses (`br.com.acropolebrasil.ckfinder`, conferido depois de normalizar a URL) e só JPEG/PNG/WebP, com nosniff e CSP; cabeçalhos de proteção em todo o site (`next.config.ts`: nosniff, X-Frame-Options SAMEORIGIN, frame-ancestors, Referrer-Policy, Permissions-Policy; sem X-Powered-By); recibo por `mercurioRecId` só se constar em `ContributionMonthlyStatus` da própria pessoa (nenhum abuso encontrado no banco); `voltarSenhaInicial` não redefine quem dirige ou administra (só a administração nacional) nem o dono do sistema; `destinoSeguro` resolve a URL e é usado também no `/login` e no callback; nova tentativa de crédito Fortuna reserva antes de creditar e o vínculo de cliente Fortuna é único; uploads do contador com extensões e tamanho limitados e avatar conferido pelos bytes; pendência da Escolástica só com pessoa da filial. Onda 2: pool do pg com `max: 8`, espera de 10 s e `attachDatabasePool`; inscrição em evento trava a linha do evento (`SELECT … FOR UPDATE`) em vez de recusar pela revisão; espera de pagamento cresce (5 s → 10 s → 20 s) e `checkChargeStatus` consulta o Asaas no máximo a cada 15 s por cobrança; tempos-limite em Mercúrio (consulta), Mercury, Slack, Ulisses, CallMeBot, push e SDK da Anthropic. Onda 3: link do cartaz guardado por 40 min (`unstable_cache`); avisos da rotina notificacoes em lotes de 10; webhook do Asaas responde 200 quando a inscrição não confere (valor divergente avisa o suporte); matrícula pública com Cloudflare Turnstile opcional (`TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, inativo sem as chaves); violeta do painel de aberturas trocado pela cor da marca e título dos passos da tesouraria maior. Testes: `tests/seguranca-entradas.test.ts`. Pendente: relatório de exposição de dados (painel da Direção enviado a Eventos/Café/Escolástica, CPF em mensagens de erro do Asaas, `economicNotes` no Portal).
- 2026-11-01 (Claude) — **Exposição de dados corrigida** (pedido do usuário, "corrija tudo"): Eventos, Café e Escolástica recebem só os campos que usam (`src/lib/dados-por-area.ts`: `paraEventos`, `paraCafe`, `paraEscolastica`), não mais o painel inteiro da Direção; o Portal do membro não leva `economicNotes`, `authUserId`, `asaasCustomerId`, `pixAutomaticAuthorizationId`, `fortunaClientId`, CNPJ/caixa/carteira/filial Mercury da escola nem o Slack dos grupos (`member-data.ts`); erro do Asaas sem query string e só com as descrições, números longos e e-mails mascarados (`resumoDoErro` em `asaas/client.ts`); site de matrícula mostra só `MatriculaErro` e reaproveita cobrança em aberto só com o CPF inteiro igual (decifrado); log do Pix Automático com id em vez do nome; nomes e matrículas de membros retirados dos docs (o repositório é público).
- 2026-11-01 (Claude) — **Pendências do dono** (pedido do usuário: "anote nos registros, e me cobre periodicamente"): 1) tornar privado o repositório GitHub; 2) chaves do Cloudflare Turnstile na Vercel; 3) senha inicial por CPF, a resolver antes de abrir o Portal para mais filiais. Lembrete automático por WhatsApp (`src/lib/pendencias-dono.ts`, tarefa `pendenciasDoDono` da rotina saude, segundas e quintas às 9h de Brasília): cada item se confere sozinho (API pública do GitHub, variáveis de ambiente, número de filiais com Portal aberto > 2) e some quando resolvido. Agentes: lembrar o usuário no início das conversas enquanto houver pendência.
- 2026-11-01 (Claude) — **Revisão geral** (pedido do usuário: "dê uma geral no que ainda não funciona"). Código, tipos e 159 testes limpos. Feito: `.env.example` reescrito com todas as variáveis que o código lê (obrigatórias x opcionais x só de scripts); avisos de lint da tesouraria removidos; registros desatualizados corrigidos (subconta BGA, limpeza de FV). Documentos da subconta BGA: ata de eleição enviada pela API (`POST /myAccount/documents/{id}`, status PENDING); `IDENTIFICATION` e `IDENTIFICATION_SELFIE` o Asaas recusa por API ("não pode ser enviado via API"): a diretora envia pelo app. A subconta mostra a responsável como "presidente"; conferir no app se o nome bate com a CNH. Achado sem correção: tarefa `atualizar_contato` de 18/10 presa na fila com `falhou` porque o menu CADASTRO do Mercúrio, para a credencial usada, não tem a entrada própria de Goiânia Universitário (só "GOIÂNIA UNIVERSITARIO: BARRA DO GARÇAS" etc.); depende de João Guilherme (acesso da credencial), não de regex. Ainda sem canal: WhatsApp/Instagram (decisão), push (VAPID), e-mail (Resend). Login unificado sem teste de ponta a ponta.
- 2026-11-02 (Claude) — **Resumos do Mercúrio**: o limite de 20 s (01/11) valia também para as consultas; BSB/LGS/GYN levam 18–35 s e falharam a noite toda. Consulta agora com 90 s e rodada sem começar resumo novo depois de 150 s (`cf514b8`).
- 2026-11-02 (Claude) — **Senha inicial pelo CPF retirada** (usuário: "pode excluir senha pela inicial do cpf, sem medo"): `provisionarLogin` cria login com senha aleatória e não toca quem já tem login; saiu `voltarSenhaInicial` e o cartão "senhas esquecidas" da administração; item saiu do lembrete do dono (`db3dae0`). Troca das senhas já existentes por aleatórias (`scripts/_senhas-aleatorias.ts`, uso único, pula o dono) rodada pelo usuário: 751 trocadas, 1 pulada, 0 erros; script apagado. Na data, 735 de 756 logins nunca tinham entrado.
- 2026-11-02 (Claude) — **Ágora depois da atualização do Keycloak (Heitor)**: `scripts/testar-token-agora.mjs` com a conta do usuário: o Ágora aceita direto o token do `portal-aluno` (200 em `/usuarios/usuario-logado` e `/eventos/periodo`); a troca de token passou a existir no servidor, mas está desligada para o client ("Standard token exchange is not enabled for the requested client") e não é necessária. Com `offline_access` o refresh vale 30 dias (sem ele, 12 h, o que fazia o Ágora sumir da Agenda depois de um dia sem abrir o Portal). `KEYCLOAK_OFFLINE=1` posto na Vercel (produção) pelo usuário e publicado em 02/11/2026. Cada aluno ganha a sessão de 30 dias no próximo login unificado.
- 2026-11-02 (Claude) — **Todos os logins derrubados** (pedido do usuário: "derrube todos os logins, e exija que entrem novamente"): `DELETE FROM auth.sessions` (7 sessões de 2 pessoas; 0 refresh ativos depois). O Portal confere a sessão com `getUser()` no servidor de autenticação (`src/proxy.ts`, `lib/auth.ts`), então quem estava logado é mandado ao login na próxima página. Todos entram de novo pelo login unificado e já ganham a sessão offline do Ágora (30 dias).
- 2026-11-02 (Claude) — **Declarações da Escolástica** (pedido do usuário: declarações de matrícula, instrução, voluntariado "tudo buscando os dados do mercúrio"): aba **Declarações** (`/escolastica/declaracoes`, área escolastica, que inclui a direção). Escolhe a pessoa (ativos da filial com matrícula) e as seções — Matrícula (ingresso, reingresso, nível e data de entrada no 2º nível, turma com início, dia e horário, formatura), Instrução (`turmas_materias` + `sig_materias`, desde quando; `cad_cad_pedagogo` FOR = participa da formação de instrutores, INS = instrutor habilitado), Voluntariado (`dirigente_funcoes`, atuais e anteriores com período; `cad_situacao_fv` BRG/PRO e `cad_raio_fv` BF/BM/CS), Cursos (`cursos_integra_participa` + `sig_cursos_integra`) — e finalidade opcional. Assina quem é `unidades.uni_diretor`. Só matrícula ativa e da unidade da filial. Texto editável na folha; imprime/salva PDF pelo navegador (CSS de impressão só com a folha). Nada é guardado. Código: `lib/declaracoes/texto.ts` (frases, testado em `tests/declaracoes.test.ts`), `lib/declaracoes/dados.ts` (consultas), `actions/declaracao-actions.ts`, `components/escolastica/declaracoes.tsx`. Primeira declaração gerada para uma instrutora de BGA (PDF entregue ao usuário).
- 2026-11-02 (Claude) — **Declarações, ajustes do usuário**: Instrução sem matérias e sem nome das turmas que a pessoa ministra, só desde quando dá aula (início mais antigo em `turmas_materias`) e dias/horários (de `turmas`), mais a frase "Os dias e horários de aula podem variar de acordo com a necessidade da escola e dos alunos."; opção **Quem assina**: direção da unidade (Mercúrio) ou "Eu" (nome do Mercúrio de quem gera + cargo digitado).
- 2026-11-02 (Claude) — **Declarações: "desde quando dá aula" não vem mais do Mercúrio.** `turmas_materias.tma_inicio` é o início na turma atual (turmas encerradas somem do banco de consulta; não há histórico de instrução), e saía como se fosse o começo como instrutor. Agora é o campo opcional "Dá aula desde" preenchido por quem gera; sem ele, a frase fica sem data.
- 2026-11-02 (Claude) — **Declarações: campo "Na formação de instrutores desde"** (opcional, ao lado de "Dá aula desde"): o Mercúrio não guarda o início na formação; com a data, a frase vira "Participa do curso de formação de instrutores da Nova Acrópole desde DD/MM/AAAA." As datas não são guardadas (sem migração).
- 2026-11-02 (Claude) — **Conferência logada em produção** (autorizada pelo usuário; sessão aberta por link gerado no servidor e encerrada no fim, sem tocar senha; diário só conferido por erro, sem captura): /portal, /escolastica (pendências e membros), /voluntario/eventos, /voluntario/cafe, /economia, /admin e os diários abrem sem erro. Achados: (1) `/escolastica/declaracoes` dava 404 porque as publicações do Portal ficaram na fila atrás das do projeto semperia (plano gratuito, uma publicação por vez, ~13 min cada); (2) erro de hidratação no diário de FV: `proximaReuniao` importada do Firebase sem fuso ("2025-06-16T08:30") era lida em UTC no servidor e em Brasília no navegador. Corrigido com `instanteNoFuso` (`lib/fuso-escola.ts`), usado em `fv/dados.ts`; reproduzido e conferido com `next dev` em TZ=UTC.
- 2026-11-02 (Claude) — **Declarações com a sede da escola**: o usuário confirmou que o endereço de BGA no Mercúrio (Rua Simião Arraya, 305) é o correto, e não o do edital da assembleia de 15/01/2026 (Rua Araguaia, 83). A declaração agora traz ", com sede na <logradouro>, <bairro>, <cidade>/<UF>, CEP <cep>" depois do CNPJ, lido de `unidades.uni_logradouro/uni_bairro/uni_cep`; sem logradouro no Mercúrio, a frase sai sem sede.
- 2026-11-04 (Claude) — **Swagger completo do Ágora** (Marcos, 04/11: "a parte interna pode ser modificada sem se preocupar com a compatibilidade"). Lido com o token do `portal-aluno` em `/v3/api-docs` (112 rotas, só leitura + buscas POST; nenhuma rota de inscrição/pagamento para escrever). Estável: `/api/v1/pub/{sedes,eventos(sedeId,ini,fim),inscricoes(eventoId),atividades,categorias-pagamento}` (Bearer). Interna, pode mudar: `/api/eventos/acoes` e `/periodo` (já usadas), `/eventos/inscricoes/minha?somentePendPag=`, `/pagamentos/pix/imagem`, `/pagamentos/boleto/linha-digitavel`. **Login do "Inscrever-se" já é SSO**: a rota `#/e/:slug` tem guarda; sem sessão vai a `#/auth/login?nextRoute=…`, que em 1 s chama `/api/sso-url` e redireciona ao Keycloak, voltando ao evento. Só pede senha quando a sessão do Keycloak no navegador venceu (~12 h, o mesmo prazo do refresh sem `offline_access`); quem resolve é o Heitor (sessão SSO mais longa ou "lembrar de mim"), não o Ágora.

## 04/11/2026 — Plano: espelhar o Mercúrio novo (Mercury) no antigo (só planejamento)

- Pedido do usuário: BGA passa a usar o Mercury a partir de sexta (06/11/2026). Enquanto as outras escolas não migram,
  tudo o que for lançado no novo precisa ir para o antigo, para os dirigentes continuarem vendo os dados. O novo é sempre
  a fonte da verdade. **Só planejar, sem implementar.**
- Plano completo em [docs/PLANO-ESPELHO-MERCURY-MERCURIO.md](PLANO-ESPELHO-MERCURY-MERCURIO.md): ler o novo pela API,
  ler o antigo pelo oinabview, comparar por matrícula, gravar com o robô pela fila `MercurioSyncTask`. Fases: relatório
  → grava o que o robô já sabe, com aprovação → mapear telas novas → automático.
- Base de produção do Mercury (Gabriel, 04/11/2026): `https://mercury-api.newacropolis-usa.org/external/v1`. A
  `MERCURY_API_KEY` atual dá 401 nela (é da base de teste): falta a chave de produção.
- Risco a decidir antes de sexta: a fila atual lança pagamentos do Asaas direto no antigo. Com o espelho ligado, BGA
  lançaria em dobro.

## 04/11/2026 — Espelho Mercury → Mercúrio antigo: código pronto, EM ESPERA

- Pedido do usuário: "pode fazer todo o código, e deixar em stand by até a migração do mercúrio ser concluída", e que
  fique registrado tudo o que precisa ser feito no antigo, para fazer à mão se o robô não puder.
- Código em `src/lib/espelho-mercury/` (ler-novo, ler-antigo, comparar [pura], manual, rodar, aplicar), tela
  `/espelho-mercurio`, ações em `src/lib/actions/espelho-mercury-actions.ts`, rotina `/api/cron/espelho-mercury`
  (noturna, já no vercel.json) e gravação aprovada dentro de `/api/cron/fila-mercurio`. 17 testes em
  `tests/espelho-mercury.test.ts`; tsc, eslint e `next build` limpos.
- **Em espera por três travas:** `ESPELHO_MERCURY_LIGADO` não definido (tudo retorna antes de tocar no banco); migração
  `20261104200000_espelho_mercury` **não aplicada**; nenhuma linha em `EspelhoMercuryConfig`. Configuração em tabela
  própria (não colunas em `School`) para o deploy não quebrar consultas de escola antes da migração.
- `src/lib/mercury/client.ts`: base da API agora vem de `MERCURY_API_URL` (sem ela, a de teste de sempre). Produção:
  `https://mercury-api.newacropolis-usa.org/external/v1`, ainda sem chave.
- Passo a passo manual de cada tipo de diferença: `docs/ESPELHO-MERCURIO-PROCEDIMENTOS.md`, gerado de
  `src/lib/espelho-mercury/manual.ts` (manter os dois iguais). Telas que o robô ainda não percorreu estão marcadas
  "A CONFIRMAR".
- Como ligar (9 passos, inclusive `School.sistemaRegistro = "mercury"` para BGA, que impede lançamento em dobro):
  `docs/PLANO-ESPELHO-MERCURY-MERCURIO.md`.

## 06/11/2026 — Quem é FV vê só o diário de FV

- Pedido do usuário: "se o usuário for FV, não mostrar o diário de aluno, só o diário de FV".
- `temDiario` (src/lib/diario-dados.ts) devolve falso para quem é FV (`ehFV`: está em algum grupo de tipo FV). Isso
  esconde `/diario`, o histórico, o quadro do GAF, o atalho "Meu diário" no diário de FV e bloqueia a gravação. Quem
  abre `/diario` sendo FV vai para `/diario/fv`. O que já estava escrito no diário de aluno fica guardado.
- `member-data.ts`: `temDiario` do Portal também exige não ser FV. `avisosDoDiario` (notificacoes-agendadas.ts) não
  manda Prólogo/Epílogo para FV.

## 06/11/2026 — Mapa do Mercúrio e saúde do código

- Pedido do usuário: verificar melhorias do código e mapear o Mercúrio para ver o que mais mostrar ao aluno e ao
  voluntário. Resultado em `docs/OPORTUNIDADES-MERCURIO-2026-11-06.md` (só leitura no oinabview; nada implementado além
  do item abaixo).
- `package.json`: novo `npm test` (`node --experimental-test-module-mocks --import tsx --test`). Sem a opção, 11
  arquivos `.mjs` falhavam por `mock.module is not a function`. Com ela, 180 testes passam.

## 06/11/2026 — Do mapa do Mercúrio: canais de entrada, alertas, turma, tempo de casa, declaração pedida pelo aluno, trajetória e aniversários

Pedido do usuário, depois de `docs/OPORTUNIDADES-MERCURIO-2026-11-06.md`. Nenhuma migração: os dados novos do Mercúrio
entram no resumo diário da filial (`ResumoFilial.dados`, JSON), e a entrega das declarações fica em `ResumoNacional`.

- **De onde vêm os alunos** (`resumo-filial.ts` → `canais`, função pura `calcularCanais`): entradas dos últimos 36 meses
  por `cad_midia_ingresso` (`sig_minscr`), ativos e quantos ficaram 3, 6 e 12 meses (só conta na base quem já teve o
  tempo). Tela: `components/relatorios/canais-entrada.tsx`, no relatório da direção (`relatorio-tab.tsx`) e na aba
  Investimentos das aberturas de turma (`crm-investimentos.tsx`, `aberturas-data.ts` → `canais`).
- **Alertas de cadastro** (`resumo-filial.ts` → `alertas`): turma com previsão de conclusão vencida, ativo de N1+ sem
  turma, entrada dos últimos 12 meses sem canal. Tela: `components/escolastica/alertas-cadastro.tsx`, no topo das
  pendências da Escolástica.
- **Turma do aluno**: `resumo-filial.ts` agora guarda `sala`; `lib/turma-aluno.ts` dá sala e previsão de **conclusão**
  (pedido: "não use formatura, mas conclusão"; previsão vencida não aparece). Mostrado em "Minha jornada"
  (`jornada-panel.tsx`). No relatório da direção, "Formatura prevista" virou "Conclusão prevista".
- **Tempo de casa**: "Na Nova Acrópole há X anos e Y meses" no topo de "Minha jornada"; conquistas `casa_2` até
  `casa_40` (`badges.ts`, `ANOS_DE_CASA`), na linha do tempo com a data real; destaque no topo do Portal no dia.
- **Declaração pedida pelo aluno** (`lib/declaracoes/pedidos.ts`): em "Meu cadastro" (`components/member/minhas-declaracoes.tsx`)
  o aluno pede, com finalidade opcional; vira `ScholasticPendency` tipo `pedido_declaracao` e avisa a Escolástica no
  celular (`avisosDePedidosNovos`). Na pendência, "Gerar declaração" abre `/escolastica/declaracoes?pedido=<id>` com a
  pessoa e a finalidade; a secretaria confere e escolhe "Entregar pelo Portal" (guarda o texto da folha, inclusive o que
  foi editado, em `ResumoNacional` "declaracao:<id>") ou "Imprimi e assinei: avisar para retirar". O aluno é avisado e
  abre `/portal/declaracao/<id>` para imprimir. Um pedido aberto por vez.
- **Minha trajetória** (`lib/trajetoria.ts`, `/voluntario/trajetoria`, atalho no menu da Área do Voluntário): marcos,
  funções (`dirigente_funcoes`, alcance da filial ou nacional, conselho), distinções (`dirigente_condecoracoes` e
  `condecoracoes`: Machado, Tocha, Ordem ao Mérito, Caduceu de Ouro, Brigadista do Ano) e aulas que ministra. Lido
  na hora, só da própria matrícula.
- **Aniversários** (`lib/aniversarios.ts`, dentro de `/api/cron/notificacoes`): às 8h no fuso da filial, parabéns ao
  aniversariante em nome da Nova Acrópole; um aviso por pessoa aos colegas e professores das turmas dele; aviso de
  aniversário de casa. Usa `Member.birthDate` e `dataEntradaEscola` (do Mercúrio). Quem nasceu em 29/02 recebe em
  28/02 nos anos não bissextos. Cada aviso é reservado em `PushEnviado`. Destaque no topo do Portal no dia.
- Espelho Mercury: o `cadastro` do oinabview traz ativos e inativos (53 mil linhas no país); comentário de
  `ler-antigo.ts` e texto de "aluno novo" corrigidos.
- Testes: `tests/aniversarios-canais.test.ts`; `npm test` com 186 passando. Consultas novas conferidas só leitura em
  BGA.

## 06/11/2026 — Rio Verde: Portal liberado para Fernando Vieira Paixão

Pedido do usuário ("libere o portal para o fernando paixão de rio verde usar também"). Gravado em produção por script
de uso único (apagado): `garantirEscola("RVD")` criou "Nova Acrópole - Rio Verde" com `portalAberto=false`;
`importarMembro("2597")` trouxe só ele (ativo, N3); `provisionarLogin` criou o login (senha aleatória, sem e-mail
enviado). Ele entra pelo login unificado da Acrópole com o e-mail do Mercúrio. Atenção: o primeiro acesso por e-mail
(`primeiro-acesso.ts`) só confere se a unidade tem escola no Portal, não `portalAberto`; com a escola criada, outro
ativo de RVD que entrar pelo login unificado também é importado.

## 06/11/2026 — Direção liberada pelo dono do sistema

Pedido do usuário: "libere função de diretor" para Fernando Vieira Paixão (2597, RVD), Heitor de Lima Matos (3450, JAM),
Carlos Rangel Neves Otto (3006, FOR), Ana Beatriz Camara Silva Gama Pignataro (3097, BSB) e Luis Carlos Marques Fonseca
(101, BSB). `isDiretor` é recalculado do Mercúrio a cada sincronização, então a liberação é uma lista em
`lib/dono-do-sistema.ts` (`temDirecaoLiberada`, variável `DIRECAO_LIBERADA` para trocar sem deploy), somada em
`mercurio-db/importar.ts` (grava `isDiretor` na próxima rodada) e em `getAuthenticatedMember` (vale já no login, como o
dono do sistema). Cada um é diretor da **própria** filial. Para valer também nas consultas que leem o banco direto antes
da próxima sincronização, o usuário roda `UPDATE "Member" SET "isDiretor"=true, "liberaTestadores"=true WHERE
"mercurioId" IN ('2597','3450','3006','3097','101');` (a escrita direta foi barrada para o agente).

## 06/11/2026 — Checagem automática (GitHub Actions) e conferências

- `.github/workflows/checagem.yml`: a cada envio para `master` (e em PR) roda `next typegen` + `tsc --noEmit`,
  `eslint --quiet` (só erros; hoje há 189 avisos e 0 erros) e `npm test`. Sem banco nem segredos (URLs de mentira só
  para o `prisma generate`). Não bloqueia a Vercel: um X vermelho no GitHub avisa que subiu algo quebrado. Primeira
  rodada verde em 06/11.
- Conferido (só leitura): `portalAberto` está desatualizado como sinal (GYN, com 310 membros, e BGA estão `false` e em
  uso); não usar como barreira de acesso sem antes acertar o valor de cada filial.
- Resumos da filial sem erro desde 02/11; Rio Verde já gerado com `canais` (código de 06/11); as outras filiais pegam os
  dados novos na próxima geração (~20 h).

## 06/11/2026 — Resumo semanal da direção, aluno sumindo, correção dos alertas, lembrete da aula e comprovante anual

Pedido do usuário ("ok, faça tudo"). Sem migração.

- **Resumo da semana para a direção** (`lib/avisos-direcao.ts` → `resumoSemanalDaDirecao`): segunda, 8h da filial, push
  para diretor, sub-chefe e direção liberada (`matriculasComDirecaoLiberada`). Entradas e saídas dos últimos 7 dias
  (Mercúrio, ao vivo), pessoas com contribuição em atraso (resumo da filial) e pendências da Escolástica (abertas e
  vencidas). Abre `/diretor`. Só filiais com `sistemaRegistro = "mercurio"`.
- **Aluno sumindo** (`avisosDeAlunosSumindo`): segunda, 9h da filial. O Mercúrio não tem faltas; o sinal é a
  contribuição: ativo que tem recibo nos últimos 12 meses e nenhum há 60 dias (recibos são view ao vivo; `fichas` pode
  estar atrasada). Entradas recentes e quem não teve recibo no ano ficam de fora. Vira `ScholasticPendency` tipo
  `aluno_sumindo` ("Fazer contato: ...", prazo 7 dias, matrícula nas notas), no máximo 15 por semana, sem repetir a
  mesma matrícula em 90 dias; push para quem tem a área Escolástica. BGA em 06/11: 1 de 31.
- **Corrigir alertas de cadastro** (`components/escolastica/alertas-cadastro.tsx`, `botao-ja-corrigi.tsx`,
  `lib/alertas/corrigidos.ts`, `actions/alertas-cadastro-actions.ts`): "Como corrigir no Mercúrio" com o passo a passo
  de cada tipo, botão para copiar a matrícula e "Já corrigi", que esconde o item até o próximo resumo (se a correção não
  pegou, volta). Guardado em `ResumoNacional` "alertas-corrigidos:<schoolId>". Os nomes exatos das telas do Mercúrio
  não foram percorridos pelo robô; o texto descreve o caminho sem nomes de botão.
- **Lembrete da aula** (`lib/lembrete-aula.ts`): dia, horário e sala da tabela `turmas` (resumo da filial); 3 h antes da
  aula, nunca antes das 7h, para alunos e professores da turma com notificação ativa. Um por pessoa, turma e dia.
  `salaLegivel` foi para `lib/sala-legivel.ts` (sem `server-only`, para testes).
- **Comprovante anual de contribuições** (`lib/comprovante-anual.ts`, `/portal/comprovante/[ano]`): recibos emitidos em
  nome da pessoa no ano, ao vivo do Mercúrio, sem cancelados, com total; nome e CNPJ da filial; imprimir ou salvar em
  PDF. Link no quadro "Suas contribuições" (filiais brasileiras no Mercúrio). Só a própria pessoa; ano atual e até 5
  anteriores.
- As três tarefas novas estão em `/api/cron/notificacoes` (`aulas`, `semanaDirecao`, `alunosSumindo`).
- Testes: `tests/avisos-semanais.test.ts`; `npm test` 193 passando; `next build` ok. Conferido só leitura em BGA.

## 07/11/2026 — Filiais abertas e liberação individual do Portal

Decisão do usuário: **abertas BOA, GYN, BGA, BSB, RVD, LGS e JAM**; as demais (hoje GAR e STO) fechadas.

- `School.portalAberto` volta a valer: `mercurio-db/primeiro-acesso.ts` (`podeEntrarNaFilial`, testes em
  `tests/primeiro-acesso.test.ts`). Filial aberta: qualquer ativo faz o primeiro acesso pelo login unificado. Fechada:
  só dirigentes (`cad_dirigente = 'S'`), direção liberada pelo dono (`DIRECAO_LIBERADA`), o dono e quem a direção liberou
  (`TestadorLiberado`, tabela de 18/10 que estava sem uso). Quem já está no Portal não é afetado.
- Tela da direção (`components/admin/liberar-portal.tsx`, `actions/portal-liberacao-actions.ts`), em Administração →
  Recursos, só em filial fechada: busca ativo da filial no Mercúrio por nome ou matrícula, libera e retira.
- Ordem obrigatória: **primeiro** acertar os sinais no banco (a escrita foi barrada para o agente; o usuário roda), **só
  depois** publicar o código, senão filiais em uso marcadas `false` (GYN, BGA) param de aceitar primeiro acesso:
  `UPDATE "School" SET "portalAberto" = ("mercurioUnidade" IN ('BOA','GYN','BGA','BSB','RVD','LGS','JAM'));`

## 07/11/2026 — Carteirinha, indicar um amigo, voluntariado da semana, agenda das salas e recepção do interessado novo

Pedido do usuário (sim para 4, 6, 7, 9 e 10 da lista de ideias; não para presença por QR, aula cancelada e "perdi a
aula"). Sem migração.

- **Carteirinha digital** (`/portal/carteirinha`, `lib/carteirinha.ts`): foto, nome, matrícula, filial, nível e situação
  de agora; QR `NAC1.<matrícula>.<HMAC>` (segredo `CARTEIRINHA_SEGREDO`, ou derivado do `CRON_SECRET`). Botão
  "Carteirinha" no cartão de boas-vindas e na busca. **Recepção dos eventos** (`/eventos/[id]/recepcao`): "Ler
  carteirinha" abre a câmera (`components/member/leitor-carteirinha.tsx`, biblioteca `jsqr` 1.4.0) e marca a presença
  por `actions/carteirinha-actions.ts` → `marcarPresencaEvento` (mesmas travas). Evento do Ulisses: mostra o nome e
  pede para marcar na lista. `next.config.ts`: `Permissions-Policy` passou a `camera=(self)` (antes bloqueava a câmera).
- **Indicar um amigo** (`/portal/indicar`, quadro na página inicial e na busca): link pessoal `/convite/<matrícula>.<HMAC>`
  (página pública, `app/convite/[codigo]`) com o primeiro nome de quem convidou e as próximas aberturas planejadas ou em
  curso (`lib/convite.ts`); "Quero me matricular" leva a `/matricula/<token>?indicacao=<código>`, e `criarMatricula`
  grava em `comoConheceu` "Indicação de <nome> (matrícula X)". O aluno vê quantos já se matricularam pelo convite.
- **Voluntariado da semana** (`lib/avisos-voluntariado.ts`, sobre as Oportunidades): segunda, 10h da filial, push com as
  tarefas pontuais dos próximos 7 dias com vaga, para quem pode ver oportunidades e ainda não se ofereceu; véspera, 18h,
  lembrete para quem foi aceito. Textos em `oportunidades-comum.ts`.
- **Agenda das salas** (`/voluntario/salas`, menu "Agenda das salas", mesmo acesso do calendário; `lib/agenda-salas.ts`):
  `ItemCalendario` ganhou `sala` (turma do Mercúrio, abertura, local do evento, local ou "Online" do grupo); agrupa por
  sala normalizada (Sala Platão = PLATAO) e aponta choques de horário. Semana a semana.
- **Recepção do interessado novo** (`lib/aberturas/recepcao-interessados.ts`): o CRM não informa data de inscrição;
  novo = lead que não estava na cópia anterior (`AberturaCrmCache`). Depois de cada sincronização, push aos professores
  da abertura escolhida e a quem tem a área Escolástica, com os nomes; no dia da primeira aula, 8h, quem são os
  interessados esperados. A rotina `/api/cron/aberturas` passou a sincronizar também filiais com abertura em
  **rascunho** (antes as cópias estavam paradas desde 23-25/10 porque a única abertura, de BGA, está em rascunho).
  Mensagem ao próprio interessado depende de modelo de WhatsApp aprovado pela Meta: não feito.
- Testes: `tests/carteirinha-convite-salas.test.ts`; `npm test` 202; `next build` ok.

## 09/11/2026 — Sede Central (BSB) aberta para todos os ativos; Mercury conferido

- Pedido do usuário ("libere a sede central para funcionar, e todos os ativos"). `scripts/abrir-filial-db.ts BSB --gravar`:
  448 ativos importados, 428 logins criados (senha aleatória, sem e-mail enviado), 2 já tinham login; 6 sem e-mail no
  Mercúrio e 12 com e-mail já usado por outra conta (ficam para a secretaria). `portalAberto` já estava `true` (07/11).
- O script passou a importar em lotes de 50: a lista inteira de recibos numa consulta só falhou no banco de consulta.
- BSB ainda sem WhatsApp da secretaria (`School.whatsapp`), sem subconta Asaas e com `mercurioEscrita = false`: o
  Portal funciona em modo consulta para contribuição (sem pagamento pelo Portal).
- Mercury medido de novo em 09/11: base de teste parada em 28/09, produção 401 com a chave atual.

## 09/11/2026 — Função ativa no Mercúrio libera a Área do Voluntário e a área correspondente

Pedido do usuário ("achei que isso já estava implementado"; "exato"). Antes só chefe, sub-chefe e quem a direção
liberou à mão entravam; com isso, 77 de 81 pessoas com função em BSB (74 de 78 em GYN) estavam sem acesso.

- `acesso-voluntario.ts`: `temAcessoVoluntario` e `comAcessoVoluntario` aceitam `Member.cargos` não vazio (funções
  atuais do Mercúrio). Na tela "Liberar acessos", essas pessoas aparecem com "Pela função" no lugar do botão.
  Também contam em `oportunidades.ts` (responsáveis possíveis) e `panorama.ts`.
- `areas-filial.ts`: a função, na própria filial, dá a área pelas mesmas palavras dos nomes de secretaria:
  Escolástica, Economia/Tesouraria, Eventos, Café. Conferido: só funções do próprio café da filial e das secretarias
  casam. Com dados reais: BSB 81 com acesso, GYN 79, LGS 24, BOA 12, BGA 6. Jakeline Borges de Souza (BSB,
  Coordenadora de Eventos): Área do Voluntário e área de Eventos.
- Os grupos (Feminino, Masculino, Segurança) continuam restritos a quem participa deles.
- Fortuna (09/11): `FORTUNA_API_URL` e `FORTUNA_API_KEY` no `.env`; a API de integração responde no domínio
  `oinabnfortunaback.acropolebrasil.com.br/api/integration/v1`, mas recusa a chave ("Credencial inválida", 401):
  pendente com a equipe do Fortuna.

## 09/11/2026 — Aviso das contas a pagar; pesquisa de instrutores para quem tem a área de Escolástica

- Contas a pagar já existiam (Economia → aba Contas, `Payable`, `repasse-actions.ts`). Novo: `lib/avisos-contas.ts` na
  rotina de avisos: às 8h da filial, push para quem tem a área de Economia com as contas em aberto que vencem hoje e
  amanhã (previsões marcadas como "prevista"). Vencimento comparado pela data AAAA-MM-DD (gravado à meia-noite UTC).
- `avaliacao.ts`: quem tem a área de Escolástica (responsável pela secretaria no Portal ou função no Mercúrio) também
  gere a pesquisa de instrutores. Jakeline (BSB): criação da secretaria "Escolástica" com ela e a Enila como
  responsáveis barrada para o agente; SQL entregue ao usuário.
- Saque e pagamento automático pelo Asaas: proposta em discussão com o usuário (precisa de migração e de decisões).

## 09/11/2026 — Liberar acessos: dar ou tirar áreas de trabalho por pessoa

Pedido do usuário (não conseguia mexer no acesso da Jakeline: a linha mostrava só "Pela função"). Em Administração →
Liberar acessos, cada pessoa tem agora "Áreas: Escolástica · Economia · Eventos · Café" para quem chefia a filial dela
(chefe, sub-chefe, administração nacional, dono). Ligar = vira responsável pela secretaria da área no Portal (criada se
não existe, `acesso-voluntario-actions.ts` → `definirAreaDeTrabalho`); desligar = sai da responsabilidade. Área que vem
da função no Mercúrio aparece fixa ("· função"). `areas-filial.ts` exporta `areasDoNome` e `AREAS_POR_SECRETARIA`;
`acesso-voluntario.ts` exporta `escolasQueLibera` e devolve `areas` em `candidatosParaLiberar`.

## 09/11/2026 — Secretarias criadas sozinhas pelas funções do Mercúrio; áreas da direção na tela de acessos

Pedido do usuário ("ao liberar o acesso, verifique qual é a área do voluntário e crie na escola"; ex.: Licínio, GYN,
"Secretário de Técnicas e Manutenção" → secretaria Técnica e Manutenção com ele como responsável).
- `lib/secretarias-sync.ts` (`sincronizarSecretariasDaFilial`), chamado no fechamento diário de cada filial
  (`mercurio-db/rotina-diaria.ts`): lê `dirigente_funcoes` da unidade, usa o mesmo sugeridor da tela de Secretarias
  (`sugerirSecretarias`) e cria as secretarias que faltam, com responsáveis (role professor) e equipe (aluno). Só nomes
  do catálogo (`NOMES_DO_CATALOGO` em `secretarias.ts`); nomes de texto livre ("Cgb", "Traducao") ficam como sugestão
  na tela. Só acrescenta; secretaria arquivada pela direção não volta. Simulação em 09/11: LGS 12, GYN 17 novas,
  BSB 25, BOA 6, BGA 1, RVD 1 (antes do filtro do catálogo).
- Grupos Feminino, Masculino e de Segurança já vinham do cadastro (`cad_raio_fv`, importar.ts): o Ramon (GYN) já era
  responsável pelo Grupo Masculino.
- Tela Liberar acessos: sub-chefe aparece com as 4 áreas acesas "· direção" (`areas.porDirecao`).
- Robô do Mercúrio: login recusado ("Identificação Inválida") em 09/11; senha a atualizar no cofre da ferramenta de
  raspagem (`ler_credencial_scraper`, GLOBAL). Mapeamento das permissões do painel do Diretor aguardando isso.

## 09/11/2026 — Robô do Mercúrio com senha no ambiente; tela de Autorização mapeada

- Senha do robô: `MERCURIO_ROBO_MATRICULA`/`MERCURIO_ROBO_SENHA` no `.env` e na Vercel (Production, Sensitive),
  lidas antes do cofre (`scraper-credentials.ts`). Login conferido.
- Tela DIRETOR → Autorização mapeada (só leitura): `docs/MERCURIO-AUTORIZACAO.md`. Próximo passo, a decidir com o
  usuário: ler as autorizações todo dia, refletir no Portal, e dar ou tirar no Mercúrio pelo robô.
- 09/11 (ajuste do usuário): Patrimônio = inventário, secretaria própria "Patrimônio" (`secretarias.ts`, saiu de
  Economia); Recepção do Mercúrio → secretaria "Recepção e Portaria" (vai além dos eventos); Relatório Mensal mantém
  o nome e a função própria. `docs/MERCURIO-AUTORIZACAO.md` atualizado.

## 09/11/2026 — Fortuna pela API de integração; extrato do Café

- `lib/fortuna/client.ts`: mesmas funções (`fortunaGetClient`, `fortunaGetBranches`, `fortunaSearchClientsByName`,
  `fortunaCreditarSaldo`), agora pela API de integração (`FORTUNA_API_KEY`, `FORTUNA_API_URL`, no `.env` e na Vercel).
  Leituras caem no login antigo de gerente se a integração falhar; crédito só usa o login antigo se a integração não
  estiver configurada (não contorna filial não autorizada nem repete crédito de resultado incerto). Crédito leva
  `Idempotency-Key` por pagamento (`recarga-<id>`, `contribuicao-<id>`): a "nova tentativa" do painel do Café não
  credita em dobro. Sem nova tentativa automática até a ponte repassar o cabeçalho.
- Novas `fortunaExtrato` e `fortunaConsumo`; página `/portal/fortuna` (Extrato do Café: consumo e créditos de 30/90/180
  dias), link "Ver consumo e extrato" no cartão do Fortuna. Conferido com dados reais (só leitura).
- Ponte da Cloudflare (`infra/ponte-cloudflare/src/index.ts`): passa a repassar `idempotency-key` e devolver
  `retry-after`. **Falta publicar** (`cd infra/ponte-cloudflare && npx wrangler deploy`; barrado para o agente).
- Fortuna: Barra do Garças apareceu como filial 35 em 09/11. Crédito pela integração depende de o Fortuna autorizar
  a filial (permissão `credits:write` por filial, do lado deles). A integração não cria filial.
- 09/11: recarga do Café em BGA falhava com o erro genérico: o Asaas recusa Pix na subconta de BGA ("sua conta precisa
  estar aprovada"). `createFortunaTopUpCharge` devolve agora um aviso claro (conta de recebimento em aprovação).
  Fortuna: dos 30 ativos de BGA no Portal, 6 ligados; os outros 24 não existem no Fortuna (busca por CPF, só
  leitura). A API de integração não cria cliente: o cadastro é do lado do Fortuna; a carteira da filial abre sozinha
  no primeiro crédito.
- 09/11: ponte da Cloudflare publicada pelo usuário (versão 3a56c780): repassa `idempotency-key` e devolve
  `retry-after`. Conferido: Fortuna (integração e `/api/branch`) e Ulisses respondem pela ponte. Crédito do Fortuna
  voltou a repetir uma vez, com a mesma chave, em timeout ou erro 500.

## 09/11/2026 — Eventos do Portal no Google Agenda (assinatura por link)

Pedido do usuário ("caminho 1"). `/api/agenda/<memberId>.<HMAC>.ics` (`lib/agenda-ics.ts`, rota pública só com link
assinado): inscritos = CONFIRMED; publicados para a pessoa e sem inscrição = TENTATIVE com "A confirmar:" no título,
link de inscrição na descrição e sem ocupar a agenda; inscrito em evento cancelado = CANCELLED. Janela: 30 dias atrás
a 6 meses à frente. Página `/portal/agenda-google` (botões Google Agenda e webcal para iPhone/Mac/Outlook, avisos),
atalho "Levar para o Google Agenda" no painel da Agenda e na busca. `camposPublico` e `eventosQueAPessoaVe` foram de
`notificacoes-agendadas.ts` para `event-policy.ts`. Limite: o Google atualiza agendas assinadas no ritmo dele (8 a 24
h); confirmação de presença continua no Portal. Caminho 2 (gravar direto pela API do Google, com verificação do app)
fica para depois. Conferido com a agenda real do dono: 3 eventos (1 confirmado, 1 a confirmar, 1 cancelado).

## 09/11/2026 — Merlin e Janos: voluntários marcados e certidão negativa criminal

Pedido do usuário após mensagem da Karla Lacombe (ECA: certidão negativa criminal dos colaboradores do Merlin e do
Janos, renovada a cada 6 meses). Tabela `VoluntarioInfantojuvenil` (migração `20261109210000_voluntario_infantojuvenil`,
RLS ligada, sem FK; uma linha por pessoa e programa, com data, validade, tribunal, observação e histórico das
verificações). Regras puras em `lib/infantojuvenil-comum.ts` (testes em `tests/infantojuvenil.test.ts`), servidor em
`lib/infantojuvenil.ts`, ações em `lib/actions/infantojuvenil-actions.ts` (cada uma reconfere o acesso), tela
`/voluntario/merlin-janos` e item "Merlin e Janos" em Gestão da filial com o número de pendências. Marcação discreta:
não aparece em perfil, carteirinha nem listas públicas. Acesso: Chefe/Sub-Chefe (os dois programas da filial);
secretário, pró ou sub-secretário do programa pela função do Mercúrio (aquele programa na própria filial; colaborador e
monitor não); função nacional do programa ou mandato de secretaria que cite Merlin, Janos ou infantojuvenis (no
território do mandato); administração nacional (tudo). Validade = data + 6 meses (fim de mês ajustado); "vencendo" =
até 30 dias. Guarda só datas e tribunal, nunca o documento. Sugestões vêm das funções do Mercúrio (9 pessoas hoje).
Pendente: a função que o João criou no Mercúrio não aparece na oinabview; quando aparecer, sincronizar.

## 10/11/2026 — Caixa de sugestões por categoria

Pedido do usuário após o relato de um aluno de BGA (não conseguia alterar o cadastro no computador, só no celular).
Tabela `SugestaoPortal` (migração `20261110120000_sugestao_portal`, RLS ligada, sem FK). Regras puras em
`lib/sugestoes-comum.ts` (testes em `tests/sugestoes.test.ts`), servidor em `lib/sugestoes.ts`, ações em
`lib/actions/sugestoes-actions.ts`. Aluno: `/portal/sugestoes` (atalho "Sugestões" no Portal, item na busca, link
"Algo não funciona no Portal?" na Ajuda com `?categoria=portal_problema`), com "Minhas sugestões" e as respostas.
Categorias: "Algo não funciona no Portal" e "Ideia para o Portal" vão para a administração nacional; Aulas, Eventos,
Atendimento, Espaço e Outro, para Chefe/Sub-Chefe da filial (`escolasQueLibera`). Opção "sem mostrar meu nome": quem
lê não recebe nome nem matrícula; o autor fica guardado só para acompanhar a resposta e para o limite de 5 por dia.
Aparelho, sistema, navegador, largura da tela e app instalado vão junto (user-agent lido no servidor). Leitura em
`/voluntario/sugestoes` (Gestão da filial, número de novas): filtros por situação, categoria e filial; responder
(aviso push para quem enviou), marcar em análise, arquivar, reabrir.
Relato do cadastro: o painel Editar Dados foi testado num Chromium em tela de 1440px com dados fictícios e todos os
campos aceitaram digitação; não reproduzido. Falta saber navegador e campo exatos do aluno.

## 10/11/2026 — Avaliação dos instrutores: planilha, resultados do instrutor, data de encerramento e painel de análise

- Planilha da rodada (`/escolastica/avaliacao/[id]/planilha`, `lib/avaliacao-planilha.ts`): CSV para Excel (BOM, `;`),
  uma linha por resposta, sem data; só quem gere a avaliação.
- "Minhas avaliações" (`/professor/avaliacao`): o instrutor vê o resumo sobre ele, somando as turmas, só em rodada
  encerrada e com 3+ respostas, sem respostas individuais. Atalho no menu só quando há rodada encerrada com resultado.
- Data de encerramento (migração `20261110160000_avaliacao_encerra_em`, coluna `AvaliacaoCampanha.encerraEm`): definida
  ao abrir e alterável enquanto aberta ("Mudar data de encerramento"); a rodada se encerra sozinha no fim do dia
  (Brasília) por `encerrarVencidas()`, chamada no Portal do aluno, na resposta, no painel da Escolástica e nos resultados
  do instrutor. Reabrir uma rodada vencida tira a data.
- Painel de análise (`lib/avaliacao-analise.ts`, testes em `tests/avaliacao-analise.test.ts`): números de cabeça, NPS,
  recomendação cruzada com cada pergunta de escolha, e achados que separam assunto da turma (todos os instrutores
  abaixo) de assunto do instrutor (abaixo em todas as turmas), diferença entre turmas, opiniões divididas, notas baixas.
  Instrutor vê só os achados dele comparados à média da escola. Botão "Sugestões da IA" (`actions/avaliacao-ia-actions.ts`,
  Claude Sonnet 5.5): temas dos comentários, pontos fortes, sugestões e, para a direção, como conduzir a orientação;
  gerado a pedido, não guardado; nunca cita comentário literal.
- Agenda: evento de dia inteiro (Ágora) passa a valer pela data, não pelo fuso; nas filiais a oeste de Brasília (MT, AM,
  RR, RO, AC) o toque nos próximos eventos abria um dia vazio.

## 10/11/2026 — Data dos eventos como acontece no local; Barra do Garças no horário de Brasília

Correção do usuário: o GM (dia 20) aparecia no dia 19 para Barra do Garças. Duas causas: `fusoDaEscola("MT")` dava
America/Cuiaba, mas a filial funciona no horário de Brasília (MT saiu do mapa; única filial do estado); e a data dos
eventos era lida no fuso de quem vê. Regra única em `lib/data-evento.ts`: dia inteiro vale pela data gravada (UTC); com
horário, no fuso de onde acontece (`AgendaItem.fusoLocal`: filial do evento pela UF, Ágora = Brasília). Aplicada no
calendário, nos próximos eventos da Agenda, no destaque da tela inicial e na vitrine.

## 10/11/2026 — Sugestões com subcategoria, assunto e contexto; link por rodada da avaliação; pedidos de GAF

- Sugestões (migração `20261110190000_sugestao_subcategoria`: `subcategoria`, `titulo`, `contexto`): formulário em
  etapas (categoria, subcategoria com pergunta-guia, turma ou evento quando a subcategoria pede, assunto curto
  obrigatório, texto; problema no Portal em dois campos, "o que tentei" e "o que aconteceu"). Regras em
  `lerClassificacao` (sugestoes-comum.ts); turma e evento conferidos no servidor por `opcoesDeContexto`.
- Avaliação: link por rodada (`/avaliacao?rodada=<id>`), usado no convite do WhatsApp; sem ele, abre a próxima pendente.
- GAF: pedidos para participar com Aceitar/Recusar na lista da aba GAF (`decidirPedidoGaf`), com escolha do GAF quando o
  aluno não escolheu.

## 10/11/2026 — Resumo semanal das sugestões; questionário-base da avaliação

- Sugestões no resumo semanal (escolha do usuário): o resumo da direção (segunda, 8h da filial) ganha "N sugestões
  novas"; `resumoSemanalDeSugestoesDoPortal` (segunda, 8h de Brasília) avisa a administração nacional (donos do sistema
  e liberadores nacionais) dos problemas e ideias sobre o Portal ainda não lidos. Sem push a cada sugestão.
- Questionário-base (ok do usuário): notas e escolhas obrigatórias; textos opcionais (inclusive "em que o instrutor
  poderia aperfeiçoar"); "Prefiro não responder" em discordância, faixa etária, escolaridade e convivência
  (`PREFIRO_NAO_RESPONDER`, fora das comparações da análise). Não altera questionários próprios (Barra do Garças tem um)
  nem rodadas já abertas (guardam cópia).

## 10/11/2026 — Portal do Aluno enxuto (avaliação de design 24/40)

Avaliação Impeccable (`.impeccable/critique/`) e pedido do usuário "rode tudo":
- Página inicial: contribuição a pagar fixa no topo, com "Pagar agora · R$ X" que abre direto o pagamento do mês mais
  antigo em aberto (`ContributionStatusPanel abrirEmAberto`); carrossel parado (`Vitrine automatico={false}`), no máximo
  3 destaques, sem os slides fixos da Criança para o Bem e da contribuição; 4 atalhos (Pagamentos, Agenda, Estudos,
  Jornada); Comunidade e "Ajuda e escola" em listas agrupadas (`ListaAtalhos`/`LinhaAtalho`); avaliação aberta em
  destaque; Boletim na lista.
- "Economia" virou "Pagamentos" (dicionário, busca e tour); "Editar Dados" virou "Meus dados", lado a lado com a
  Carteirinha e do mesmo tamanho (pedido do usuário).
- Pagamento: oferta do crédito mensal do Fortuna saiu da janela por cima e foi para dentro do formulário; recarga só no
  próprio pagamento (pedido do usuário: nada depois); confirmação sem "Mercúrio"; PIX/Cartão e recarga com aria-pressed;
  Voltar e Cancelar com área de toque.
- "Meus dados" em modo leitura: nome como texto, endereço com "Pedir correção" que abre o formulário, rótulos ligados.
- WhatsApp só o da filial (antes caía no número do aluno); botão some sem número; no computador fica dentro da coluna.
- X das janelas com 44 px; foco visível global na cor da marca; seleção de texto em dourado.
Pendente: anúncio da Acrópole Play levar à série (falta o endereço de cada série na área de membros e saber se o link
automático da Cademi aceita destino).

## 10/11/2026 — Pedidos de correção visíveis ao aluno; texto mínimo de 11 px

- "Meus dados" mostra os pedidos de correção dos últimos 120 dias com a situação (em análise, aprovado, não aprovado),
  por `meusPedidosDeCorrecao` (member-actions) e `lib/pedidos-correcao.ts` (testes em `tests/pedidos-correcao.test.ts`).
  `ContactChangeLog` não guarda motivo da recusa; o aluno é orientado a falar com a secretaria.
- Textos de 9, 10 e 10,5 px subiram para 11 px em `components/member` (aluno, voluntário, instrutor). Comprovante,
  declaração e carteirinha ficaram como estavam (documentos). Agenda e grade de meses conferidas a 360 px, sem estouro.

## 10/11/2026 — Página inicial com um sistema só de botões e cores

Pedido do usuário ("botões de vários tamanhos e cores"): cartão da contribuição branco, com a situação numa etiqueta
(em atraso / sem desconto / a vencer / em dia) e um único botão principal verde (`BOTAO_PRIMARIO`; secundário em
contorno, `BOTAO_SECUNDARIO`); destaques do carrossel todos no tom claro (Play e Diário inclusive); avaliação aberta como
linha de lista com etiqueta "Aberta" em "Para você"; botões do cartão de boas-vindas com cantos `rounded-xl` e 44 px.
Vermelho e dourado só em etiquetas pequenas; o verde do WhatsApp continua no botão flutuante.

## 10/11/2026 — Lembrete que abre o pagamento; letra maior

- Lembrete de vencimento (D-3 e no dia) leva a `/portal?abrir=pagar`, que abre direto o pagamento do mês em aberto
  (também depois do login).
- Botão "A+" no topo do Portal (`components/ui/tamanho-texto.tsx`): classe `texto-grande` na <html>, aplicada antes de
  desenhar pelo script de layout.tsx, guardada no aparelho (`na-texto`); amplia a página 15% (`zoom` no body, porque os
  tamanhos são em px). Conferido a 360 px sem estouro. Controles do topo saíram da posição absoluta (cobriam o logo).

## 10/11/2026 — "Hoje" na página inicial

Bloco "Hoje" logo depois da busca: aulas, reuniões, conversas com o instrutor e eventos em que a pessoa se inscreveu,
no dia (pela data civil do compromisso, para servidor e aparelho concordarem), com hora e lugar; toque abre a Agenda.
"Para você" (avaliação aberta) subiu junto, antes do carrossel. O extrato do Fortuna já existia em `/portal/fortuna`,
ligado pelo cartão do saldo.

## 10/11/2026 — Janelas do aluno no mesmo padrão da página inicial

`ListaAtalhos`/`LinhaAtalho` foram para `components/member/lista-atalhos.tsx` e passaram a servir também às janelas:
Área de Estudos em duas listas (Meus estudos; Conteúdos da Nova Acrópole), "Minha Contribuição" como linha em
Pagamentos, "Adicionar créditos" do Fortuna em contorno (o único verde sólido da janela é "Pagar agora"), Minha Jornada
com cartões brancos e ícone em destaque. Rótulos repetidos tirados.

## 10/11/2026 — Telas secundárias do aluno no mesmo padrão (Claude)

- Link "← Portal do Aluno" (e os demais "voltar" das 17 páginas internas: avaliação, diário, estudos, GAF, grupos, carteirinha, indicar, sugestões, Fortuna, comprovante, declaração, agenda Google, professor/turma, escolástica): área de toque de 44px (`min-h-11 -my-2 w-fit`), letra 13px e cinza mais escuro (gray-600). Antes era texto de 12px com ~16px de altura.
- Indicar um amigo (`compartilhar-convite.tsx`): WhatsApp no verde principal (`bg-na-green`, como o "Pagar agora"); "Compartilhar" só aparece onde o aparelho tem compartilhamento nativo (`useSyncExternalStore`, sem divergência servidor/aparelho). No computador o botão não fazia nada; lá fica só "Copiar convite" na linha toda.
- Extrato do Café (`/portal/fortuna`): filtros de período com 40px de altura e o verde principal.
- Verificação: tsc, eslint e testes. Sem migração.

## 10/11/2026 — Botões do aluno num arquivo só (Claude)

- Novo `src/components/ui/botoes.ts`: `BOTAO_PRINCIPAL` (verde, 44px, cantos xl), `BOTAO_CONTORNO`, `BOTAO_PEQUENO` (ações de linha, 36px), `BOTAO_TEXTO` (atalho verde sem caixa) e as versões `*_LARGO` (48px, largura toda) usadas na página inicial.
- As telas que tinham a sua própria constante `BOTAO` passaram a importar dali (com alias, sem mexer no JSX): diário (`diario-cliente.tsx`), diário da FV (`diario-fv.tsx`), grupo (`grupo-painel.tsx`), leituras do GAF (`leituras-gaf.tsx`), anotações (`anotacoes-cliente.tsx`) e a página inicial (`member-portal-client.tsx`). Opções de "compartilhar evento" com 44px e cantos xl.
- Telas de direção/admin (`director/*`) ficaram de fora de propósito: são de operação e mais densas.
- Ao criar botão novo em tela do aluno, importar de `@/components/ui/botoes` em vez de escrever as classes.
- Verificação: tsc, eslint, 233 testes. Sem migração.

## 10/11/2026 — Botões de ação pequenos demais (Claude)

- Agenda (`agenda-panel.tsx`): "Inscreva-se", "Gerar PIX", "Inscrição no site", "Entrar na fila", "Cancelar inscrição" e "Voltar" tinham letra de 11px e ~28px de altura. Agora têm 40px (`min-h-10`) e 13px. A barra de abas da agenda não mudou.
- Meus dados (`profile-edit-panel.tsx`): "Enviar solicitação", "Cancelar" e "Trocar foto" no mesmo tamanho.
- Pergunta do topo (`nudge-card.tsx`) e "Quero participar" dos grupos de estudo (`grupos-estudo-panel.tsx`): idem.
- Verde único: leitor da carteirinha, "Adicionar ao Google Agenda" e a página pública do convite usavam `bg-na-green-dark`; agora `bg-na-green` com o escuro só no hover, como os demais.
- Edição por linha exata (script conferindo cada troca). tsc e 233 testes. Sem migração.
- Ainda há botões escritos à mão em telas de professor, escala de pedagogos e voluntariado; ficam para quando alguém mexer nelas (usar `@/components/ui/botoes`).

## 11/11/2026 — Teste real de crédito no Fortuna pela API de integração (Claude, autorizado pelo usuário)

- Pedido do usuário: "teste com um valor simbólico na minha conta de Barra do Garças, e depois remova o crédito".
- Cliente Fortuna 2467 (matrícula 21596), filial 35 (Barra do Garças), saldo antes R$ 0,00.
- `fortunaCreditarSaldo(2467, 35, 1, "teste-portal-2026-11-11-credito")` pela integração: HTTP 200, recibo 15009, saldo R$ 1,00. **A permissão de crédito da integração está liberada para BGA.**
- Retirada: a integração só aceita valor positivo e não aceita "Estorno" (documentação do Fortuna). Foi feita pelo caminho antigo (login de gerente, `PUT /balance/with-receipt`, valor −1): recibo 15010, saldo final R$ 0,00. No extrato ficam os dois lançamentos (+1,00 e −1,00).
- Consequência: estorno de crédito do café (ex.: recarga paga e devolvida no Asaas) só pelo login antigo ou pela equipe do Fortuna. Se for preciso automatizar, pedir ao Paulo um endpoint de estorno na integração.
- Próximo passo (do usuário): ligação com o Asaas. Em BGA a subconta ainda recusa Pix ("conta precisa estar aprovada").

## 11/11/2026 — Escolástica → Novos pedagogos (pedido de inclusão no Mercúrio) e link do aviso de interessados

- **Novos pedagogos** (`/escolastica/novos-pedagogos`, aba própria): pedido de inclusão de pessoa da filial como pedagogo no Mercúrio. Pede **só Chefe e Sub-Chefe** (Sub-Chefe se o chefe não retirou a Escolástica; quem chefia outras filiais escolhe a filial). Atende a **administração nacional** (dono + LiberadorNacional): "Incluído no Mercúrio" ou "Não incluir" (com motivo que a filial lê). Fica registrado quem pediu (`solicitadoPorId`) e quem atendeu (`atendidaPorId`; nulo = fechado pela importação, quando `Member.isPedagogo` passa a true — `fecharJaIncluidas`, rodada ao listar). Push para a administração nacional no pedido e para quem pediu no atendimento. Aba escondida para os demais (`AbasEscolastica`, componente de servidor que substituiu `AbasArea` nas páginas da Escolástica).
  - Arquivos: `lib/solicitacoes-pedagogo.ts`, `lib/solicitacoes-pedagogo-comum.ts`, `lib/actions/solicitacao-pedagogo-actions.ts`, `components/escolastica/novos-pedagogos.tsx`, `components/escolastica/abas-escolastica.tsx`, teste `tests/solicitacoes-pedagogo.test.ts`.
  - Migração `20261111150000_solicitacao_pedagogo` (tabela `SolicitacaoPedagogo`, RLS ligado) **aplicada com autorização do usuário** via `db execute` + `migrate resolve`.
- **Aviso "interessado novo"** (recepcao-interessados.ts): vem da sincronização diária da base de interessados das aberturas (`consultarCrmAberturas`, ~06h15 de Brasília); "novo" = não estava na cópia anterior. O toque abria a página inicial do painel; agora `linkInteressados` abre `/voluntario/aberturas?secao=interessados&abertura=…&busca=<nome, se for um só>` (`PainelAberturas` aceita `secao`/`aberturaInicial`/`busca`). O aviso do dia da primeira aula também abre a lista.
- 11/11 (mesmo dia): **quem atende os Novos pedagogos** passou a ser só o responsável nacional, **Giordano Bruno (matr. 268, BSB)**, e quem ele indicar (pedido do usuário). `RESPONSAVEL_NACIONAL_PEDAGOGOS` (env, padrão 268); indicados em `ResumoNacional` chave `atendentes-novos-pedagogos` (sem tabela nova), geridos na própria página ("Quem atende os pedidos": indicar/retirar por matrícula). O dono do sistema também entra e gere indicados, mas não recebe os avisos. Os liberadores nacionais deixaram de atender.
- 11/11: **aviso "interessado novo" desligado** (`AVISO_INTERESSADO_NOVO_DESLIGADO` em recepcao-interessados.ts). Motivo (usuário): os ~800 leads do CRM não são interessados; "interessado" deve ser quem perguntou do curso no WhatsApp, foi a aula inaugural, se inscreveu na abertura e não se matriculou, ou foi marcado manualmente pela escola. Requalificação do número em andamento.
- 11/11: **interessado qualificado** (`lib/aberturas/interessados-qualificados.ts`, teste `tests/interessados-qualificados.test.ts`). O número "Interessados" das aberturas deixou de ser o total de leads do CRM do Ulisses (que são contatos a trabalhar). Conta quem, sem matrícula e sem pedido de não contato, tem: interesse declarado com origem WhatsApp ("Perguntou no WhatsApp"), `presenca_palestra` ("Foi à aula inaugural"), vínculo `aberturaId` (inscrição na abertura), interesse declarado positivo pela escola (pessoalmente), pedido de matrícula ou outra atividade; ou, vindo do CRM, `interesse.estado` em conhecer/participar/inscrever (com `interesse.fonte` "whatsapp"/"aula_inaugural"). Último "sem interesse" tira da conta. Calculado em `aberturas-data.ts` (`lead.motivosInteresse`). Tela: resumo e aba Interessados mostram interessados × contatos na base; lista abre nos interessados, com chips dos motivos; botão novo "Perguntou no WhatsApp" na situação do interessado (sinal `interesse_declarado`/`conhecer` com `origem: "WhatsApp"` — sem tipo novo no motor). **Sem migração** (reaproveita os sinais por abertura; a autorização dada pelo usuário para uma tabela de marcação não foi usada). Contrato para o CRM do Ulisses enviar WhatsApp/aula inaugural: `lead.interesse = { estado: "conhecer"|"participar"|"inscrever"|"nao", fonte: "whatsapp"|"aula_inaugural"|… }` ou `lead.sinais[]` no formato do motor. Hoje: 0 interessados qualificados nas 5 filiais com base (nenhum sinal registrado; todos os leads "a_confirmar").
- 11/11: **faixas de abas e filtros sem barra de rolagem** (pedido do usuário: "troque as barras de rolagem por setas"). `components/ui/faixa-rolavel.tsx` (`FaixaRolavel`): esconde a barra, mostra seta com esmaecido do lado em que há conteúdo escondido (some quando não há), rola 70% da largura, centraliza a aba atual (aria-current/selected/pressed) ao abrir; o dedo continua arrastando no celular. Aplicado em AbasArea (todas as áreas de trabalho), AbasAdmin, abas do grupo, abas das Aberturas, dias do diário e filiais da Administração. Tabelas continuam com rolagem normal. Conferido em 390px e 1280px.
- 11/11: **Novos pedagogos — pedido com várias pessoas e autorização do Giordano** (pedido do usuário). Um pedido junta até 20 pessoas (uma linha por pessoa; mesmas `solicitadoPorId` + `createdAt` = mesmo pedido, `chaveDoPedido`), cada uma com a sua formação e um motivo comum. Situações: `pendente` (aguardando autorização) → `autorizada` → `incluida` (botão "Já incluído no Mercúrio" ou a importação, quando `isPedagogo` vira true); ou `recusada` (com motivo) / `cancelada` ("Tirar do pedido", por quem pede, enquanto pendente). "Autorizar todos" no cartão. Ações: `solicitarPedagogos`, `decidirPedagogos(ids, decisão)`, `cancelarSolicitacaoPedagogo`, `alterarIndicadoPedagogos`. **Delegação só para o Giordano** (`gereIndicados` = matr. 268, sem o dono): cartão "Delegar" no fim da página, invisível para quem pede. O dono do sistema vê todos os pedidos (`veTodas`) mas não decide. Sem migração (status é texto). Conferido em 390px com dados de exemplo.

## 12/11/2026 — Convite de notificações clicável sobre a folha do evento; link de evento público de outra filial (Claude)

- `src/components/pwa/ativar-notificacoes.tsx`: o convite ("Aceita receber notificações...") virou `Dialog` Radix. Antes era uma `div` fixa; quando aberto por `pedirNotificacoes()` depois de uma inscrição, ficava sob a folha do evento (`BottomSheet`, Radix modal), que põe `pointer-events: none` no `body` — os botões não respondiam. Testado com Playwright: convite sobre a folha, "Pergunte-me depois" fecha e grava, a folha continua aberta.
- `getMemberDashboard(memberId, { eventoDoLink })` + `/portal?evento=<id>`: **exceção só do dono do sistema** (`ehDonoDoSistema`; pedido do usuário: "só pra mim, como exceção", não é regra geral) — evento público do Ulisses de outra filial abre pelo link para ver e compartilhar; não entra na agenda dele fora do link. Para todas as outras pessoas nada mudou. Conferido: o DMF de Goiânia Universitário (cmvjkwinn000a07kzq5wvmcm4) aparece para os 290 membros ativos da filial.

## 12/11/2026 — Portal do aluno sem rolagem lateral em celular estreito; texto do Acrópole Play (Claude)

- Causa da rolagem para o lado (medido com Playwright, dados reais, 320/360/390 px, com e sem "A+"): o carrossel `Vitrine` usava `grid` sem coluna definida — a coluna crescia até o min-content da linha de evento com `truncate` (305 px num espaço de 278). Em 320 px a página ficava com 334 px; com "A+" (`zoom: 1.15`), 384–385 px em 320 e 360. Correção em `vitrine.tsx`: `grid-cols-[minmax(0,1fr)]` + `min-w-0`. Depois: largura da página = largura da tela nas 6 combinações. A janela de boas-vindas do voluntário só parecia larga por causa do carrossel.
- Cartão da contribuição (`member-portal-client.tsx`): o selo ("Sem desconto" etc.) foi para a linha do rótulo; a mensagem usa a largura toda (antes virava coluna de uma palavra por linha).
- Acrópole Play (`vitrine.tsx`, `acesso-rapido.tsx`): "Assistir agora" → "Acessar o Acrópole Play" (o link abre a página inicial do Play, não a série do destaque).

## 12/11/2026 — Cópias velhas no banco de consulta do Mercúrio: importação protegida e painel de saúde (Claude)

- **Achado:** no banco `oinabview`, só `cadastro`, `reciboc`, `reciboi`, `turmas` e `turmas_materias` são VIEW (ao vivo). As outras 16 tabelas que o Portal lê são cópias (BASE TABLE) carregadas em 17/10/2026 e nunca mais (`compaluno`, `fichas`, `produtos`, `unidades`, `dirigente_funcoes`, `cursos_integra_participa`, condecorações e os catálogos `sig_*`). A tabela `atualização` diz 30/10 e não serve de guia. Sintoma: a composição dos alunos da ENOCH e da AMON (Barra do Garças), trocada no Mercúrio para MEMBRO AP, voltava a CURSO DE FILOSOFIA a cada importação. O usuário já pediu ao João Guilherme que as cópias virem views.
- **`src/lib/mercurio-db/frescor.ts`:** catálogo das fontes (o que cada uma traz) e data de carga de cada uma via `information_schema` (`TABLE_SCHEMA='oinabview'`; `DATABASE()` não funciona por ali). Cópia com mais de 2 dias = desatualizada.
- **`importar.ts`:**
  - com `compaluno` velha, a composição que o Portal já tem não é sobrescrita nem apagada; quem não tem nenhuma ainda é preenchido;
  - o recibo conta como pago se for de rubrica da composição OU de qualquer "CONTRIBUI…" (antes, com composição na cópia, só as rubricas dela; mesma regra do `resumo-filial.ts`).
- **`/admin/saude`:** seção nova "O que vem do Mercúrio, e de quando" (cada fonte: ao vivo ou cópia com data e idade, o que traz) e "Última importação completa por filial" (de `rotina-estado:mercurio`). Cópias críticas velhas e filiais sem importação há 26 h entram na contagem de pontos de atenção. Não dispara WhatsApp do suporte (problema conhecido, seria alerta de hora em hora).
- **`scripts/sync-composicao-mercurio.ts`:** relê a composição no Mercúrio pelo scraper (só leitura no Mercúrio) e grava no Portal. **Só funciona em Barra do Garças:** nas outras filiais o login do scraper abre a tela sem itens; o script recusa composição vazia e não mexe. Simulação em BGA: 3 alunos da AMON com 316=120 → 3311=140. A gravação ficou para o usuário rodar (`npx tsx scripts/sync-composicao-mercurio.ts BGA`).
- **Continua desatualizado até o João resolver:**
  - situação mensal (`fichas`): só o pago é corrigido pelos recibos ao vivo;
  - Chefe e Sub-Chefe (`unidades`);
  - cargos e secretarias (`dirigente_funcoes`);
  - cursos de integração;
  - nomes de rubricas criadas depois de 17/10;
  - composição fora de BGA.

## 12/11/2026 — Filial Fortaleza Dionisio Torres (FOR) aberta no Portal (Claude, autorizado pelo usuário)

- O pedido veio do caso de Carlos Rangel Neves Otto (matrícula 3006), que estava ligado a Goiânia Universitário no Portal mas é de Fortaleza. `scripts/abrir-filial-db.ts FOR --gravar`: 277 ativos importados, filial aberta (`portalAberto`), 260 logins criados. Ninguém que já tinha login foi tocado (só o Carlos tinha), e nenhum e-mail foi enviado. O Carlos passou para Fortaleza pela própria importação, com o mesmo login.
- A 1ª execução parou num erro de `ClassGroup` durante a importação, antes de criar logins; a 2ª foi até o fim.
- Sem login: 2 sem e-mail (Maria Clara Ferreira Maldonado, Maria das Dores Guerrero Dora) e 14 com e-mail já usado por outra conta (em geral filhos com o e-mail do responsável).
- A filial entra na rotina diária de importação a partir de agora.

## 12/11/2026 — Cronograma da cobrança com spread em Goiânia e região + Sede Nacional (Claude)

Plano, sem código: [CRONOGRAMA-SPREAD-ASAAS-2026-11.md](CRONOGRAMA-SPREAD-ASAAS-2026-11.md). Autorização do Diretor Nacional dada.
- Escopo: Goiânia (GYN, JAM, STO, GAR), Goiás, Barra do Garças e Sede Nacional.
- Escola com conta Asaas própria: usar a chave de API dela, com split para o BPO. Sem subconta nova e sem repasse posterior.
- Bloqueio: a baixa no Mercúrio só funciona em BGA (login do scraper).
- Itens de desenvolvimento T1–T10. Os principais: modo guiado por QR (`/pagar`), cartão recorrente com split e conferência de split.

## 12/11/2026 — Regra do spread registrada (Claude)

A regra comercial do spread estava só na proposta em PDF e no WhatsApp; nunca tinha sido gravada no repositório. Agora está na seção 0 de [CRONOGRAMA-SPREAD-ASAAS-2026-11.md](CRONOGRAMA-SPREAD-ASAAS-2026-11.md).

- **Fixo:** R$ 3.000 por mês, abatido pelo spread do mês.
- **Base do spread:** só o que passa pelo Portal.
- **Faixas:** progressivas pelo total de membros das escolas aderentes; a taxa média vale igual para todas.
- **Taxa do Asaas:** no Pix, sai da parte da escola; no cartão, é repassada ao aluno.
- **Sede Nacional:** é a filial de Brasília (BSB).
- **Pendente no código:** ainda cobra 2% fixo. O item T11 troca isso pelas faixas e cria a fatura do fixo.

## 12/11/2026 — Página do cronograma do spread no Portal: /admin/cronograma (Claude)

A pedido do usuário ("quero uma página de internet, não um artefato"), o cronograma virou uma página do Portal. Só o dono do sistema acessa, porque ela tem condições comerciais.

**Arquivos**
- Dados: uma linha de `ResumoNacional`, chave `cronograma:spread`. É JSON com `{acoes: [...]}`, então não precisou de tabela nova nem de migração.
- Conteúdo inicial: `CRONOGRAMA_INICIAL` em `src/lib/cronograma-spread.ts`, já com as respostas de 12/11.
- Tipos, dias úteis (com feriados) e alertas: `src/lib/cronograma-spread-comum.ts`, sem acesso ao banco.
- Ações de servidor: `src/lib/actions/cronograma-actions.ts`. Cada uma confere `ehDonoDoSistema` e grava o registro quando a situação muda.
- Tela: `src/components/admin/cronograma-spread.tsx`. Inclui, edita e exclui ações; muda a situação; registra o andamento; tem filtros, busca e alertas.

**Alertas de tempo**
- **Atrasada:** o prazo passou e a ação não foi concluída.
- **Prazo curto:** os dias úteis do prazo são menos que o tempo médio.
- **Comece hoje:** a ação ainda não começou e os dias úteis que restam são menos que o tempo médio.

## 12/11/2026 — Spread por faixa fixa no split e aba "Cobrança on-line" na Economia (Claude)

**Regra corrigida pelo usuário: as faixas são fixas, não proporcionais.** O total de membros ativos das escolas do escopo define uma taxa única, que vale no mês seguinte.
- Escopo do piloto: Goiás sem Valparaíso, mais BGA e BSB. São 1.651 ativos, o que dá **1%**.
- Detalhes na seção 0 de docs/CRONOGRAMA-SPREAD-ASAAS-2026-11.md.

**Spread no código**
- `src/lib/spread-comum.ts`: faixas, `faixaDoSpread` e o fixo abatido.
- `src/lib/spread.ts`: escopo e configuração em `ResumoNacional` (`cobranca:config`); contagem no Mercúrio, com o Portal como reserva; faixa congelada por mês (`spread:AAAA-MM`).
- `split.ts`: a margem passou a usar a faixa do mês, no lugar dos 2% fixos. Se a contagem falhar, usa a última faixa gravada e, sem nenhuma, os 2% antigos.
  - **Muda as cobranças reais de BGA: a margem cai de 2% para 1%.**

**Taxa do cartão por filial**
- Fica em `cobranca:config.cartaoSemRepasse`. O padrão continua sendo repassar ao aluno.
- `payment-actions.ts`: sem repasse, o aluno paga o valor base. O split do cartão fica limitado ao valor líquido.
- O aviso "no cartão o valor sai maior" só aparece ao aluno quando a filial repassa a taxa (`cartaoComTaxa` em member-data).

**Economia → aba "Cobrança on-line"** (`components/economia/cobranca-online.tsx`)
- Escolha da taxa do cartão, com aviso de inadimplência e exemplo com a taxa real da conta.
- Faixa em vigor e prévia do mês seguinte, tabela de faixas e situação da conta Asaas.
- **Seletor de filial para o dono do sistema**, que vale para todas as abas da Economia.

**Cronograma:** o conteúdo inicial foi atualizado com as escolas de Goiás, a regra corrigida e as ações a37 e a38.

## 12/11/2026 — Problemas de pagamento na Economia e modelos de WhatsApp da cobrança (Claude)

**Economia → Cobrança on-line → "Problemas no pagamento"** (`src/lib/problemas-pagamento.ts`). A seção mostra o que a Economia resolve:
- **Lançamento parado para conferência:** `MercurioSyncTask` de `lancar_contribuicao_paga` em `falhou`, cujo erro pede ação humana (dia travado, ficha pendente diferente etc.).
  - O botão "Já lancei no Mercúrio" (`marcarLancadoAMao`) marca a tarefa como `sincronizado` e registra quem lançou e quando.
- **Cobrança parada:** gerada há mais de 3 dias e não paga.
- **Débito automático:** autorização recusada, vencida ou cancelada.
- **Composição vazia.**

O que é de sistema fica com o dono do sistema. Hoje isso inclui os demais erros de lançamento e a conta Asaas não ligada. A Economia vê só a contagem desses casos.

Também há um guia "mensagens que o aluno pode ver e quem resolve".

**Modelos de WhatsApp:** sete modelos novos em `src/lib/whatsapp/modelos.ts`, ainda **não cadastrados na Meta**:
- vence em breve e vence hoje;
- código Pix;
- débito automático ativado, falhou e cancelado;
- cartão recusado.

Os testes de regras da Meta passaram.

**Recomendação:** um número só para o financeiro, separado do CRM. A migração `20261026180000_whatsapp_financeiro_instagram` e a variável `ZERNIO_WHATSAPP_ACCOUNT_ID` continuam paradas até o usuário confirmar.

**Cronograma:** ações a39 e a40.
