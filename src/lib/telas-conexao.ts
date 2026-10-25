import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import crypto from "node:crypto";

/**
 * Conexão da TV pelo controle remoto (pedido do usuário 2026-10-24): a TV abre /tv e recebe um
 * código de 6 números (e um QR para /tv/conectar?c=…). Um voluntário logado, com a área Eventos,
 * escolhe a tela; a TV, que guarda só o segredo, consulta e é levada ao link da tela.
 * Ninguém digita nada na TV além do endereço curto, e o código sozinho não mostra tela nenhuma.
 */
const VALIDADE_MS = 15 * 60_000;
const MAX_PENDENTES = 300; // rota pública: limite contra quem tente encher a tabela

export async function criarConexao() {
  const agora = new Date();
  await db.tvConexao.deleteMany({ where: { expiraEm: { lt: new Date(agora.getTime() - 60 * 60_000) } } });
  if ((await db.tvConexao.count({ where: { expiraEm: { gt: agora }, telaId: null } })) >= MAX_PENDENTES) throw Error("Muitas TVs aguardando agora. Tente de novo em alguns minutos.");
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    try {
      return await db.tvConexao.create({
        data: { codigo, segredo: crypto.randomBytes(24).toString("base64url"), expiraEm: new Date(agora.getTime() + VALIDADE_MS) },
        select: { codigo: true, segredo: true, expiraEm: true },
      });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  throw Error("Não foi possível gerar o código. Tente de novo.");
}

/** Consulta da TV. Conectada, devolve o token da tela uma vez e apaga a conexão. */
export async function situacaoConexao(segredo: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(segredo)) return { situacao: "expirada" as const };
  const c = await db.tvConexao.findUnique({ where: { segredo }, select: { id: true, expiraEm: true, tela: { select: { token: true } } } });
  if (c?.tela) {
    await db.tvConexao.delete({ where: { id: c.id } });
    return { situacao: "conectada" as const, token: c.tela.token };
  }
  if (!c || c.expiraEm < new Date()) return { situacao: "expirada" as const };
  return { situacao: "aguardando" as const };
}

export function normalizarCodigo(codigo: string) {
  const d = codigo.replace(/\D/g, "");
  return d.length === 6 ? d : null;
}
