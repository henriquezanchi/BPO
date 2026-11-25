import { cifrar } from "@/lib/segredo-cifrado";
import { NIVEIS_INFANTIS, programaDoNivel } from "@/lib/criancas-comum";
import { db } from "@/lib/db";
import type { AcessoInfantojuvenil, Programa } from "@/lib/infantojuvenil-comum";

/**
 * Responsáveis pelas crianças do Merlin (Correntinha, Távolas) e do Janos (pedido do usuário 18/11/2026).
 * O Mercúrio não guarda quem é o responsável: o Portal SUGERE pelo e-mail ou celular iguais aos de um adulto ativo
 * da mesma filial, e a secretaria do programa (ou a direção) CONFIRMA. Também dá para cadastrar à mão, inclusive
 * responsável que não é membro (só nome e contatos; o login dele vem na etapa 2).
 * Quem pode: o mesmo acesso da página Merlin e Janos (lib/infantojuvenil.ts), por filial e programa.
 */
export type VinculoView = { id: string; status: string; origem: string; parentesco: string | null; principal: boolean; responsavel: { id: string; nome: string; email: string | null; celular: string | null; membro: boolean } };
export type CriancaView = { id: string; nome: string; matricula: string | null; nivel: string; programa: Programa; schoolId: string; vinculos: VinculoView[] };

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
const chaveCelular = (s: string | null | undefined) => {
  const d = digitos(s);
  return d.length >= 10 ? `${d.slice(0, 2)}${d.slice(-8)}` : null;
};

function podeNaEscola(a: AcessoInfantojuvenil, schoolId: string, programa: Programa) {
  return a.todas.includes(programa) || (a.porEscola[schoolId] ?? []).includes(programa);
}

function escolasDoAcesso(a: AcessoInfantojuvenil): string[] | null {
  return a.todas.length ? null : Object.keys(a.porEscola);
}

/** Crianças ativas que a pessoa pode ver, com os vínculos. */
export async function listarCriancas(a: AcessoInfantojuvenil): Promise<CriancaView[]> {
  const escolas = escolasDoAcesso(a);
  const criancas = await db.member.findMany({
    where: { mercurioAtivo: true, nivel: { in: [...NIVEIS_INFANTIS] }, ...(escolas ? { schoolId: { in: escolas } } : {}) },
    select: { id: true, name: true, mercurioId: true, nivel: true, schoolId: true },
    orderBy: { name: "asc" },
  });
  const visiveis = criancas.filter((c) => podeNaEscola(a, c.schoolId, programaDoNivel(c.nivel)!));
  const vinculos = await db.vinculoResponsavel.findMany({
    where: { criancaId: { in: visiveis.map((c) => c.id) }, status: { not: "recusado" } },
    include: { responsavel: true },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return visiveis.map((c) => ({
    id: c.id,
    nome: c.name,
    matricula: c.mercurioId,
    nivel: c.nivel!,
    programa: programaDoNivel(c.nivel)!,
    schoolId: c.schoolId,
    vinculos: vinculos
      .filter((v) => v.criancaId === c.id)
      .map((v) => ({
        id: v.id,
        status: v.status,
        origem: v.origem,
        parentesco: v.parentesco,
        principal: v.principal,
        responsavel: { id: v.responsavel.id, nome: v.responsavel.nome, email: v.responsavel.email, celular: v.responsavel.celular, membro: !!v.responsavel.memberId },
      })),
  }));
}

/** Responsável (registro) de um membro adulto; cria se ainda não existir. */
async function responsavelDoMembro(memberId: string, criadoPorId: string) {
  const existente = await db.responsavel.findUnique({ where: { memberId } });
  if (existente) return existente;
  const m = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { name: true, email: true, whatsapp: true, schoolId: true } });
  return db.responsavel.create({ data: { memberId, schoolId: m.schoolId, nome: m.name, email: m.email, celular: m.whatsapp, criadoPorId } });
}

/**
 * Sugestões automáticas: adulto ativo da mesma filial com o mesmo e-mail ou celular da criança. Idempotente: não
 * recria sugestão recusada nem duplica vínculo. Devolve quantas sugestões novas criou.
 */
export async function gerarSugestoes(a: AcessoInfantojuvenil, criadoPorId: string): Promise<number> {
  const escolas = escolasDoAcesso(a);
  const filtroEscola = escolas ? { schoolId: { in: escolas } } : {};
  const [criancas, adultos] = await Promise.all([
    db.member.findMany({ where: { mercurioAtivo: true, nivel: { in: [...NIVEIS_INFANTIS] }, ...filtroEscola }, select: { id: true, email: true, whatsapp: true, schoolId: true, nivel: true } }),
    db.member.findMany({ where: { mercurioAtivo: true, NOT: { nivel: { in: [...NIVEIS_INFANTIS] } }, ...filtroEscola }, select: { id: true, email: true, whatsapp: true, schoolId: true } }),
  ]);
  const porEmail = new Map<string, string[]>();
  const porCelular = new Map<string, string[]>();
  for (const ad of adultos) {
    const e = ad.email?.trim().toLowerCase();
    if (e) porEmail.set(`${ad.schoolId}|${e}`, [...(porEmail.get(`${ad.schoolId}|${e}`) ?? []), ad.id]);
    const c = chaveCelular(ad.whatsapp);
    if (c) porCelular.set(`${ad.schoolId}|${c}`, [...(porCelular.get(`${ad.schoolId}|${c}`) ?? []), ad.id]);
  }
  const existentes = await db.vinculoResponsavel.findMany({ where: { criancaId: { in: criancas.map((c) => c.id) } }, select: { criancaId: true, responsavel: { select: { memberId: true } } } });
  const ja = new Set(existentes.map((v) => `${v.criancaId}|${v.responsavel.memberId}`));
  let novas = 0;
  for (const c of criancas) {
    if (!podeNaEscola(a, c.schoolId, programaDoNivel(c.nivel)!)) continue;
    const e = c.email?.trim().toLowerCase();
    const cel = chaveCelular(c.whatsapp);
    const candidatos = new Map<string, "email" | "celular">();
    for (const id of e ? (porEmail.get(`${c.schoolId}|${e}`) ?? []) : []) candidatos.set(id, "email");
    for (const id of cel ? (porCelular.get(`${c.schoolId}|${cel}`) ?? []) : []) if (!candidatos.has(id)) candidatos.set(id, "celular");
    for (const [adultoId, origem] of candidatos) {
      if (ja.has(`${c.id}|${adultoId}`)) continue;
      const r = await responsavelDoMembro(adultoId, criadoPorId);
      await db.vinculoResponsavel.create({ data: { criancaId: c.id, responsavelId: r.id, origem, status: "sugerido" } }).catch(() => null);
      ja.add(`${c.id}|${adultoId}`);
      novas++;
    }
  }
  return novas;
}

async function criancaDoAcesso(a: AcessoInfantojuvenil, criancaId: string) {
  const c = await db.member.findUnique({ where: { id: criancaId }, select: { id: true, schoolId: true, nivel: true, mercurioAtivo: true } });
  const p = programaDoNivel(c?.nivel);
  if (!c || !p || !podeNaEscola(a, c.schoolId, p)) throw new Error("Sem acesso a esta criança.");
  return c;
}

export async function decidirVinculo(a: AcessoInfantojuvenil, vinculoId: string, confirmar: boolean, decididoPorId: string) {
  const v = await db.vinculoResponsavel.findUniqueOrThrow({ where: { id: vinculoId } });
  await criancaDoAcesso(a, v.criancaId);
  await db.vinculoResponsavel.update({ where: { id: vinculoId }, data: { status: confirmar ? "confirmado" : "recusado", decididoPorId, decididoEm: new Date() } });
}

export async function vincularMembro(a: AcessoInfantojuvenil, criancaId: string, memberId: string, parentesco: string | null, decididoPorId: string) {
  const c = await criancaDoAcesso(a, criancaId);
  if (memberId === criancaId) throw new Error("A criança não pode ser responsável por ela mesma.");
  const adulto = await db.member.findUnique({ where: { id: memberId }, select: { nivel: true, mercurioAtivo: true, schoolId: true } });
  if (!adulto) throw new Error("Pessoa não encontrada.");
  // 25/11/2026: responsável só da mesma filial da criança e com matrícula ativa (a busca já filtra assim; a action não).
  if (adulto.schoolId !== c.schoolId || !adulto.mercurioAtivo) throw new Error("Escolha uma pessoa ativa da mesma filial da criança.");
  if (adulto.nivel && (NIVEIS_INFANTIS as readonly string[]).includes(adulto.nivel)) throw new Error("Escolha um adulto como responsável.");
  const r = await responsavelDoMembro(memberId, decididoPorId);
  await db.vinculoResponsavel.upsert({
    where: { criancaId_responsavelId: { criancaId: c.id, responsavelId: r.id } },
    update: { status: "confirmado", parentesco, decididoPorId, decididoEm: new Date() },
    create: { criancaId: c.id, responsavelId: r.id, parentesco, origem: "manual", status: "confirmado", decididoPorId, decididoEm: new Date() },
  });
}

export async function vincularExterno(
  a: AcessoInfantojuvenil,
  criancaId: string,
  d: { nome: string; email: string | null; celular: string | null; cpf: string | null; parentesco: string | null },
  decididoPorId: string,
) {
  const c = await criancaDoAcesso(a, criancaId);
  const nome = d.nome.trim();
  if (nome.length < 3) throw new Error("Informe o nome do responsável.");
  const email = d.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  const cpf = digitos(d.cpf);
  if (cpf && cpf.length !== 11) throw new Error("CPF com 11 números.");
  if (!email && !digitos(d.celular)) throw new Error("Informe ao menos e-mail ou celular do responsável.");
  // Mesmo e-mail de um responsável já cadastrado na filial: reaproveita (um responsável, vários filhos).
  const ja = email ? await db.responsavel.findFirst({ where: { schoolId: c.schoolId, email } }) : null;
  const r =
    ja ??
    (await db.responsavel.create({
      data: { schoolId: c.schoolId, nome, email, celular: d.celular?.trim() || null, cpfCifrado: cpf ? cifrar(cpf, "responsavel-cpf") : null, criadoPorId: decididoPorId },
    }));
  await db.vinculoResponsavel.upsert({
    where: { criancaId_responsavelId: { criancaId: c.id, responsavelId: r.id } },
    update: { status: "confirmado", parentesco: d.parentesco, decididoPorId, decididoEm: new Date() },
    create: { criancaId: c.id, responsavelId: r.id, parentesco: d.parentesco, origem: "manual", status: "confirmado", decididoPorId, decididoEm: new Date() },
  });
}

/** Adultos ativos da filial da criança, para escolher o responsável. */
export async function buscarAdultos(a: AcessoInfantojuvenil, criancaId: string, termo: string) {
  const c = await criancaDoAcesso(a, criancaId);
  const t = termo.trim();
  if (t.length < 3) return [];
  return db.member.findMany({
    where: { schoolId: c.schoolId, mercurioAtivo: true, NOT: { nivel: { in: [...NIVEIS_INFANTIS] } }, OR: [{ name: { contains: t, mode: "insensitive" } }, { mercurioId: t }] },
    select: { id: true, name: true, mercurioId: true },
    take: 10,
    orderBy: { name: "asc" },
  });
}
