/**
 * Profissão → área de atuação (pedido do usuário 2026-10-19: relatório por
 * profissão na filial e no painel nacional, para a direção nacional ver onde
 * os membros atuam e como integrá-los melhor).
 *
 * O Mercúrio guarda a profissão em texto livre (cad_profissao, ~1.400
 * grafias diferentes entre os ativos). Aqui ela é normalizada e agrupada em
 * áreas por palavras-chave. Quando a profissão não diz a área (ex.:
 * "servidor público"), o local de trabalho (cad_empresa) desempata, se
 * informado; senão fica em "Serviço público (área não identificada)".
 * Funções puras: usadas na sincronização diária e nos testes.
 */

export const AREAS = [
  "Jurídica",
  "Saúde",
  "Psicologia e terapias",
  "Educação",
  "Administração, contabilidade e finanças",
  "Tecnologia da informação",
  "Engenharia e arquitetura",
  "Ciências, meio ambiente e agrárias",
  "Comunicação, artes e design",
  "Comércio, vendas e empreendedorismo",
  "Segurança e forças armadas",
  "Ciências humanas e sociais",
  "Serviços e ofícios",
  "Serviço público (área não identificada)",
  "Estudantes",
  "Aposentados",
  "Do lar ou sem ocupação",
  "Outras",
  "Não informada",
] as const;
export type Area = (typeof AREAS)[number];

/** Alguns cadastros vêm com UTF-8 lido como Latin-1 ("PÃºBLICA"). */
function consertarCodificacao(s: string): string {
  if (!/[ÃÂ]/.test(s)) return s;
  try {
    return decodeURIComponent(
      [...s].map((c) => (c.charCodeAt(0) < 256 ? `%${c.charCodeAt(0).toString(16).padStart(2, "0")}` : encodeURIComponent(c))).join(""),
    );
  } catch {
    return s;
  }
}

/** Maiúsculas, sem acento, sem pontuação, espaços simples. */
export function normalizar(texto: string | null | undefined): string {
  return consertarCodificacao(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chave para juntar masculino e feminino ("ADVOGADA" e "ADVOGADO",
 * "SERVIDORA PUBLICA" e "SERVIDOR PUBLICO"). Só para agrupar — o rótulo
 * exibido é a grafia mais comum.
 */
export function chaveDeGenero(normalizada: string): string {
  return normalizada
    .split(" ")
    .map((p) => {
      if (p.length <= 3) return p;
      if (p.endsWith("ORA")) return p.slice(0, -1);
      if (p.endsWith("A") && !p.endsWith("ISTA") && !p.endsWith("ATA") && !p.endsWith("ETA") && !p.endsWith("CIA")) return `${p.slice(0, -1)}O`;
      return p;
    })
    .join(" ");
}

type Regra = [Area, RegExp];

// Ordem importa: a primeira que casar decide. Testes em tests/profissoes.test.mjs.
const REGRAS_PROFISSAO: Regra[] = [
  ["Não informada", /^(NAO INFORM\w*|NAOINF|N I|NI|NENHUM[A]?|CRIANCA|MENOR|0)$/],
  ["Jurídica", /ADVOG|JURIDIC|JUIZ|JUIZA|DESEMBARGAD|PROMOTOR|PROCURADOR|DEFENSOR|OFICIAL DE JUSTICA|JUDICIARI|TABELI|NOTARI|CARTORI|BACHAREL EM DIREITO|\bDIREITO\b|DELEGAD|ESCRIVA|MAGISTRAD|JURISTA|LEILOEIR|DESPACHANTE/],
  ["Psicologia e terapias", /PSICOLOG|PSICANAL|PSICOTERAP|TERAPEUTA(?! OCUPACIONAL)|TERAPIA|HOLIST|MASSOTERAP|ACUPUNTU|REIKI|CONSTEL|COACH/],
  ["Saúde", /MEDIC[OA](?! VETERIN)|MEDICINA(?! VETERIN)|ENFERM|DENTIST|ODONTO|FARMAC|FISIOTERAP|NUTRICION|FONOAUD|FONODI|BIOMEDIC|TERAPEUTA OCUPACIONAL|RADIOLOG|AGENTE DE SAUDE|CUIDADOR|SAUDE|HOSPITAL|CLINIC|ANESTES|PEDIATR|CARDIOLOG|GINECOLOG|DERMATOLOG|PSIQUIATR|OFTALMO|CIRURGI|EDUCA\w* FISIC|PERSONAL|YOGA|IOGA|PILATES|PODOLOG|ORTODONT|OBSTETR|QUIROPRAX|GERONTOLOG|CUIDODOR|ED FISICA|FISCAL SANITARI|BIOEDIC|NUTRICIN|FARNAC|ENFFERM/],
  ["Educação", /PROFESSOR|PROF\b|DOCENTE|PEDAGOG|EDUCADOR|PSICOPEDAG|BIBLIOTEC|COORDENADORA? PEDAG|ORIENTADORA? EDUC|MONITOR|TUTOR|ALFABETIZ/],
  ["Tecnologia da informação", /SISTEMA|\bTI\b|INFORMATIC|PROGRAMAD|DESENVOLVEDOR|SOFTWARE|COMPUTAC|DADOS|DATA CENTER|INOVACAO E TECNOL|DEVOPS|TECNOLOGIA DA INFORMACAO|SUPORTE TECNICO|WEB/],
  ["Engenharia e arquitetura", /ENGENHEIR|ENGENHA|ENGENE|ENEGENH|\bENG\b|MESTRE DE OBRAS|ARQUITET|URBANIST|EDIFICAC|ELETROTEC|TECNICO EM ELETR|PROJETISTA|DESENHISTA|TOPOGRAF|AGRIMENS/],
  ["Ciências, meio ambiente e agrárias", /BIOLOG|GEOLOG|GEOGRAF|QUIMIC|FISICO|AGRONOM|AGRICULT|PECUAR|ZOOTEC|VETERIN|FLORESTAL|AMBIENTAL|OCEANOGRAF|METEOROLOG|PESQUISADOR|CIENTISTA|ESTATISTIC|MATEMATIC|METEROLOG|RURAL|FAZENDEIR|VAQUEIR|PERMACULT|TECNOLOGA? DE ALIMENTOS/],
  ["Administração, contabilidade e finanças", /ADMINISTRA|ADMINST|ADMNIST|ADIMINIST|\bADM\b|INVESTIMENTO|LICITAC|QUALIDADE|SECURITARI|AUTUARI|ECONIARI|COBRANCA|CONTAD|CONTABIL|ECONOMIST|ECONOMIARI|BANCARI|AUDITOR|FINANCEIR|FINANCAS|SECRETARI|RECURSOS HUMANOS|\bRH\b|GESTOR|GERENTE(?! COMERCIAL| DE VENDAS)|COORDENAD|SUPERVISOR(?! DE VENDAS)|DIRETOR|EXECUTIV|ASSISTENTE ADM|AUXILIAR ADM|AUX ADM|ESCRITURARI|FATURIST|LOGISTIC|COMPRAD|ANALISTA DE CONTRATOS|PLANEJADOR|INVESTIDOR|ATUARI|CONSULTOR(?:A)?(?! DE VENDAS)|ANALISTA(?: ADMINISTRATIV| DE NEGOCIOS| DE PROJETOS)|ESTOQUIST/],
  ["Comunicação, artes e design", /JORNALIST|PUBLICITA|PUBLICIDADE|PROPAGANDA|MARKETING|RELACOES PUBLICAS|COMUNICAC|DESIGN|FOTOGRAF|MUSIC|ARTIST|ATOR|ATRIZ|ESCRITOR|REDATOR|ESTILIST|MODELISTA|CINEAST|PRODUTORA? CULTURAL|PRODUTOR DE|DANCARIN|BAILARIN|ARTESA|ARTESAO|DECORAD|EDITOR|TRADUTOR|LOCUTOR|ILUSTRAD|CENOGRAF|CANTOR|RADIALIST|AUDIOVISUAL|SOCIAL MEDIA|STREAMING|CONTEUDO|DESINGN|MISICIST|SEREGRAF|REVISOR/],
  ["Comércio, vendas e empreendedorismo", /EMPRESARI|EMPREENDEDOR|COMERCIANTE|COMERCIARI|COMERCIAL|VENDEDOR|VENDAS|REPRESENTANTE|CORRETOR|LOJIST|PROPAGANDIST|MICROEMPREEND|AGENTE DE VIAGENS|TURISM|PROMOTORA? DE VENDAS|AUTONOM|PROFISSIONAL LIBERAL|INDUSTRIA|EMRESARI|CORETOR|BALCONIST|FREELANC|CUSTOMER|CLIENTE|EXPANSAO/],
  ["Segurança e forças armadas", /MILITAR|POLICIA|BOMBEIR|VIGILANT|SEGURANCA|EXERCITO|MARINHA|AERONAUT|AGENTE PENITENC|POLICIAL PENAL|SOCIOEDUCATIV|GUARDA|PERIT[OA] CRIMINAL|PAPILOSCOP|BRIGADIST|CONTROLADOR DE VOO|KRAV MAGA/],
  ["Ciências humanas e sociais", /ASSISTENTE SOCIAL|ASSIST SOCIAL|SERVICO SOCIAL|SOCIOLOG|HISTORIAD|FILOSOF|ANTROPOLOG|TEOLOG|DIPLOMAT|ARQUEOLOG|CIENTISTA POLITIC|RELACOES INTERNACIONAIS|LETRAS|LINGUIST|MUSEOLOG|ARQUIVIST|SACERDOT|PASTOR|RELIGIOS/],
  ["Serviços e ofícios", /CABEL|ESTETIC|MANICURE|MAQUIAD|BARBEIR|MOTORISTA|MECANIC|COZINH|CHEF\b|CONFEIT|PADEIR|GASTRONOM|COSTUREIR|MARCENEIR|ELETRICISTA|ENCANAD|PEDREIR|PINTOR|RECEPCION|ATENDENTE|PORTEIR|PORTARIA|SERVICOS GERAIS|DIARIST|BABA|CAMAREIR|GARCOM|GARCONETE|OPERADOR|TELEMARKET|METALURG|MARITIM|PILOTO|COMISSARI|AEROVIARI|TECNICO|TECNICA|\bTEC\b|AUXILIAR|ASSISTENTE|ASSIST\b|SUP OPERACIONAL|ENCARREGAD|CARTEIRO|METROVIARI|HOTELEIR|BARMAN|BARISTA|PIZZAIOL|SALGADEIR|SERRALHEIR|JARDINEIR|CASEIR|MOTOBOY|COUREIR|EXTRUSOR|ATENDIMENTO/],
  ["Estudantes", /ESTUDANTE|ESTUNDANTE|ESTAGIARI|UNIVERSITARI|ACADEMIC|VESTIBULAND|GRADUANDO/],
  ["Do lar ou sem ocupação", /DO LAR|DONA DE CASA|DONO DE CASA|DESEMPREGAD|SEM OCUPACAO|NAO TRABALHA/],
  ["Aposentados", /APOSENTAD|PENSIONIST|APOSENT\b|APOSENT/],
];

/** Servidor público, funcionário público, empregado público etc. — sem área definida. */
const SERVIDOR = /SERVIDOR|SEVIDOR|SERVIDO\b|ASSESSORA? PARLAMENTAR|ASSESSOR PESSOAL|SERV PUBLIC|SERV\b|FUNCIONARI|FUNC PUBLIC|FUNC\b|EMPREGAD[OA] PUBLIC|AGENTE ADMINISTRATIVO|AGENTE PUBLICO|SERVENTUARI|ANALISTA\b|AGENTE\b/;

// Local de trabalho que indica a área (para servidores).
const REGRAS_ORGAO: Regra[] = [
  ["Jurídica", /\bTJ|TRIBUNAL DE JUSTICA|\bTRT|\bTRF|\bTRE|\bTST\b|\bTSE\b|\bSTJ\b|\bSTF\b|\bSTM\b|JUSTICA|JUIZADO|\bVARA\b|FORUM|MINISTERIO PUBLICO|\bMP[A-Z]*\b|\bMPF\b|DEFENSORIA|PROCURADORIA|\bPG[EFRM]\b|\bAGU\b|ADVOCACIA GERAL|CARTORIO|\bOAB\b/],
  ["Saúde", /SAUDE|HOSPITAL|HEMOCENTRO|ANVISA|VIGILANCIA SANITARIA|\bSES\b|\bSUS\b|FIOCRUZ|LACEN|UPA\b|POSTO DE SAUDE/],
  ["Educação", /EDUCACAO|ESCOLA|COLEGIO|UNIVERSIDADE|FACULDADE|INSTITUTO FEDERAL|\bIF[A-Z]{1,3}\b|\bUF[A-Z]{1,4}\b|\bUNB\b|\bUE[A-Z]{1,3}\b|\bSEDUC|\bSEE\b|\bSEMED|CAPES|\bCNPQ\b|\bINEP\b/],
  ["Administração, contabilidade e finanças", /RECEITA|FAZENDA|\bSEFAZ|\bSEMEF|ECONOMIA|PLANEJAMENTO|TRIBUNAL DE CONTAS|\bTC[A-Z]{0,3}\b|\bTCU\b|\bCGU\b|CONTROLADORIA|\bINSS\b|BANCO|CAIXA ECONOMICA|\bBACEN\b|TESOURO|\bDATAPREV\b|\bSERPRO\b|ENAP|GESTAO|\bIBGE\b/],
  ["Segurança e forças armadas", /POLICIA|\bPM[A-Z]{0,2}\b|\bPC[A-Z]{0,2}\b|\bPF\b|\bPRF\b|SEGURANCA PUBLICA|BOMBEIR|DEFESA|EXERCITO|MARINHA|AERONAUTICA|BASE AEREA|DETRAN|SISTEMA PRISIONAL|PENITENC/],
  ["Ciências, meio ambiente e agrárias", /MEIO AMBIENTE|\bIBAMA\b|ICMBIO|\bEMBRAPA\b|AGRICULTURA|\bINCRA\b|\bANA\b|SEMA\b|EMATER|AGRODEFESA/],
  ["Tecnologia da informação", /TECNOLOGIA DA INFORMACAO|\bTI\b|INFORMATICA|PROCESSAMENTO DE DADOS/],
  ["Comunicação, artes e design", /CULTURA|\bEBC\b|COMUNICACAO|TURISMO/],
];

export type Classificacao = { area: Area; peloOrgao: boolean };

export function classificarProfissao(profissao: string | null | undefined, empresa?: string | null): Classificacao {
  const p = normalizar(profissao);
  if (!p || /^[0-9 ]*$/.test(p)) return { area: "Não informada", peloOrgao: false };
  const servidor = SERVIDOR.test(p);
  if (!servidor || /APOSENT/.test(p)) {
    for (const [area, re] of REGRAS_PROFISSAO) if (re.test(p)) return { area, peloOrgao: false };
  } else {
    // "Servidora pública direito", "contador (servidor público)": a profissão já diz a área.
    for (const [area, re] of REGRAS_PROFISSAO)
      if (area !== "Serviços e ofícios" && area !== "Aposentados" && area !== "Não informada" && re.test(p)) return { area, peloOrgao: false };
  }
  if (servidor) {
    const e = normalizar(empresa);
    if (e && e !== "SERVIDORA" && e !== "SERVIDOR") for (const [area, re] of REGRAS_ORGAO) if (re.test(e)) return { area, peloOrgao: true };
    return { area: "Serviço público (área não identificada)", peloOrgao: false };
  }
  return { area: "Outras", peloOrgao: false };
}

/** "SERVIDORA PÚBLICA" → "Servidora pública" (rótulo de exibição). */
export function rotuloDeProfissao(bruta: string): string {
  const t = bruta.trim().toLowerCase().replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
