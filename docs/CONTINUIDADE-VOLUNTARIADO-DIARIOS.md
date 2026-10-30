# Continuidade do plano de grupos, diários e formação

Fonte principal: decisões do responsável pelo Portal nesta conversa. O plano anterior do Claude serve como contexto secundário. Não liberar acesso nacional a informes por analogia com a liberação de testadores.

## Decisões confirmadas

- Reuniões e escalas desta etapa são somente para BF, BM e CS, correspondentes a GF, GM e GS na solicitação. Não são novas atividades para turmas comuns.
- Reuniões únicas ou semanais, data e horário, edição/cancelamento pontual ou desta e das seguintes. Convocação para todos; quem não puder comparecer registra justificativa. Confirmação não é presença realizada nem justificativa equivale a dispensa automática.
- CRM com traje completo deve ser sempre público para integrantes. Aula formativa, oficina, apreciação artística e outras características podem ser públicas ou ficar no registro interno dos responsáveis.
- Escalas BF: Recepção, Cozinha, Serviço, Decoração, Limpeza de Piso e Banheiros. BM: Manutenção Preventiva, Manutenção Reativa, Som, Brindes. CS: Portaria, Câmeras, Recolher Lixo, Abertura e Fechamento da Escola. O responsável poderá criar e remover funções. Remover função não deve apagar escalas históricas.
- Chefe de filial cria/edita/cancela ED e Pré-ED, com nome do HD e convocação para todos os FV-BRG. ED é mensal.
- GDVE: encontros quinzenais, grupos de cinco FV, locais ou entre filiais. Chefe da filial organiza os grupos locais; pessoas específicas/HDs organizam os demais. Não implementar autoentrada por código nem conceder a todo HD um poder nacional sem designação. Reconhecimento de FV vem do cadastro/grupos oficiais, não de escolha do usuário. GDVE substitui o botão GAF para FV; diário fica dentro do módulo correspondente.
- Diário privado: sem leitura pelos dirigentes. Importar histórico por e-mail. Excluir AdSense, afiliados Amazon e IA com chave no navegador; eventual IA somente no servidor.
- Avaliação de instrutores: responsável escolhe anônima ou identificada ao publicar; configuração precisa ser mostrada ao aluno e não pode mudar depois de receber respostas. Em modo anônimo, apresentação de resultados somente a partir de três respostas é a proteção proposta, ainda não é um módulo implementado. Base nacional pode ser adaptada pela filial; Escolástica ou chefe libera a qualquer momento ou por ondas.
- Informe mensal: chefe de grupo lê os informes dos membros do seu grupo. Acesso consolidado nacional ainda não definido: não habilitar automaticamente a dirigentes nacionais.

## Reuniões implementadas

Modelos `GroupMeeting`, `GroupMeetingResponse` e `GroupMeetingAudit`. Migração aditiva `20261018190000_reunioes_brigadas` com RLS sem políticas públicas. As Server Actions validam responsável ativo e vínculo com a brigada; integrante só responde por si, com acesso liberado e versão atual da convocação.

A rotina semanal não tem data final. O modelo `GroupMeetingSeries` mantém a regra e gera uma janela de 12 próximos encontros conforme responsáveis e integrantes consultam o Portal. O formulário mostra data inicial e horários; características e reunião extra ficam recolhidas. O fuso é automático, sem campo obrigatório. O horário local é preservado ao atravessar mudanças de horário de verão. Editar horário exige nova confirmação; respostas anteriores ficam preservadas na auditoria reservada. Cancelamentos mantêm a ocorrência na agenda com o motivo. Sem envio automático de WhatsApp ou Slack.

Localização: **Turmas e grupos → brigada → Reuniões da brigada**. Para integrantes: **Agenda**, no dia da reunião. Detalhes internos e justificativas de outras pessoas não são incluídos no payload da Agenda.

## Termo: estado real

**Decisão de 30/10/2026** (direção nacional do Instituto Maat): o Termo de Adesão ao Serviço Voluntário só vale juridicamente assinado pelo gov.br ou em papel com 2 testemunhas, e validadores externos custam caro. O Portal **não colhe assinatura**. `/voluntario/termo` orienta a procurar a secretaria ou a Direção da filial e mostra o texto preenchido com o cadastro (recolhido). As boas-vindas do voluntário dão a mesma orientação. A ação `signVolunteerTerm` e o formulário foram removidos; a tabela `VolunteerTermSignature` ficou vazia (o único registro era um teste do usuário, excluído em 30/10/2026). Não reativar assinatura pelo Portal sem nova orientação jurídica.

## Fontes dos diários localizadas

- https://github.com/henriquezanchi/diario-filosofico — clone em `/workspace/diario-filosofico`, revisão analisada `9a35b21`.
- https://github.com/henriquezanchi/diario-filosofico-fv — clone em `/workspace/diario-filosofico-fv`, revisão analisada `0f2a6e5`.
- Aplicações indicadas: https://diario-filosofico-azure.vercel.app/ e https://diario-filosofico-fv.vercel.app/.

Os dois repositórios têm `src/App.jsx` e persistência Firebase. Coleções identificadas: `users`, `entries`, `userBooks`, `customTasks`, `longTermGoals`, `fvData`; o diário de membro também usa `userSettings`. A versão FV tem APIs de grupos GDVE, com autoentrada por convite no produto antigo. Não copiar esse mecanismo para o Portal, pois diverge da decisão do responsável. Os repositórios atuais contêm mais funcionalidades do que o resumo inicial; revisar o código, não presumir que todo conteúdo da versão pública seja apenas de membro.

Importação pendente de credenciais de serviço de **cada** projeto Firebase, nas configurações seguras. Preparar exportação somente leitura de usuários e das coleções. Parear por e-mail confirmado; não parear por nome. E-mails ambíguos, duplicados ou sem correspondência ficam separados para conferência de identidade, sem exibir conteúdo do diário a dirigentes. Guardar projeto/UID/ID original e checksum para reexecução idempotente. Não sobrescrever edição posterior feita no Portal. Logs apenas com contagens e identificadores técnicos, sem conteúdo íntimo.

Ainda não houve importação e nenhum usuário começou “do zero” por esta atualização.

## Informe e dependências restantes

Formulário indicado: https://docs.google.com/forms/d/18FCYosh6IVq5Neukuc_RA9p1Ve66F4W3_CntlRi7Axg/viewform?ts=6a032600&edit_requested=true.

O ambiente bloqueou `docs.google.com` e os domínios dos dois diários com HTTP 403 no túnel. O código dos diários pôde ser obtido pelo GitHub. As oito seções do informe não foram lidas; não inventar perguntas nem dizer que o formulário foi reproduzido.

Próximos blocos: escalas; ED/Pré-ED; designação de responsáveis por GDVE; diário unificado e importação; informe com rascunho e restrição de leitura por grupo; avaliação com configuração de privacidade na publicação. Estes blocos não estão implementados nesta etapa.

## Verificações

- `node --import tsx --experimental-test-module-mocks --test tests/*.test.mjs`
- `node tests/browser/meetings.mjs`
- `npx tsc --noEmit`, `npx eslint src scripts`, `npm run build -- --webpack`

Dados fictícios em testes. Nenhuma convocação real, notificação externa ou alteração de grupo real foi feita durante a validação.

## Migração e publicação

O token anterior retornava HTTP 403 por falta de privilégios no projeto `lefahgczkonbqcppyftg`. Em 18/10/2026 o responsável atualizou a credencial segura e o acesso foi confirmado como `postgres`. A migração aditiva `20261018190000_reunioes_brigadas` foi aplicada via API de gerenciamento do Supabase, com checksum registrado em `_prisma_migrations`. As três tabelas foram conferidas com RLS habilitada. Não foram criadas reuniões ou convocações de grupos reais durante a validação.

A versão foi encaminhada à master após as verificações de testes, lint e build. Conferência autenticada com responsável e integrante reais ainda é necessária para validar o uso no grupo específico da escola.

## Ajuste de recorrência e notificações

Migração aditiva `20261019000000_rotina_semanal_continua`: rotina contínua, segmentos de alteração e identificação imutável de cada posição na série. Reuniões canceladas ou movidas pontualmente não são recriadas pela geração seguinte. Erros esperados retornam mensagens legíveis, evitando a mensagem genérica de produção.

CallMeBot em `error-notify.ts` atende alertas técnicos ao telefone de suporte configurado. Isso não equivale ao envio de avisos aos integrantes. O helper de WhatsApp dos integrantes era uma simulação que retornava sucesso; agora retorna indisponibilidade, sem registrar mensagem como enviada. Publicação de aviso informa o resultado real e os rascunhos de cobrança não são marcados enviados sem sucesso do provedor. Nenhuma mensagem real foi enviada durante os testes.

Validação adicional: 25 testes automatizados, cenários de navegador em 414 e 1365 pixels, TypeScript, ESLint, build de produção e teste PostgreSQL local de migração/RLS. Consulta autenticada na produção segue pendente de uso por responsável real.

A migração de rotina contínua foi aplicada no projeto de produção e registrada em `_prisma_migrations`. As quatro tabelas de reuniões foram conferidas com RLS habilitada. Nenhuma reunião real foi criada no processo.
