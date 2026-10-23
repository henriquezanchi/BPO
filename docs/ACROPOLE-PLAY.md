# Acesso individual à Acrópole Play

A exportação oficial inclui `login_auto`. Trate o arquivo e cada link como credenciais. Não publique o arquivo nem envie os links em logs, relatórios, propriedades React ou campos do Member.

O catálogo privado guarda links cifrados com AES-256-GCM e chave no Supabase Vault. Somente o servidor usa a chave. O redirecionamento verifica conta autenticada com e-mail confirmado, recurso da filial, membro principal ativo, matrícula Mercúrio e nome/e-mail exatos. E-mails compartilhados e divergências permanecem pendentes. As tabelas têm RLS sem leitura por anon/authenticated.

A conciliação nacional usa o modo service-role `exportar_identidades_ativas` da função CRM `mercurio-db-sincronizar`, que fornece somente hashes de nomes/e-mails e matrículas/unidades dos ativos. O arquivo registra a data da base acadêmica; sucesso da consulta não comprova atualização dessa base.

## Importação e atualização

1. Obtenha nova exportação de alunos da Play e snapshot autorizado dos ativos do Mercúrio.
2. Execute `npx tsx scripts/import-acropole-play.ts <exportacao.xls> --mercurio=<snapshot.json> --validate-only --report=<novo-relatorio.json>`.
3. Desative `AcropolePlayConfig.enabled` no banco antes da gravação. O botão continua levando ao login manual.
4. Com as variáveis de serviço do Portal, execute o mesmo comando com `--apply` no lugar de `--validate-only`. O padrão sem nenhuma dessas opções apenas consulta e simula. Use caminho de relatório novo.
5. Confira os totais, restrições de acesso e pendências; reative o sinalizador.

O importador aceita TSV UTF-16LE ou UTF-8 exportado como .xls, até 6 MiB. Não aceita XLS binário/XLSX. Relatórios contêm IDs e status, nunca links. Lotes são idempotentes por ID externo; uma falha exige repetir a importação antes de reativar. Uma nova exportação atualiza os links do mesmo aluno e pode promover pendências com um novo snapshot acadêmico.

## Quem entrar no Portal depois

Os ativos conciliados não precisam ter uma conta Portal na data da importação. O vínculo individual é criado quando o próprio membro usa o botão, depois das verificações de identidade. Nenhuma conta é criada pelo importador. Se não houver correspondência segura, abre o login manual.

Alunos novos na Play depois do arquivo precisam de outra exportação. Recomenda-se atualização semanal e após novas turmas, até existir API oficial confirmada. Isso não é uma sincronização automática com a Play. Novos ativos do Mercúrio exigem nova conciliação; alterações de e-mail/nome e e-mails familiares exigem revisão. A ausência numa exportação parcial não exclui registros antigos. Para revogar acesso, marque o registro pendente ou desligue o recurso/sinalizador.

Não teste os links entrando como alunos. Verifique autorização, cifragem, restrições e redirecionamento sem consumir a credencial individual.
