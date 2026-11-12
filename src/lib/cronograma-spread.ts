import type { AcaoCronograma, Registro } from "@/lib/cronograma-spread-comum";
import { db } from "@/lib/db";

export { SITUACOES, type AcaoCronograma, type Situacao } from "@/lib/cronograma-spread-comum";

/**
 * Cronograma da cobrança com spread (pedido do usuário 12/11/2026: "quero uma página de internet, não um artefato").
 * Fica em /admin/cronograma, só para o dono do sistema. Os dados ficam numa linha de ResumoNacional (JSON), sem tabela
 * nova; o conteúdo inicial vem de docs/CRONOGRAMA-SPREAD-ASAAS-2026-11.md, já com as respostas do usuário de 12/11.
 */
export const CHAVE_CRONOGRAMA = "cronograma:spread";

const R = (texto: string): Registro => ({ em: "2026-11-12", texto });
const a = (id: string, fase: string, inicio: string, fim: string, acao: string, pessoas: string, materiais: string[], duracao: string, dias: number, extra: Partial<AcaoCronograma> = {}): AcaoCronograma => ({
  id, fase, inicio, fim, status: "afazer", acao, pessoas, materiais: materiais.join("\n"), duracao, dias, obs: "", registros: [], ...extra,
});

const S0 = "Semana 0 — decisões";
const S1 = "Semana 1 — contato e contas";
const DEV = "Desenvolvimento no Portal";
const S2 = "Semana 2 — aprovação e testes";
const S3 = "Semana 3 — materiais e treino";
const S4 = "Semana 4 — lançamento";
const DJ = "Dezembro e janeiro — acompanhamento";

const FILIAIS = "GYN, JAM, STO, GAR, BSB e as escolas de Goiás escolhidas";

export const CRONOGRAMA_INICIAL: AcaoCronograma[] = [
  a("a01", S0, "2026-11-12", "2026-11-12", "Definir o que é a Sede Nacional", "Henrique", [], "1 dia", 1, {
    status: "feito", obs: "Sede Nacional = filial Brasília (BSB).", registros: [R("Decidido: Sede Nacional é a filial Brasília (BSB).")],
  }),
  a("a02", S0, "2026-11-13", "2026-11-13", "Escolher quais escolas de Goiás entram", "Henrique", [
    "Ativos no Mercúrio em 12/11:",
    "Anápolis (APS) 121 · Catalão (CAT) 31 · Rio Verde (RVD) 130, Portal aberto",
    "Goiânia: Alto da Glória (ALT) 41 · Cidade Jardim (PER) 39 · Eldorado (ELD) 40 · Goiânia II (GY2) 47",
    "Já no escopo: Universitário (GYN) 322 · Jardim América (JAM) 303 · Setor Oeste (STO) 61 · Garavelo (GAR) 35",
    "Itumbiara (ITU) 2 · Valparaíso (VAL) 28",
  ], "1 dia", 1, { status: "andamento", obs: "A lista define a faixa do spread (mais membros, taxa média menor)." }),
  a("a03", S0, "2026-11-12", "2026-11-12", "Definir o percentual do spread", "Henrique, Diretor Nacional", ["Proposta de 23/10/2026"], "1 dia", 1, {
    status: "feito",
    obs: "Faixas progressivas pelo total de membros das aderentes (até 500: 2% · 501–1.500: 1,5% · 1.501–3.000: 1% · 3.001–5.000: 0,75% · 5.001–10.000: 0,5% · acima: 0,25%), só sobre o que passa pelo Portal. Fixo de R$ 3.000/mês abatido pelo spread. Com o escopo atual (1.200 membros), média ≈ 1,71%.",
    registros: [R("Decidido conforme a proposta de 23/10 e a conversa com Ana Beatriz de 05/11.")],
  }),
  a("a04", S0, "2026-11-12", "2026-11-12", "Definir quem paga a taxa do Asaas", "Henrique, Diretor Nacional", [], "1 dia", 1, {
    status: "feito", obs: "Pix: sai da parte da escola. Cartão: repassado ao aluno.", registros: [R("Mantida a regra atual.")],
  }),
  a("a05", S0, "2026-11-13", "2026-11-19", "Minuta do termo de adesão das escolas", "Henrique, Advogado ou jurídico, Diretor Nacional (revisão)", [
    "Faixas do spread e fixo abatido", "Regra da taxa do Asaas", "Cláusula de uso da chave de API e revogação", "Prazo de ~1 ano e transferência do suporte",
  ], "3 a 5 dias úteis (com revisão jurídica)", 4),
  a("a06", S0, "2026-11-13", "2026-11-27", `Pedir login do scraper com acesso a ${FILIAIS} (baixa no Mercúrio)`, "Henrique, João Guilherme (Mercúrio)", [
    "Lista das filiais e siglas", "Plano B: tesouraria dá a baixa enquanto isso",
  ], "2 a 10 dias úteis (depende do Mercúrio)", 5, { status: "bloqueado", obs: "Bloqueia o lançamento fora de Barra do Garças." }),
  a("a07", S0, "2026-11-13", "2026-11-13", "Escrever a mensagem de apresentação às escolas e a lista de documentos", "Henrique, Claude (rascunho)", [
    "O que muda e o que a escola ganha", "Lista de documentos do Asaas", "Termo de adesão (quando pronto)",
  ], "1 dia", 1),
  a("a08", S0, "2026-11-13", "2026-11-17", "Barra do Garças (piloto): liberar o Pix Automático e testar com 1 ou 2 pessoas da direção", "Henrique, Claude, 2 membros da direção de BGA", [
    "PIX_AUTOMATICO_UNIDADES=BGA na Vercel", "Celulares com app de banco que aceite Pix Automático",
  ], "1 a 2 dias", 1.5),
  a("a09", S1, "2026-11-16", "2026-11-19", `Ligar para cada direção (${FILIAIS}) e enviar mensagem e termo`, "Henrique, Ana Beatriz Pignataro (BSB), Chefes de filial, Tesoureiros", [
    "Mensagem de apresentação", "Termo de adesão", "Lista de documentos",
  ], "30 min por escola; 2 a 3 dias para falar com todos", 3, { obs: "20/11 é feriado nacional." }),
  a("a10", S1, "2026-11-16", "2026-11-19", "Separar as escolas: \"já tem conta Asaas\" ou \"não tem\"", "Henrique, Tesoureiros", ["Planilha: escola, CNPJ, tem Asaas, responsável legal"], "1 dia", 1),
  a("a11", S1, "2026-11-17", "2026-11-19", "Criar as subcontas Asaas das escolas que não têm conta", "Claude (script), Henrique (aprovação)", [
    "CNPJ e razão social", "E-mail e celular da escola", "Endereço", "Faturamento mensal estimado", "Dados do responsável legal",
  ], "1 dia depois de receber os dados", 1),
  a("a12", S1, "2026-11-17", "2026-11-24", "Enviar o link de documentos e selfie ao responsável legal de cada escola", "Henrique, Responsável legal de cada escola", [
    "Documento com foto", "Selfie pelo celular", "Estatuto e ata da diretoria ATUAL", "Comprovante de endereço", "Conta bancária da associação (saque)",
  ], "20 min para enviar; 2 a 7 dias para juntar os documentos", 5, { obs: "Recusa mais comum do Asaas: ata da diretoria vencida." }),
  a("a13", S1, "2026-11-16", "2026-11-19", "Abrir no Portal Setor Oeste e Garavelo, completar a importação de Jardim América e abrir as escolas de Goiás escolhidas", "Claude, Henrique (autorização)", [
    "Siglas no Mercúrio", "Mesmo processo de Fortaleza (logins sem envio de e-mail)",
  ], "1 dia por filial", 2),
  a("a16", S1, "2026-11-16", "2026-12-05", "Campanha em Barra do Garças: os 31 ativos autorizarem o Pix Automático até 05/12", "Henrique, Chefe de filial BGA, Tesoureiro BGA", [
    "Mensagem no WhatsApp das turmas", "Cartaz provisório", "Aviso em aula",
  ], "2 a 3 semanas para a maioria aderir", 12, { obs: "Assim o ciclo de 10/12 já roda sozinho." }),
  a("a36", DEV, "2026-11-16", "2026-11-24", "Spread por faixas e fatura do fixo abatido (T11)", "Claude, Henrique (conferência)", [
    "Contagem mensal de membros ativos das aderentes", "Taxa média pelas faixas no split", "Fatura do fixo = máx(0, 3.000 − spread do mês)", "Demonstrativo por escola",
  ], "3 a 4 dias úteis", 3.5, { obs: "Hoje o código cobra 2% fixo (PERCENTUAL_SPLIT_ESCOLA = 98)." }),
  a("a14", DEV, "2026-11-16", "2026-11-27", "Construir o modo guiado por QR code (/pagar)", "Claude, Henrique (testes)", [
    "Roteiro das telas do tutorial", "QR por filial com origem=patio", "Usuário de teste",
  ], "5 a 7 dias úteis", 6),
  a("a15", DEV, "2026-11-16", "2026-12-02", "Construir o cartão de crédito recorrente com split", "Claude, Henrique (testes)", [
    "Conta sandbox do Asaas", "Taxa do cartão repassada ao aluno", "Tela de trocar e cancelar cartão",
  ], "5 a 8 dias úteis", 7),
  a("a21", DEV, "2026-11-23", "2026-11-27", "Conferência diária do split no painel de saúde", "Claude", ["Comparar pagamentos com splits recebidos por escola"], "2 a 3 dias úteis", 2.5),
  a("a22", DEV, "2026-11-23", "2026-11-27", "Completar as notificações: débito ativado, feito, falhou, autorização cancelada, cartão recusado", "Claude, Henrique (textos)", [
    "Textos das mensagens", "Modelos de WhatsApp aprovados pela Meta (24 a 48 h cada)",
  ], "3 dias úteis", 3),
  a("a17", S2, "2026-11-23", "2026-11-24", "Cobrar o envio de documentos e selfie de quem ainda não enviou", "Henrique, Responsáveis legais", ["Lista de pendências por escola"], "1 dia (repetir se preciso)", 1),
  a("a18", S2, "2026-11-23", "2026-11-27", "Análise e aprovação das subcontas pelo Asaas", "Asaas, Henrique (acompanhamento)", ["Documentos completos enviados"], "1 a 3 dias úteis após o envio completo", 2),
  a("a19", S2, "2026-11-23", "2026-11-27", "Escolas com conta própria: receber a chave de API e cadastrar o webhook do Portal", "Tesoureiro da escola, Claude", [
    "Chave de API por canal seguro", "Token do webhook", "Termo de adesão assinado",
  ], "1 hora por escola", 0.5),
  a("a20", S2, "2026-11-24", "2026-11-27", "Cobrança-teste de R$ 5 com split em cada conta aprovada (depois estornar)", "Claude, Henrique", ["R$ 5 por escola", "Conferir o split na conta do BPO"], "1 dia", 1),
  a("a23", S2, "2026-11-23", "2026-11-25", "Confirmar com o gerente Asaas: mesmo CNPJ em duas contas e chave de API só para o Portal", "Henrique, Gerente de conta Asaas", ["Perguntas por escrito"], "1 a 3 dias para resposta", 2),
  a("a24", S3, "2026-11-30", "2026-12-03", "Gravar o vídeo passo a passo (60 s e 3 min)", "Henrique ou voluntário, Claude (roteiro)", [
    "Celular de demonstração", "Usuário de teste", "Roteiro, narração e legenda",
  ], "1 dia de gravação + 1 a 2 dias de edição", 3),
  a("a25", S3, "2026-11-30", "2026-12-01", "Montar o PDF passo a passo (A4 frente e verso)", "Claude, Henrique (revisão)", ["6 a 8 capturas do modo guiado", "Uma frase por tela"], "1 dia", 1),
  a("a26", S3, "2026-11-30", "2026-12-04", "Página \"como pagar\" e cartazes com QR por filial", "Claude (arte e página), Gráfica", [
    "Arte A3 por filial", "QR de pagamento + QR do vídeo", "Orçamento de impressão",
  ], "Arte 1 dia; impressão 1 a 3 dias", 3),
  a("a27", S3, "2026-11-26", "2026-12-10", "Acompanhar as cobranças do ciclo de 10/12 em Barra do Garças", "Henrique, Claude, Tesoureiro BGA", ["Painel de saúde", "Lista de autorizações ativas"], "10 min por dia", 0.5, {
    obs: "Janela do Pix Automático: cobranças criadas de 26/11 a 08/12.",
  }),
  a("a28", S3, "2026-11-30", "2026-12-04", "Treinar as tesourarias (30 min por videochamada)", "Henrique, Tesoureiros", ["Roteiro do treino", "Link da videochamada", "PDF passo a passo"], "30 min por escola; 2 a 3 dias para agendar todos", 3),
  a("a29", S4, "2026-12-07", "2026-12-08", "Afixar os cartazes no pátio e avisar as turmas com o vídeo", "Chefes de filial, Instrutores", ["Cartazes impressos", "Vídeo de 60 s", "Mensagem para os grupos de turma"], "1 dia", 1),
  a("a30", S4, "2026-12-07", "2026-12-07", "Liberar o Pix Automático nas filiais com conta aprovada", "Claude, Henrique", ["Siglas aprovadas em PIX_AUTOMATICO_UNIDADES"], "1 hora", 0.5),
  a("a31", S4, "2026-12-10", "2026-12-11", "Primeiro ciclo automático de Barra do Garças: conferir pagamentos, splits e recibos", "Henrique, Claude, Tesoureiro BGA", ["Painel de saúde", "Extrato da subconta e da conta do BPO"], "1 dia", 1),
  a("a32", DJ, "2026-12-14", "2027-01-08", "Acompanhamento diário: pagamentos, splits, falhas e autorizações recusadas", "Henrique, Claude", ["Painel de saúde", "Conferência do split"], "15 min por dia", 0.5),
  a("a33", DJ, "2026-12-14", "2027-01-06", "Segunda chamada para autorizar o débito automático (meta antes de 06/01)", "Chefes de filial, Henrique", ["Mensagem nos grupos", "Vídeo", "Lista de quem ainda não autorizou"], "2 semanas de campanha", 10),
  a("a34", DJ, "2027-01-10", "2027-01-11", "Primeiro ciclo automático de todas as filiais", "Henrique, Claude, Tesoureiros", ["Painel de saúde", "Lista de falhas para aviso"], "1 dia", 1, {
    obs: "10/01/2027 é domingo.",
  }),
  a("a35", DJ, "2027-01-11", "2027-01-22", "Relatório por escola: adesão, inadimplência, spread recebido e fixo abatido", "Claude, Henrique, Diretor Nacional", ["Dados do Portal e do Asaas"], "2 dias úteis", 2),
];

export async function lerCronograma(): Promise<AcaoCronograma[]> {
  const linha = await db.resumoNacional.findUnique({ where: { chave: CHAVE_CRONOGRAMA } });
  const acoes = (linha?.dados as { acoes?: AcaoCronograma[] } | null)?.acoes;
  return Array.isArray(acoes) ? acoes : CRONOGRAMA_INICIAL;
}

export async function gravarCronograma(acoes: AcaoCronograma[]) {
  await db.resumoNacional.upsert({
    where: { chave: CHAVE_CRONOGRAMA },
    update: { dados: { acoes }, geradoEm: new Date() },
    create: { chave: CHAVE_CRONOGRAMA, dados: { acoes } },
  });
}
