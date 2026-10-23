# Aberturas de turma e gestão por secretaria

Entradas: Área do Voluntário → Abertura de turmas. Orientações, materiais e administração nacional/regional ficam **dentro de cada secretaria**, na opção Orientações e gestão. Não existe mais menu central Rede de Secretarias.

## Operação

1. A direção ou responsável pela secretaria Abertura de Turma cadastra o ciclo, a primeira aula, o dia semanal, sala, capacidade, meta e orçamento. A aula é semanal, com 120 minutos. A primeira data deve corresponder ao dia escolhido. Confirmar planejamento exige dois professores; rascunhos podem ficar incompletos.
2. Registre habilitação/disponibilidade explícita dos professores, sua validade e impedimentos. O comparador avalia todas as ocorrências na janela escolhida (até um ano), conflitos acadêmicos, outras turmas planejadas, eventos alcançados pela filial e escalas. Alternativas de dia/horário exigem confirmar os titulares. Vazio não significa livre. Substitutos são possibilidades, não convocação automática.
3. As secretarias cadastram escalas confirmadas ou previstas. Informe as funções necessárias e capacidade total da escola. Sem agenda ou cobertura confirmada, a comparação sinaliza pendências. O histórico por mês reúne o mesmo mês do ano em diferentes anos, com amostras informadas.
4. Cadastre palestras culturais antes da primeira aula, com tema, palestrante e vínculo opcional a evento existente; tarefas com responsáveis/prazos; despesas previstas/realizadas em reais. Itens do ciclo aparecem no calendário administrativo, sem criar inscrições públicas automaticamente.
5. Atualize o CRM e associe o código exato da turma Mercúrio. Matrículas só contam com unidade/turma e identidade acadêmica verificadas. A sincronização incorpora matrículas da turma entre 90 dias antes e 30 dias depois da primeira aula, com deduplicação por matrícula/data; nunca associa por nome ou mera proximidade de data. Presença em 30/60/90 dias é observação local explícita, não inferência de permanência.

## Avaliação compartilhada CRM/BPO

`js/propensao-modelo.js` no CRM e `src/lib/aberturas/propensao-modelo.js` no BPO devem permanecer idênticos (comparar SHA-256 ao publicar). Não há pontuação ou probabilidade individual. Inscrição, presença e resposta são contexto; não comprovam intenção de matrícula. O modelo separa interesse declarado, adequação à abertura e próxima ação. A preferência canônica de não contato prevalece sobre snapshots e sinais antigos. Mudança de dia/horário exige reconfirmar disponibilidade.

Sinais têm data, origem, natureza (declarado/observado/interpretado), responsável e contexto da abertura. Ao registrar um sinal, o BPO congela avaliação versionada e tenta transmiti-la ao CRM. Falha de integração fica visível e é retomável pelo botão; não presumir bloqueio CRM sem confirmação. O servidor de envio também reconfere a preferência canônica. Não há envio de mensagens neste módulo.

Avaliações anteriores às matrículas sustentam a análise; snapshots posteriores não são previsões. O relatório usa inicialmente janela de conversão de 30 dias após a primeira aula; ausência de matrícula só é classificada quando a abertura está concluída e a base cobre toda a janela. Ações registradas ajudam a interpretar efeitos do atendimento. Não atribuir causalidade a correlações.

O cron `/api/cron/aberturas` roda às 09:15 UTC (06:15 Brasília), protegido por CRON_SECRET. Atualiza filiais com aberturas planejadas/em curso/concluídas recentes, reaplica preferências e incorpora resultados. A data de transferência é separada da data oficial da base. Fonte defasada continua defasada após uma sincronização bem-sucedida. Rascunhos usam atualização manual.

## Aprendizado da rede

Compartilhamento é opt-in da filial. Agregados exigem amostra mínima; experiências por formato de ciclo/capacidade exigem três aberturas, dez interessados e duas escolas, com período acadêmico completo. Não são enviados nomes, contatos ou textos livres de interessados. Ideias e materiais têm publicação explícita na Rede de Secretarias, com público definido. Os dados iniciais não permitem afirmar qual é o melhor formato; os painéis aguardam evidência.

## Administração das secretarias

Administradores nacionais existentes atribuem mandatos por secretaria. Titulares nacionais daquela secretaria podem atribuir regionais; direção gerencia responsabilidades locais nas escolas que chefia. Estados e escolas são restrições cumulativas (interseção). Há biblioteca de materiais, avisos, reuniões, ideias e planos, versão e confirmação de leitura da versão atual. URLs de materiais devem ser HTTPS; não executamos HTML anexado. Definir responsáveis e prazos nos planos/encaminhamentos; nenhuma mensagem externa é disparada automaticamente.

## Segurança e publicação

Migração Prisma `20261023020000_aberturas_secretarias`; migrações CRM `migracao_propensao_crm.sql` e `migracao_propensao_tags_estado.sql`. Tabelas novas privadas/RLS, autorização por pessoa ativa/filial/secretaria em cada action, controle de revisão em alterações de abertura. Chave de serviço CRM fica no Vault BPO (`aberturas_crm_service_key`), acessada exclusivamente pelo servidor. Ponte CRM `bpo-aberturas` exige JWT de serviço verificado pelo gateway. Nunca colocar a chave no cliente.

As tags antigas derivadas são retiradas com backup privado. Novas tags refletem estado documentado; não existe tag global de compatibilidade com uma turma. Não reintroduzir Lead Forte, Jornada ou Retorno por contagem de inscrições em importações, filas de contato, tarefas ou notificações.

## Ajuste de organização — 23/10/2026

Cada secretaria tem seu próprio espaço e administradores nacional, regional e local. Um mandato nacional de Economia não autoriza Abertura de Turma, e vice-versa. O território limita o administrador regional; o mandato não concede automaticamente acesso a dados financeiros locais. Economia, Escolástica, Eventos, Café e Abertura oferecem Orientações e gestão na própria página; demais secretarias usam sua página própria/grupo. O endereço central antigo só redireciona por compatibilidade. Conteúdos e mandatos existentes foram preservados, com filtragem por secretaria no servidor antes de montar o payload.
