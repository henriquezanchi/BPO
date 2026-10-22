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

19. **Ponte na Cloudflare para *.acropolebrasil.com.br** (22/10). O Cloudflare da Nova Acrópole desafia (403, cf-mitigated: challenge) toda chamada vinda da Vercel para Ulisses, Ágora e o login unificado; de dentro da Cloudflare passa. Worker em `infra/ponte-cloudflare` (conta de testes; migrar para a conta da escola), só aceita esses domínios e exige o cabeçalho `x-ponte-chave`. No Portal, use `fetchAcropole` (`lib/ponte.ts`) para qualquer chamada a esses sistemas; com `PONTE_URL`/`PONTE_CHAVE` passa pela ponte, sem eles vai direto.

Situação dos blocos 1 a 3 em 19/10: concluídos (avaliação, administração da filial e cadastro por solicitação). O bloco 4 (verificação por código) aguarda a escolha do provedor de envio.

Não mexer nesses blocos sem combinar. Os demais pendentes de `CONTINUIDADE-VOLUNTARIADO-DIARIOS.md` (escalas, ED/Pré-ED, diário, informe mensal) seguem livres.

## Regra de segurança: toda tabela nova com RLS

Em 19/10/2026, 44 das 55 tabelas do schema `public` estavam sem RLS. A chave pública do Supabase, que vai no navegador, lia `Member`, `PaymentCharge`, `ContactChangeLog` etc. pela API REST. A falha foi corrigida pela migração `20261019130000_rls_todas_tabelas`.

**Toda migração que cria tabela precisa terminar com `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;`.** O Portal acessa o banco só pelo servidor (Prisma), que não depende disso. Para conferir:

```sql
SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
```

A consulta deve voltar vazia.
