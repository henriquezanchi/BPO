import type { Prisma } from "@prisma/client";

/**
 * Público dos eventos internos (pedido do usuário 2026-10-19): pode marcar
 * vários. "Membros" = 2º nível em diante, incluindo FV, HD, dirigentes e
 * provacionistas. Quem não pode se inscrever não vê o evento.
 */
export const EVENT_AUDIENCES = {
  todos_ativos: "Todos os ativos",
  membros: "Membros",
  fv: "FV",
  provacionistas: "Provacionistas",
  hd: "HD",
  dirigentes: "Dirigentes",
};
export type EventAudience = keyof typeof EVENT_AUDIENCES;

type PessoaPublico = { nivel?: string | null; isMembroPrograma: boolean; isProvacionista: boolean; isHD?: boolean; isDirigente?: boolean; isFV?: boolean; emProvacionismo?: boolean };

/** Públicos de que a pessoa faz parte. */
export function publicosDaPessoa(m: PessoaPublico): EventAudience[] {
  const n = m.nivel ?? "";
  const segundoNivelOuMais = /^N[2-9]$/.test(n);
  // Todo FV, HD, dirigente e provacionista do FV é do 2º nível em diante (conferido no Mercúrio em
  // 19/10/2026); os campos entram aqui só por segurança. O nível "PP" (isProvacionista) NÃO é membro.
  const membro = segundoNivelOuMais || !!m.isFV || !!m.isHD || !!m.isDirigente || !!m.emProvacionismo;
  return [
    "todos_ativos",
    ...(membro ? (["membros"] as const) : []),
    ...(m.isFV ? (["fv"] as const) : []),
    // Provacionista = em provacionismo para o FV (cad_situacao_fv PRO), não o nível PP.
    ...(m.emProvacionismo ? (["provacionistas"] as const) : []),
    ...(m.isHD ? (["hd"] as const) : []),
    ...(m.isDirigente ? (["dirigentes"] as const) : []),
  ];
}

/** O segundo parâmetro (acesso de voluntário) não é mais usado; mantido para os chamadores existentes. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura mantida para os chamadores existentes
export function eventAudienceWhere(member: PessoaPublico, _volunteer?: boolean): Prisma.EventWhereInput {
  // Papéis ainda não mapeados do Ágora nunca recebem acesso por aproximação.
  return { publicos: { hasSome: publicosDaPessoa(member) }, source: { notIn: ["agora", "google_calendar_nacional"] } };
}

/** Regionais para abrir inscrições a outras filiais (pedido do usuário 2026-10-19). */
export const REGIONAIS: Record<string, { nome: string; ufs: string[] }> = {
  centro_oeste: { nome: "Centro-Oeste", ufs: ["GO", "MT", "MS"] },
  df: { nome: "DF", ufs: ["DF"] },
  nordeste: { nome: "Nordeste", ufs: ["MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA"] },
  norte: { nome: "Norte", ufs: ["AC", "AM", "AP", "PA", "RO", "RR", "TO"] },
};
export const ABERTURAS = { filial: "Só esta filial", todas: "Todas as filiais", filiais: "Filiais escolhidas", regionais: "Regionais", estados: "Estados" };
export type Abertura = keyof typeof ABERTURAS;
export const regionalDaUf = (uf: string | null | undefined) => Object.entries(REGIONAIS).find(([, r]) => r.ufs.includes(uf ?? ""))?.[0] ?? null;

/** Eventos da filial da pessoa e os de outras filiais abertos a ela. */
export function eventScopeWhere(school: { id: string; uf: string | null }): Prisma.EventWhereInput {
  const regional = regionalDaUf(school.uf);
  return {
    OR: [
      { schoolId: school.id },
      { abertoA: "todas" },
      { abertoA: "filiais", abertoValores: { has: school.id } },
      ...(regional ? [{ abertoA: "regionais", abertoValores: { has: regional } }] : []),
      ...(school.uf ? [{ abertoA: "estados", abertoValores: { has: school.uf } }] : []),
    ],
  };
}

/** Mesma regra de eventScopeWhere, para um evento já carregado (usado no aviso push de evento novo). */
export function eventoAlcancaFilial(evento: { schoolId: string | null; abertoA: string | null; abertoValores: string[] }, school: { id: string; uf: string | null }) {
  if (evento.schoolId === school.id || evento.abertoA === "todas") return true;
  const regional = regionalDaUf(school.uf);
  if (evento.abertoA === "filiais") return evento.abertoValores.includes(school.id);
  if (evento.abertoA === "regionais") return !!regional && evento.abertoValores.includes(regional);
  if (evento.abertoA === "estados") return !!school.uf && evento.abertoValores.includes(school.uf);
  return false;
}

function validarAbertura(abertoA: string | undefined, valores: string[] | undefined) {
  const a = (abertoA ?? "filial") as Abertura;
  if (!Object.hasOwn(ABERTURAS, a)) throw Error("Escolha para quem as inscrições ficam abertas.");
  const v = [...new Set((valores ?? []).map((x) => String(x).trim()).filter(Boolean))];
  if (a === "filial" || a === "todas") return { abertoA: a, abertoValores: [] as string[] };
  if (!v.length) throw Error("Escolha ao menos uma filial, regional ou estado.");
  if (a === "regionais" && v.some((x) => !REGIONAIS[x])) throw Error("Regional inválida.");
  if (a === "estados" && v.some((x) => !/^[A-Z]{2}$/.test(x))) throw Error("Estado inválido.");
  return { abertoA: a, abertoValores: v.slice(0, 200) };
}

/** Prazos de desistência com devolução oferecidos no cadastro (pedido do usuário 2026-10-22; padrão 3 dias). */
export const PRAZOS_DESISTENCIA: { valor: number | null; rotulo: string }[] = [
  { valor: 7, rotulo: "Até 7 dias antes do evento" },
  { valor: 3, rotulo: "Até 3 dias antes do evento (padrão)" },
  { valor: 1, rotulo: "Até 1 dia antes do evento" },
  { valor: null, rotulo: "Sem devolução em caso de desistência" },
];
function prazoDesistencia(valor: number | null | undefined) {
  if (valor === undefined) return 3;
  if (!PRAZOS_DESISTENCIA.some((p) => p.valor === valor)) throw Error("Escolha um prazo de desistência válido.");
  return valor;
}
/** Último momento para desistir com devolução, ou null se o evento não devolve. */
export function limiteDesistencia(startsAt: Date, prazoDias: number | null) {
  return prazoDias === null ? null : new Date(startsAt.getTime() - prazoDias * 86_400_000);
}

export function validateInternalEvent(input: {title:string;startsAt:string;endsAt:string;price:number;audience?:string;publicos?:string[];abertoA?:string;abertoValores?:string[];description:string;location:string;capacity?:number|null;registrationClosesAt?:string|null;participantInstructions?:string;contactInfo?:string;posterPath?:string|null;lancheCompartilhado?:boolean;prazoDesistenciaDias?:number|null}) {
 const start=new Date(input.startsAt),end=new Date(input.endsAt);
 if(!input.title.trim()||input.title.length>160||input.description.length>5000||input.location.length>300)throw Error('Confira o título, a descrição e o local.');
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start<=new Date()||end<=start)throw Error('Informe início futuro e término depois do início.');
 if(!Number.isFinite(input.price)||input.price<0||input.price>999999.99||Math.abs(input.price*100-Math.round(input.price*100))>0.00001)throw Error('Informe uma contribuição válida, com até duas casas decimais.');
 const publicos=[...new Set(input.publicos?.length?input.publicos:input.audience?[input.audience]:[])];
 if(!publicos.length||publicos.some(p=>!Object.hasOwn(EVENT_AUDIENCES,p)))throw Error('Escolha ao menos um público para o evento.');
 const abertura=validarAbertura(input.abertoA,input.abertoValores);
 const capacity=input.capacity??null;
 if(capacity!==null&&(!Number.isSafeInteger(capacity)||capacity<1||capacity>100000))throw Error('O limite de vagas deve ser um número inteiro entre 1 e 100.000.');
 const closes=input.registrationClosesAt?new Date(input.registrationClosesAt):null;
 if(closes&&(!Number.isFinite(closes.getTime())||closes>start))throw Error('O prazo de inscrição deve terminar até o início do evento.');
 if((input.participantInstructions?.length??0)>5000||(input.contactInfo?.length??0)>300)throw Error('Reduza as orientações ou o contato do evento.');
 return {capacity,registrationClosesAt:closes,participantInstructions:input.participantInstructions?.trim()||null,contactInfo:input.contactInfo?.trim()||null,posterPath:input.posterPath||null,title:input.title.trim(),startsAt:start,endsAt:end,price:input.price,audience:publicos[0],publicos,...abertura,description:input.description.trim(),location:input.location.trim(),lancheCompartilhado:!!input.lancheCompartilhado,prazoDesistenciaDias:prazoDesistencia(input.prazoDesistenciaDias)};
}
export function eventNoticePlan(startsAt:Date,endsAt:Date,now=new Date()) {
 return [{kind:'inscricao',dueAt:now},{kind:'vespera',dueAt:new Date(startsAt.getTime()-86400000)},{kind:'uma_hora',dueAt:new Date(startsAt.getTime()-3600000)},{kind:'avaliar_presenca',dueAt:new Date(endsAt.getTime()+3600000)}].filter(n=>n.dueAt>=now);
}

export function safeEventRegistrationUrl(value:string|null|undefined) {
 if(!value)return null;
 try{const url=new URL(value);if(url.protocol!=="https:"||url.username||url.password)return null;return url.href;}catch{return null;}
}
