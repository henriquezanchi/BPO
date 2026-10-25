# Organização da interface — 25/10/2026

Decisões do usuário nesta conversa:

- Blocos de conteúdo colapsáveis e fechados por padrão. Preservar exceções explícitas existentes; links de navegação, cabeçalhos, alertas e diálogos continuam acessíveis diretamente.
- Exceções encontradas no código: mês atual em Contas Pagas, ano mais recente na Jornada e painel de edição do grupo em Sobre. Seus contêineres preservam essa abertura. Ao acionar Editar evento, o formulário também deve abrir.
- Atividades cadastradas em ordem cronológica crescente. Datas anteriores ao dia atual em America/Sao_Paulo recebem “Já aconteceu”. dueDate é uma data civil gravada à meia-noite UTC; não deslocar o dia. Atividades de hoje não são marcadas como passadas. Aplicar também aos resumos na área de Instrutor.
- Calendário: até três títulos pequenos por dia, reticências se houver mais. Clicar na data mostra a lista completa; eventos da filial têm link para seu bloco de administração. Calendário e cabeçalho da data selecionada continuam visíveis.
- Planejamento dentro do cadastro de Eventos, em “Encontrar uma data”, fechado por padrão. Ao abrir ou ajustar público/duração/formato/período, buscar sugestões discretamente. Escolher uma apenas preenche início/término; publicar continua sendo uma ação explícita. Formato é uma preferência de busca, não um novo atributo persistido do evento. Não duplicar o seletor de público nem criar migração.
- Orpheu junto ao Diário de Classe na área de Instrutor. Endereço final corrigido pelo usuário: https://www.oinabn.com.br/orpheu. É um atalho; o serviço externo mantém seu próprio controle de acesso.

Fontes consultadas: conversa “Editar BPO + CRM”, documentação e código atual do repositório. As cópias locais iniciais estavam atrasadas. Implementação final em worktree baseado em origin/master b741af8, preservando a atualização concorrente do Mercúrio e da Escolástica.

## Verificação

- Build de produção, geração de tipos, TypeScript e ESLint passaram.
- Navegador Chromium, larguras 390 e 1365, dados fictícios e chamadas simuladas: três títulos + excesso, detalhes completos, links administrativos, navegação mensal, ordenação das atividades e indicação das passadas, formulário fechado inicialmente e aberto ao editar, sugestões automáticas, público/duração compartilhados, aplicação de início/fim e publicação não bloqueada pelo campo auxiliar. Sem erro JavaScript ou rolagem horizontal da página.
- Testes direcionados: activity-management, group-meetings e meeting-series passaram. events.test.mjs falha também no origin/master b741af8 sem estas alterações; comparado em worktree limpo.
- Sem publicação ou alteração de dados reais nesta etapa.
