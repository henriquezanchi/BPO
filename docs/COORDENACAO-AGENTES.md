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
