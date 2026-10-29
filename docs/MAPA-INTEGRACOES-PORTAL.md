# Sistemas e integração ao Portal

Informações fornecidas por Henrique em 23/10/2026. Este documento descreve destino e regras desejadas; não afirma que as integrações estão concluídas.

| Sistema | Finalidade | Público / área proposta |
|---|---|---|
| Orpheu | Apoio aos professores: videoaulas com docentes experientes, apostilas comentadas, slides-modelo, materiais de palestras. | Atalho na área do instrutor: https://www.oinabn.com.br/orpheu (endereço confirmado em 25/10/2026). A autenticação e a autorização continuam no Orpheu. |
| Perseu | Difusão: identidade visual, logomarcas, materiais gráficos e apoio à divulgação. | Área de voluntários / Difusão. Um acesso por escola, compartilhado com pessoas autorizadas pelo diretor, como no Ulisses. Não expor credenciais coletivas ao navegador. |
| Bastiões | Artigos mensais históricos do diretor internacional e livros em PDF; futura biblioteca digital. | Área de estudos, apenas membros. Substituir destino da biblioteca digital quando confirmada URL. Acesso direto via SSO Keycloak, preservando autorização do destino. |
| Arjuna | Cadastro e acompanhamento de provacionistas de FV. | Chefia e pessoas explicitamente autorizadas pelo chefe da filial. Ser FV não concede acesso por si só. |
| Atlas | Acompanhamento quantitativo histórico: membros, provacionistas, voluntários GS/GF/GM, escolas, proporções e professores/dirigentes/HDs; filtros por região, estado, unidade e período. | Gestão; confirmar escopos de acesso por função/território. Não interpretar o recorte de um print como total do Brasil. |
| Biblioteca Alexandria | Bastiões, catálogo físico por filial, empréstimos, multas e juros. | Biblioteca. Migração do acervo digital para Bastiões não implica que empréstimos físicos estejam substituídos. |
| Acropolis Inn | Plataforma de hospedagens; prints mostram catálogo, mapa, preços, mensagens e viagens. | Destino futuro a definir. Rodapé do print identifica demo de portfólio; reservas/pagamentos reais, públicos e disponibilidade precisam de confirmação. |

## Acesso unificado

O Portal já usa Keycloak (realm oinabnb, client portal-aluno) e ponte de comunicação para chamadas de servidor. A ponte não substitui a sessão de navegador de outro aplicativo. Acesso sem nova senha depende de cada sistema estar integrado ao mesmo SSO e das permissões da pessoa. Não transportar tokens em URLs nem compartilhar sessão de administrador.

## Bastiões: endereço confirmado

Endereço oficial confirmado pelo usuário em 29/10/2026: https://bastiao.oinabn.com.br/. É o botão "Bastiões" da Área de Estudos (src/components/member/panels/study-area-panel.tsx), só para membros. "Acessar Biblioteca" leva a https://biblioteca.acropolebrasil.com.br/. Pendente apenas investigar o redirecionamento SSO do destino.
