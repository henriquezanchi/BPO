# Eventos internos e fontes externas

## Operação da escola

- Criar em **Painel da Direção → Gestão de Eventos**. Somente diretor ou subchefe ativo da própria escola. Eventos internos pertencem à filial; não concedem administração nacional.
- Definir nome, início/término, local, descrição, contribuição e público. O público usa dados reais do cadastro: todos ativos, membros do programa, provacionistas, voluntários liberados ou direção. Janos consultam, mas não se inscrevem.
- A Agenda exibe e a inscrição revalida o mesmo público no servidor. Público de membros exige `isMembroPrograma` confirmado no cadastro.
- Contribuição zero confirma inscrição sem cobrança. PIX pago só é emitido com carteira da escola para o split já configurado no Portal. Sem carteira, bloqueia. Preço fica fixo após a primeira inscrição. Confirmação depende de gateway real, não de clique ou cópia do PIX.
- Designar equipe no próprio evento. Apenas voluntários ativos e com acesso liberado da escola. O link **Abrir lista e recepção** exige login e designação; não é um link público e não libera o painel financeiro.
- Recepção busca em toda a lista recebida, filtra pagamento/presença, exporta CSV e confere presença a partir de duas horas antes do evento. Pendência financeira precisa ser conferida pela Economia; não se transforma em pagamento por marcar presença.
- **Meus eventos**, no Portal, reúne inscrições e participações. Presença conferida também entra na Jornada. Resposta do próprio aluno após o evento é identificada como declaração e não confirma presença oficial.
- Cancelar preserva inscrições, pagamentos e auditoria. Não há estorno automático; conferir com a Economia. Participante vê cancelamento na Agenda e em Meus eventos.

## Estados que não devem ser apresentados como concluídos

- Lembretes de inscrição, véspera, uma hora antes e consulta após o evento são preparados em `EventNotice`, com estado `aguardando_canal`. Cancelamento também prepara aviso. Ainda não há remetente nem agendador de WhatsApp em produção; a autorização para receber mensagens e o provedor real precisam ser configurados antes do envio. Não usar o CallMeBot técnico como remetente dos alunos.
- `mercurioStatus=aguardando_integracao` significa exatamente isso: o Portal guarda o registro e a auditoria, mas não executa lançamento no Mercúrio. Não existe confirmação fictícia nem automação de escrita para uma tela ainda não validada.
- Não há coleta de localização nesta versão. A localização atual enviada depois do evento não comprova presença passada. Eventual sinal de chegada deve ser opcional, informado e revisado pela recepção; não implementar rastreamento em segundo plano.

## Ulisses: reaproveitamento do cliente oficial existente

Fonte primária: usuário confirmou o Swagger em https://api.acropolebrasil.com.br/swagger-ui/index.html. O contrato utilizado vem de `CRMNovaAcropole/scraper/ulisses-api.js` e `importar-ulisses-api.js`, que já autenticam com Auth0 e leem catálogo/detalhes. Os comentários desse cliente registram bloqueio por Cloudflare em IPs de servidores: executar no ambiente confiável já usado pelo CRM, sem contornar controles.

Preparado `scripts/sync-ulisses-events.ts`, com o adaptador em `src/lib/ulisses/events.ts`. O cliente oficial autentica; credenciais não são copiadas para o Portal/browser. Requisitos locais:

- `ULISSES_CLIENT_MODULE`: caminho absoluto do cliente existente `CRMNovaAcropole/scraper/ulisses-api.js`.
- `ULISSES_SCHOOL_MAP`: JSON de **School.id do Portal → filialId numérico do Ulisses**, validado por quem administra as filiais. Não deduzir por nome. O cliente mantém as próprias credenciais seguras já existentes.
- Entregar ao job as credenciais existentes do CRM pelos nomes separados `CRM_SUPABASE_URL`, `CRM_SUPABASE_SERVICE_ROLE_KEY` e `CRM_CREDENCIAIS_SCRAPER_CHAVE`, usando suas configurações seguras. O script recusa o projeto Portal como origem dessas credenciais. Não reutilizar a chave do Portal nem copiar valores para arquivos de código.
- Configuração PostgreSQL do Portal no ambiente executor. Executar, no checkout do Portal: `node --import tsx scripts/sync-ulisses-events.ts`.

A sincronização usa `listarTodosEventos` e `evento`, lê `filiaisEventos[].produtos[]`, preserva sessões, usa identificador externo estável e respeita cancelamento explícito. Ausência numa resposta parcial não apaga o catálogo. Não importa participantes nem altera inscrições pela API. Inscrição externa abre `linkFinal` no organizador; abrir esse link não cria confirmação no Portal. Valores externos não são cobrados pelo Portal.

Ainda não foi executado import real neste ambiente: domínios oficiais foram bloqueados pela política de rede. Foi salvo um rascunho aditivo com `api.acropolebrasil.com.br`, `acropolebrasil.us.auth0.com`, `eventos.acropolebrasil.com.br` e `inscricao.acropolebrasil.com.br`. Publicação desse rascunho é diferente de publicar o aplicativo. Não há tarefa agendada de sincronização instalada aqui. A rotina deve entrar no agendamento já usado na máquina autorizada, depois do primeiro teste de catálogo.

## Ágora e registro no Mercúrio: contrato a confirmar

Ágora: https://eventos.acropolebrasil.com.br/. Não foi encontrada documentação de API no material disponível e a leitura do domínio foi bloqueada. Eventos de fonte `agora` permanecem bloqueados no filtro do Portal até termos o mapeamento oficial; papel desconhecido nunca vira acesso geral.

Solicitar aos responsáveis:

1. API e autenticação de leitura do catálogo; IDs estáveis, datas/fuso, cancelamentos, paginação e atualização incremental.
2. IDs oficiais de papéis, território e elegibilidade; como relacionar cada pessoa ao cadastro oficial. Restrições devem ser verificadas no servidor, tanto na lista quanto na inscrição.
3. Link oficial ou sessão delegada de inscrição, perguntas obrigatórias por evento, confirmação/cancelamento e eventual webhook. Confirmar autorização e cabeçalhos antes de incorporar formulário em iframe. Nunca guardar senha do aluno nem imitar login.
4. Para Mercúrio: campo/tipo oficial para participação e contribuição de evento, vínculo por matrícula e evento, tratamento de correções/cancelamentos e identificação única de lançamento. Confirmar se o destino é atividade, curso de integração ou outro registro; não presumir equivalência.

## Verificação

Testes usam dados fictícios e bloqueiam chamadas externas. Foram exercitados público, autorização, falta de split, prevenção de nova cobrança em processamento, presença/declaração separadas, cancelamento e adaptação do contrato Ulisses. Não foram criados eventos reais, emitidos PIX reais ou enviadas mensagens nos testes.

Webhook Asaas exige `ASAAS_WEBHOOK_TOKEN`; sem configuração responde 503. Pagamento de evento é conferido no gateway e pelo valor persistido antes de confirmar. A consulta autenticada do aluno continua como alternativa. Configuração real do Asaas/split precisa ser verificada pela escola antes de anunciar cobrança disponível.

## Publicação desta etapa

Migração aditiva `20261019100000_eventos_internos` aplicada ao projeto do Portal, com checksum registrado e RLS conferida nas cinco tabelas de eventos. Validada previamente em PostgreSQL local. 39 testes automatizados passaram, assim como tipos, lint e build. Telas exercitadas em 414 e 1365 pixels; testes usam dados fictícios e interceptam chamadas de escrita. Conferência de operação com sessão real, cobrança real e integração externa ainda não foi realizada.

Vocabulário: o Portal apresenta Grupo Feminino/Masculino/de Segurança e cargos equivalentes. A conversão de apresentação não modifica os códigos oficiais usados na autorização.
