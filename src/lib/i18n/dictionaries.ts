/**
 * Infraestrutura de idioma do Portal do Aluno — pedido do usuário
 * 2026-10-15, pras filiais americanas vistas na Mercury API (Austin-TX,
 * Deerfield Beach, Orlando, South Orange-NJ). Dentro do Portal (pós-login),
 * decidido por School.language, sem seletor manual pro membro — a tela de
 * login é a ÚNICA exceção: acontece ANTES de sabermos a escola de quem
 * está entrando, então tem um toggle manual PT/EN só ali (ver
 * login-client.tsx), independente da escolha automática do resto.
 *
 * Cobertura deste 1º incremento: login + tela inicial do Portal do Aluno
 * (member-portal-client.tsx) + a mensagem que substitui qualquer fluxo de
 * pagamento pra quem está em "en" (Asaas/PIX é só Brasil — ver decisão do
 * usuário: 1ª versão em inglês é só consulta, sem processar cobrança).
 * Agenda, Mais Dados, Jornada e Transparência ainda não foram traduzidas —
 * ficam pra uma 2ª rodada.
 */
export type Locale = "pt" | "en";

export interface Dictionary {
  login: {
    titulo: string;
    subtitulo: string;
    email: string;
    senha: string;
    senhaDica: string;
    erroCredenciais: string;
    entrando: string;
    entrar: string;
  };
  modalTitles: {
    cadastro: string;
    contribuicao: string;
    situacao: string;
    fortuna_recarga: string;
    agenda: string;
    estudos: string;
    voluntariado: string;
    ajuda: string;
    gaf: string;
    grupos_estudo: string;
    jornada: string;
    transparencia: string;
  };
  home: {
    portalDoMembro: string;
    portalDoAluno: string;
    portalDoVoluntario: string;
    editarDados: string;
    matricula: string;
    sair: string;
    contribuicaoPendente: string;
    contribuicaoEmDia: string;
    ola: (nome: string) => string;
    statusAtrasada: string;
    statusEmDia: string;
    venceuHa: (dias: number, dia: number, mes: number) => string;
    venceHoje: string;
    contribuicaoSemDesconto: string;
    mensagemSemDesconto: (nome: string) => string;
    mensagemAVencer: (nome: string) => string;
    proximoVencimento: (dia: number, mes: number, dias: number) => string;
    verSituacao: string;
    falarNoWhatsapp: string;
  };
  tiles: {
    contribuicao: { title: string; subtitle: string };
    agenda: { title: string; subtitleComItens: (n: number) => string; subtitleSemItens: string };
    estudos: { title: string; subtitle: string };
    voluntariado: { title: string; subtitle: string };
    gaf: { title: string; subtitle: string };
    ajuda: { title: string; subtitle: string };
    jornada: { title: string; subtitleComStreak: (n: number) => string; subtitleSemStreak: string };
    transparencia: { title: string; subtitle: string };
  };
  /** Mostrado no lugar de qualquer ação de pagamento (contribuição, evento, Fortuna) pra escola "en" — ver decisão do usuário 2026-10-15. */
  somenteConsulta: {
    aviso: string;
  };
}

const pt: Dictionary = {
  login: {
    titulo: "Entrar no Portal do Aluno",
    subtitulo: "Entre com a sua conta Nova Acrópole, usando o e-mail cadastrado na sua escola.",
    email: "E-mail",
    senha: "Senha",
    senhaDica: "Senha inicial: os 6 primeiros números do seu CPF.",
    erroCredenciais: "E-mail ou senha incorretos. A senha inicial são os 6 primeiros números do seu CPF.",
    entrando: "Entrando...",
    entrar: "Entrar",
  },
  modalTitles: {
    cadastro: "Atualizar Cadastro",
    contribuicao: "Minha Contribuição",
    situacao: "Situação da Contribuição",
    fortuna_recarga: "Adicionar Créditos",
    agenda: "Agenda & Eventos",
    estudos: "Área de Estudos",
    voluntariado: "Voluntariado",
    ajuda: "Central de Ajuda",
    gaf: "Conhecer o GAF",
    grupos_estudo: "Grupos de estudo e leituras",
    transparencia: "Transparência Financeira",
    jornada: "Minha Jornada",
  },
  home: {
    portalDoMembro: "PORTAL DO MEMBRO",
    portalDoAluno: "PORTAL DO ALUNO",
    portalDoVoluntario: "Área do Voluntário",
    editarDados: "Editar Dados",
    matricula: "Matrícula",
    sair: "Sair",
    contribuicaoPendente: "Contribuição em Atraso",
    contribuicaoEmDia: "Contribuição em Dia",
    ola: (nome) => `Olá, ${nome}. Sua contribuição deste mês está`,
    statusAtrasada: "atrasada",
    statusEmDia: "em dia",
    venceuHa: (dias, dia, mes) => `Venceu há ${dias} dia(s) — vencimento dia ${dia}/${mes}`,
    venceHoje: "Vence hoje",
    contribuicaoSemDesconto: "Prazo do desconto encerrado",
    mensagemSemDesconto: (nome) => `Olá, ${nome}. O prazo com desconto (até o dia 10) passou, mas você ainda pode pagar este mês sem ficar em atraso.`,
    mensagemAVencer: (nome) => `Olá, ${nome}. Pague a contribuição deste mês até o dia 10 para manter o desconto.`,
    proximoVencimento: (dia, mes, dias) => `Próximo vencimento: dia ${dia}/${mes} (em ${dias} dia${dias === 1 ? "" : "s"})`,
    verSituacao: "Ver Situação",
    falarNoWhatsapp: "Falar com a escola no WhatsApp",
  },
  tiles: {
    contribuicao: { title: "Minha Contribuição", subtitle: "Composição e apoios" },
    agenda: {
      title: "Agenda & Eventos",
      subtitleComItens: (n) => `${n} próximos`,
      subtitleSemItens: "Palestras e Turmas",
    },
    estudos: { title: "Área de Estudos", subtitle: "Biblioteca, apostilas e Acrópole Play" },
    voluntariado: { title: "Voluntariado", subtitle: "Secretarias e mutirões" },
    gaf: { title: "Grupo de Acompanhamento", subtitle: "Conheça e faça sua adesão ao GAF" },
    ajuda: { title: "Central de Ajuda", subtitle: "Fale com a Economia" },
    jornada: {
      title: "Minha Jornada",
      subtitleComStreak: (n) => `${n} meses em dia`,
      subtitleSemStreak: "Sua caminhada na escola",
    },
    transparencia: { title: "Transparência Financeira", subtitle: "Veja como o dinheiro da escola é usado" },
  },
  somenteConsulta: {
    aviso: "Pagamento online ainda não disponível pra sua filial — fale com a secretaria.",
  },
};

const en: Dictionary = {
  login: {
    titulo: "Log in to the Student Portal",
    subtitulo: "Sign in with your Nova Acrópole account, using the email on file with your branch.",
    email: "Email",
    senha: "Password",
    // Dica genérica (não cita CPF) — de propósito: o toggle de idioma do
    // login é manual e pode ser usado por qualquer membro, mas a senha
    // derivada do CPF só existe pra quem é do Brasil; ainda não temos um
    // esquema de senha inicial pras filiais americanas.
    senhaDica: "Your initial password was provided by your branch.",
    erroCredenciais: "Incorrect email or password.",
    entrando: "Signing in...",
    entrar: "Sign in",
  },
  modalTitles: {
    cadastro: "Update Profile",
    contribuicao: "My Contribution",
    situacao: "Contribution Status",
    fortuna_recarga: "Add Credits",
    agenda: "Calendar & Events",
    estudos: "Study Area",
    voluntariado: "Volunteering",
    ajuda: "Help Center",
    gaf: "Learn about GAF",
    grupos_estudo: "Study groups",
    transparencia: "Financial Transparency",
    jornada: "My Journey",
  },
  home: {
    portalDoMembro: "MEMBER PORTAL",
    portalDoAluno: "STUDENT PORTAL",
    portalDoVoluntario: "Volunteer Area",
    editarDados: "Edit Profile",
    matricula: "Member ID",
    sair: "Log out",
    contribuicaoPendente: "Contribution Overdue",
    contribuicaoEmDia: "Contribution Up to Date",
    ola: (nome) => `Hi, ${nome}. Your contribution this month is`,
    statusAtrasada: "overdue",
    statusEmDia: "up to date",
    venceuHa: (dias, dia, mes) => `Due ${dias} day(s) ago — due date ${mes}/${dia}`,
    venceHoje: "Due today",
    contribuicaoSemDesconto: "Discount period ended",
    mensagemSemDesconto: (nome) => `Hi, ${nome}. The discount period (until the 10th) has passed, but you can still pay this month without being overdue.`,
    mensagemAVencer: (nome) => `Hi, ${nome}. Pay this month's contribution by the 10th to keep the discount.`,
    proximoVencimento: (dia, mes, dias) => `Next due date: ${mes}/${dia} (in ${dias} day${dias === 1 ? "" : "s"})`,
    verSituacao: "View Status",
    falarNoWhatsapp: "Message your branch on WhatsApp",
  },
  tiles: {
    contribuicao: { title: "My Contribution", subtitle: "Breakdown and support items" },
    agenda: {
      title: "Calendar & Events",
      subtitleComItens: (n) => `${n} upcoming`,
      subtitleSemItens: "Talks and classes",
    },
    estudos: { title: "Study Area", subtitle: "Library, course materials and Acrópole Play" },
    voluntariado: { title: "Volunteering", subtitle: "Committees and events" },
    gaf: { title: "Support Group", subtitle: "Learn about and join GAF" },
    ajuda: { title: "Help Center", subtitle: "Contact your branch" },
    jornada: {
      title: "My Journey",
      subtitleComStreak: (n) => `${n} months up to date`,
      subtitleSemStreak: "Your path at the school",
    },
    transparencia: { title: "Financial Transparency", subtitle: "See how the school's funds are used" },
  },
  somenteConsulta: {
    aviso: "Online payment isn't available for your branch yet — please contact your branch.",
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { pt, en };

export function getDictionary(language: string | null | undefined): Dictionary {
  return DICTIONARIES[language === "en" ? "en" : "pt"];
}
