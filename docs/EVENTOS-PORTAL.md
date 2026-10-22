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

## Diagnóstico do erro ao gerar PIX

O erro reportado na tela foi investigado sem emitir cobranças: split da escola configurado, uma inscrição em `revisao`, sem identificador de cobrança nem QR persistidos. Isso não comprova ausência de cobrança no gateway. O tratamento anterior descartou a causa técnica; não apagar a inscrição ou liberar outra cobrança com base somente nesse estado.

Inscrição agora retorna resultado estruturado, preservando mensagens de negócio em produção. Pré-condições de gateway/taxas são verificadas antes da reserva de cobrança. Falha anterior ao POST retorna ao estado de nova tentativa; resposta incerta posterior ao POST permanece em revisão. Identificação do cliente é persistida antes do POST. Falhas registram etapa, código e status HTTP em auditoria, sem copiar o corpo do gateway, CPF ou credenciais. PIX existente é recuperado sem outra emissão.

Sem `ASAAS_API_KEY` no servidor, a Agenda e a Direção mostram configuração pendente. Isso não prova que a chave esteja ausente no Vercel; a disponibilidade desse ambiente não foi inspecionada. Para conferir o Asaas diretamente, falta disponibilizar a credencial nas configurações seguras do ambiente de trabalho, que atualmente só tem credenciais Supabase. Salvo requisito `ASAAS_API_KEY` com destino `api.asaas.com`. Não solicitar valores no chat.

## Cartaz, vagas e equipe em lote

Eventos internos aceitam cartaz JPG/PNG/WebP até 3 MB, prazo de inscrição, capacidade opcional, orientações e contato. Cartazes ficam em bucket privado `event-posters`, com assinatura de leitura por uma hora, emitida somente nas consultas autorizadas. Upload valida assinatura do arquivo, formato, tamanho, sessão ativa e Direção. O caminho é derivado da escola autenticada e reconferido ao salvar.

Inscrições pendentes também reservam vaga. A transação trava a revisão do evento e confere capacidade/prazo antes de criar nova inscrição; reabrir uma inscrição existente não consome outra vaga. Não reduzir capacidade abaixo do total já reservado. O público vê vagas disponíveis e encerramento. Não há expiração automática de reservas financeiras nessa etapa.

Seleção de recepção agora usa caixas de marcação, busca e inclusão em lote. A lista é formada por voluntários ativos com acesso liberado; o servidor reconfere todos antes de incluir qualquer pessoa.

A importação anterior de Google Calendar foi desativada por padrão e retirada do filtro da Agenda. Em 19/10/2026 foram arquivados os 870 registros dessa fonte sem inscrições; originais e auditoria foram preservados. Eventos manuais e pagamentos existentes não foram removidos. A migração `20261019190000_eventos_cartaz_vagas` foi aplicada.

Verificações: testes automatizados de capacidade, prazo, equipe, arquivo e autorização; cenários de navegador em celular e computador; build, tipos e lint. Storage real foi testado com imagem descartável removida ao final: upload, leitura assinada e bloqueio de acesso público. Nenhum cartaz ou evento real foi criado durante o teste.

## Compartilhar eventos públicos

O painel de canais e artes atende aos eventos do Ulisses (`source="ulisses"`), publicados, com link de inscrição e ainda por acontecer. O atalho do WhatsApp nos cartões também permite compartilhar eventos internos: leva descrição completa, data, local, valor/gratuidade e orientações disponíveis. O endereço `/portal?evento=<id>` abre a Agenda com o evento em destaque, preserva o destino após o login e respeita o público permitido na agenda do membro. Um evento indisponível exibe aviso, sem buscar dados fora dessa agenda.

O atalho do WhatsApp abre uma prévia da arte: usa o cartaz disponível e gera um PNG com a identidade da escola quando não há cartaz ou ele não carrega. A arte inclui título, data e local; no modelo interno, valor/gratuidade. O convite completo segue como texto junto do arquivo, sem ser desenhado na arte do WhatsApp. A prévia mostra esse texto e permite copiá-lo; ao compartilhar ele também vai para a área de transferência, caso o aplicativo descarte a legenda. No celular, usa o compartilhamento nativo com arquivo e convite; sem suporte, baixa a imagem e abre o WhatsApp com o texto para anexar. Também permite baixar a imagem ou enviar só o convite. A geração ocorre no navegador, sem API de IA, armazenamento ou cobrança por imagem. A limpeza do texto remove emojis, caracteres de substituição `�` e substitutos Unicode isolados antes de montar o link.

- WhatsApp, Telegram, Facebook e e-mail abrem o aplicativo (ou a versão web no computador) com o texto já montado no formato de cada canal, terminando no link oficial de inscrição.
- Instagram não aceita postagem por link. No celular, o botão abre a folha de compartilhamento já com a arte no tamanho certo (story 1080×1920 ou feed 1080×1350), e a pessoa escolhe o Instagram. A legenda (feed) ou o link (story, para o adesivo "Link") vai copiado. No computador, a arte é baixada e o site do Instagram abre.
- A arte é desenhada no navegador, com logo, cores e fonte da marca. Nada é enviado ao servidor.

## Importação dos eventos públicos do Ulisses em nuvem (19/10/2026)

As rotas públicas da API do Ulisses respondem sem credencial: `GET /eventos/{filialId}` (catálogo público da filial) e `GET /evento/{id}` (detalhe com sessões, imagem e link de inscrição). São as mesmas que alimentam o site de eventos. A importação usa só essas rotas (`src/lib/ulisses/publico.ts`), roda na Vercel uma vez por dia (`vercel.json`, rota `/api/cron/ulisses`, protegida por `CRON_SECRET`) e não usa a credencial do CRM. As rotas `/facade` (participantes, inscrições) continuam exigindo a credencial e ficam fora do Portal.

- `School.ulissesFilialId` liga cada escola à filial no Ulisses. O id não é o código do Mercúrio: Barra do Garças = 44 (`bdg`), Sede Central = 7 (Lago Norte, `bsb`). As 7 escolas do Portal foram conferidas pelo `codigoEscola` do catálogo público de cada filial (migração `20261019200000_ulisses_publico`). Escola nova precisa receber o id.
- Evento com `publicar=false` não entra. Item do catálogo cujo detalhe responde 400/404 é pulado sem derrubar a filial. Evento que sai do catálogo público vira `arquivado` (some da Agenda); falha de rede não arquiva nada.
- A imagem oficial do evento (`Event.imageUrl`) aparece na Agenda quando não há cartaz próprio.
- A API não cria inscrição: a Agenda abre o link oficial (`linkFinal`), que pode ser o formulário do Ulisses, Sympla ou Tickets do Bem.

**Teste em nuvem (19/10/2026):** a chamada pela Vercel recebeu 403 do Cloudflare em todas as filiais; daqui (rede residencial) funciona. Enquanto não houver exceção no Cloudflare da Acrópole Brasil para essas rotas, a Agenda lê o catálogo público **no navegador do aluno** (`src/lib/ulisses/navegador.ts`). A API responde `Access-Control-Allow-Origin: *`, a mesma forma de uso do site de eventos. Nada vindo do navegador é gravado no banco: cada pessoa só vê o que o próprio navegador leu. O catálogo fica 6 horas em cache no aparelho. A rota diária `/api/cron/ulisses` continua agendada: no dia em que a exceção existir, ela passa a gravar os eventos, e os do banco têm prioridade sobre os do navegador. Os 10 eventos gravados no teste local foram arquivados, sem inscrições.

**Pedido para a Acrópole Brasil (Célio):** regra de exceção no Cloudflare para `GET /eventos/*` e `GET /evento/*` em `api.acropolebrasil.com.br` (dados já públicos), por cabeçalho próprio ou pela origem do Portal. A Vercel não tem IP fixo; o Railway tem IP de saída fixo no plano Pro, se preferirem liberar por IP.

## PIX de valor baixo: split acima do permitido (corrigido em 19/10/2026)

Erro real do Asaas na inscrição de R$ 5,00: "O valor total do Split R$ 4,90 excede o valor a receber da cobrança R$ 4,01". O split da escola (98%) não descontava a taxa quando o PIX saía isento pelos créditos do mês, mas o Asaas valida contra "valor − taxa" mesmo assim. `calcularSplitEscola` agora limita o repasse a `valor − taxa`. Só afeta valores em que 2% fica abaixo da taxa (menos de ~R$ 50). O cliente e o CPF estavam corretos.

## Cabeçalho combinado com Célio (19/10/2026)

Célio orientou enviar `X-Portal-NA: bypass` nas duas rotas públicas e avisou que a regra do Cloudflare ainda precisaria ser ajustada. O importador do servidor agora envia exatamente esse cabeçalho em `GET /eventos/{filialId}` e `GET /evento/{id}`. A leitura no navegador permanece sem cabeçalho adicional, evitando preflight CORS desnecessário. Não usa token do CRM nem acessa participantes/inscrições.

Teste somente leitura no ambiente de trabalho: catálogo `/eventos/44` com o cabeçalho respondeu HTTP 200, JSON válido e sete itens. Isso confirma a resposta neste ambiente, não a liberação da origem Vercel. Ainda é preciso publicar a alteração e verificar a sincronização pela própria Vercel antes de declarar a integração em nuvem liberada.

## Cancelamento com reembolso e relatório da Economia (19/10/2026)

Implementação de 19/10/2026: a Direção pode marcar **Reembolsar as inscrições** no cancelamento. A escolha é persistida junto do cancelamento. A API não devolve pagamentos de eventos antigos apenas pela instalação: `refundOnCancellation` começa falso. Eventos sem essa opção continuam sem reembolso automático.

Uma inscrição é processada de imediato; o restante e a conciliação seguem em lotes de até 20, pela rota autenticada `/api/cron/event-refunds`, agendada a cada cinco minutos no `vercel.json` (exige plano Vercel que aceite essa frequência e `CRON_SECRET` já usado pelo Ulisses). Cada tentativa tem trava por inscrição e prazo. O lote interrompe novas operações antes do limite da função. Webhooks `PAYMENT_REFUND*` e confirmação de pagamentos também disparam a conciliação, sempre consultando o Asaas, sem confiar no status recebido no corpo do webhook.

Consulta a cobrança original e seu valor antes de qualquer movimentação. Cobrança pendente é excluída com confirmação, sem alegar que houve devolução. Recebimento posterior ao cancelamento entra novamente na fila. Devolução integral usa `POST /payments/{id}/refund` sem `value`; se já houver devoluções parciais concluídas, solicita somente o restante. Split é tratado pelo próprio Asaas. O valor original e os recebimentos anteriores não são apagados.

Somente itens `refunds[].status=DONE` contam como devolvidos. O histórico de todos os estornos é preservado, incluindo os splits. Split ainda não concluído continua em acompanhamento mesmo após o participante estar reembolsado. Falta de saldo ou rejeição inequívoca gera pendência visível e nova tentativa com espera progressiva. Timeout ou resposta incerta do POST mantém um marcador persistente: as próximas execuções só consultam a cobrança, sem repetir o pedido de devolução. Se o Asaas não esclarecer a operação, a pendência aparece para a Economia; nunca é declarada concluída por ausência de resposta.

O membro vê a situação do reembolso na Agenda, no evento cancelado. O relatório está em **Economia → Eventos: recebimentos e lançamentos no Mercúrio** (`/economia/eventos`), também acessível pelo painel da Direção. Acesso restrito à Economia/Direção ativa da própria filial. Datas usam Brasília. Paginação de 50, CSV dos registros carregados, neutralização de fórmulas de planilha, valores originais/devolvidos, cobrança Asaas, matrícula, presença conferida e declaração do participante separadas. Os totais se referem aos registros selecionados; não são um extrato do saldo da subconta nem estimativa de líquido após taxas. O caixa configurado é mostrado; rubrica e demais classificações precisam ser conferidas no Mercúrio.

Depois do lançamento manual, a Economia informa o recibo ou referência no relatório. A ação registra autor, data e referência anterior na auditoria. É uma declaração do responsável, sem afirmar que o Portal escreveu ou conferiu o lançamento no Mercúrio. Reembolso confirmado destaca a necessidade de conferir também o estorno/ajuste do recibo.

Migração aditiva `20261019220000_eventos_reembolsos_relatorio` aplicada em produção, com checksum em `_prisma_migrations`, sem nova tabela e com RLS preservada nas existentes. Conferência após aplicação: zero eventos com reembolso ativado e zero inscrições enfileiradas. Nenhum pedido de reembolso real foi feito como teste. Validação: 21 arquivos de testes automatizados, migração em PostgreSQL local com dados preexistentes, tipos, ESLint, build de produção e navegador em 414/1365 pixels para cancelamento e relatório.

Contrato consultado: [estornar cobrança](https://docs.asaas.com/reference/estornar-cobranca), [interpretação de estornos](https://docs.asaas.com/docs/estornos) e [split](https://docs.asaas.com/docs/split-de-pagamentos). O Asaas pode exigir saldo suficiente e as taxas originais do PIX não são necessariamente devolvidas. O participante recebe o valor integral; custos/pendências da operação não são silenciosamente descontados dele.

O nome no PIX é o da conta emissora. Para aparecer a filial, novas cobranças precisam ser criadas com a credencial da subconta dela e o split deve direcionar a margem do BPO à carteira do BPO. Isso exige definir a carteira de destino, acompanhar cada cobrança pela conta que a emitiu e ajustar webhooks. Esta entrega não muda a conta emissora de cobranças existentes nem cria subcontas. Os dados cadastrais das filiais podem ser obtidos pela rotina nacional do Mercúrio já existente; não substituir informações faltantes por valores inventados para abrir conta financeira.

## Público com vários grupos e inscrições de outras filiais (19/10/2026)

- **Públicos (marque um ou mais):** Todos os ativos, Membros, FV, Provacionistas, HD, Dirigentes. "Membros" = 2º nível em diante e inclui FV, HD, dirigentes e provacionistas; quem é do 1º nível só entra em "Todos os ativos". Quem não está no público não vê o evento nem consegue se inscrever (conferido no servidor).
- **Abertura:** só a filial, todas, filiais escolhidas, regionais (Centro-Oeste: GO/MT/MS; DF; Nordeste: MA/PI/CE/RN/PB/PE/AL/SE/BA; Norte: AC/AM/AP/PA/RO/RR/TO) ou estados. O público vale também para as outras filiais; o pagamento vai para a filial dona. Na Agenda, o evento aparece como "EVENTO DE <filial>".
- Nível, HD (cad_machado HDA/HDR), dirigente (cad_dirigente) e FV (cad_situacao_fv BRG) vêm do Mercúrio na sincronização diária.


## Visibilidade do Ulisses e categorias — conferência em 22/10/2026

A importação grava `publicos=["todos_ativos"]`, além do campo legado `audience`. A migração `20261022210000_ulisses_public_audience` corrige somente eventos Ulisses publicados, recentes/futuros, com público vazio e audience todos_ativos. Aplicada via Management API: os 11 eventos futuros publicados ficaram com público explícito. A consulta da Agenda exige a escola correspondente para source ulisses mesmo se algum registro estiver com escopo global/abertura externa. O normalizador só cria ocorrências das filiais participantes indicadas pelo Ulisses; catálogo/browser compartilham a exclusão de cópias e não exibem ocorrências canceladas.

O endpoint oficial `GET https://api.acropolebrasil.com.br/tiposEvento` respondeu 200 com: ABERTURA_DE_TURMA, CURSO_LIVRE, LISTA_DE_ESPERA, LIVE, PALESTRA_CULTURAL, CHAT_WHATSAPP, OUTRO. Não confundir com o catálogo customizado tipos_evento do CRM.

Proposta para o cadastro interno: Aula inaugural/abertura de turma; Curso; Palestra; Oficina/workshop; Live/encontro online; Integração/confraternização; Serviço/voluntariado; Celebração/comemoração; Outro. Lista de espera e chat não são propostos como categorias internas. Este catálogo é uma proposta, ainda não um novo campo no cadastro.

## Documentação oficial do Ágora — evidência atual

O endereço fornecido é `https://eventos.acropolebrasil.com.br/#/swagger`. A aplicação Angular respondeu 200 e aponta para `/swagger-ui/index.html`; a rota verifica login. O Swagger UI e `/v3/api-docs` responderam 403 do backend com sessão JSESSIONID. A documentação OpenAPI completa não pôde ser lida sem acesso autorizado. Os caminhos com prefixo `/api` para a documentação receberam bloqueio Cloudflare Error 1010.

O JavaScript público oficial confirma base `/api`, consulta `/eventos` (idSede, ini, fim, situacao, parteNome), `/eventos/periodo`, `/eventos/{id}`, `/eventos/slug/{slug}`, `/eventos/by-ids` e `/sedes`; o destino de inscrição é `/e/{slug}`. O frontend usa sessão e SSO (`/csrf`, `/usuarios/usuario-logado`, `/sso-url`, `/login-sso`), não foi encontrada credencial de serviço disponível neste ambiente. Essas observações de frontend não substituem o contrato OpenAPI nem provam as permissões da API de consulta.

O importador do Ágora continua pendente do contrato autenticado e do mapeamento oficial de sede/público. A fonte permanece bloqueada por padrão na Agenda; não se deve inferir elegibilidade nem reutilizar o ID de filial Ulisses como ID de sede Ágora sem confirmação. Não criar um importador de produção com campos ou acesso presumidos.
