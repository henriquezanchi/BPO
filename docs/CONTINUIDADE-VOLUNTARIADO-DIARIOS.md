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

## Reuniões implementadas e aguardando migração para publicação

Modelos `GroupMeeting`, `GroupMeetingResponse` e `GroupMeetingAudit`. Migração aditiva `20261018190000_reunioes_brigadas` com RLS sem políticas públicas. As Server Actions validam responsável ativo e vínculo com a brigada; integrante só responde por si, com acesso liberado e versão atual da convocação.

A série materializa até 52 ocorrências, com data final explícita. O horário local é preservado ao atravessar mudanças de horário de verão. Editar horário exige nova confirmação; respostas anteriores ficam preservadas na auditoria reservada. Cancelamentos mantêm a ocorrência na agenda com o motivo. Sem envio automático de WhatsApp ou Slack.

Após a migração/publicação, localização: **Turmas e grupos → brigada → Reuniões da brigada**. Para integrantes: **Agenda**, no dia da reunião. Detalhes internos e justificativas de outras pessoas não são incluídos no payload da Agenda.

## Termo: estado real

O termo atual registra nome digitado e CPF validado pelos dígitos verificadores. Não faz autenticação gov.br, não consulta identidade na Receita e não reúne assinaturas do representante e das testemunhas. Foi ajustada a linguagem para “concordância eletrônica”, preservando registros anteriores.

Segundo a orientação recebida da escola, o fluxo externo deve manter o mesmo PDF para as assinaturas do voluntário, representante e duas testemunhas, com conferência a cada etapa em https://validar.iti.gov.br/. Não imprimir/regenerar o documento entre assinaturas. O Portal ainda não recebe esses arquivos nem valida criptograficamente as assinaturas. Não marcar esse processo como concluído pelo simples aceite interno.

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

## Bloqueio real de publicação das reuniões

A chamada à API de gerenciamento Supabase no projeto `lefahgczkonbqcppyftg` retornou HTTP 403: “Your account does not have the necessary privileges to access this endpoint”. O token está configurado no ambiente, mas o principal não tem os privilégios necessários neste projeto. Nenhuma migração foi aplicada. Não publicar na master código que consulta as novas tabelas antes de aplicar a migração. A correção de nomenclatura do termo foi publicada separadamente.

A migração pronta está em `prisma/migrations/20261018190000_reunioes_brigadas/migration.sql`; é aditiva e inclui RLS. Após o acesso ser corrigido: aplicar a migração, registrar checksum em `_prisma_migrations`, publicar o commit das reuniões e testar com contas reais autorizadas, sem criar convocações para grupos reais durante a validação automática.
