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

5. **Relatório da Filial** no Painel do Diretor (aba nova, `relatorio-tab.tsx`, resumo diário em `ResumoFilial`). Concluído em 19/10.
6. **Regra da contribuição** (verde/amarelo/vermelho com desconto até o dia 10) em `src/lib/situacao-contribuicao.ts`. Concluído em 19/10. Reutilize essa regra em vez de recriar.
7. **Tesouraria no módulo de Economia**: importar extrato, conferir o que já foi lançado no Mercúrio e lançar só o que falta. Adaptado do repositório `mercurio-tesouraria` (versão publicada de 11/10). Publicado em 19/10 em `/economia/tesouraria` (`src/pages/api/tesouraria`, código em `src/tesouraria/`, armazenamento no Postgres em vez de Redis). Ainda falta: corrigir a conferência de duplicidade (contar ocorrências, usar o FITID do OFX) e conferir pelo banco de consulta quando houver a tabela de movimento de caixas.
8. **Calendário inteligente** (aba Calendário do Diretor + aviso de conflito em `eventos-tab.tsx`). Publicado em 19/10.

Situação dos blocos 1 a 3 em 19/10: concluídos (avaliação, administração da filial e cadastro por solicitação). O bloco 4 (verificação por código) aguarda a escolha do provedor de envio.

Não mexer nesses blocos sem combinar. Os demais pendentes de `CONTINUIDADE-VOLUNTARIADO-DIARIOS.md` (escalas, ED/Pré-ED, GDVE, diário, informe mensal) seguem livres.

## Regra de segurança: toda tabela nova com RLS

Em 19/10/2026, 44 das 55 tabelas do schema `public` estavam sem RLS. A chave pública do Supabase, que vai no navegador, lia `Member`, `PaymentCharge`, `ContactChangeLog` etc. pela API REST. A falha foi corrigida pela migração `20261019130000_rls_todas_tabelas`.

**Toda migração que cria tabela precisa terminar com `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;`.** O Portal acessa o banco só pelo servidor (Prisma), que não depende disso. Para conferir:

```sql
SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
```

A consulta deve voltar vazia.
