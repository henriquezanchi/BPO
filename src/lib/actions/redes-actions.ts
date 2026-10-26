"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { avisarDono } from "@/lib/error-notify";
import { exigirGestaoDifusao, PRECO_INSTAGRAM_CENTAVOS } from "@/lib/redes-filial";
import { chamarZernio, linkDeConexao, perfilDaFilial, zernioConfigurado } from "@/lib/zernio/client";

async function origem() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "portal-na-one.vercel.app";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

/** Contrata o Instagram da filial (R$ 49/mês) e devolve o link para conectar a conta. */
export async function contratarInstagram(schoolId: string) {
  const member = await exigirGestaoDifusao(schoolId);
  if (!zernioConfigurado()) throw new Error("A conexão com o Instagram ainda não está disponível. Tente mais tarde.");
  const escola = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true } });
  const atual = await db.redeSocialFilial.findUnique({ where: { schoolId_rede: { schoolId, rede: "instagram" } } });
  if (!atual || atual.status === "cancelada") {
    await db.redeSocialFilial.upsert({
      where: { schoolId_rede: { schoolId, rede: "instagram" } },
      update: { status: "contratada", valorMensalCentavos: PRECO_INSTAGRAM_CENTAVOS, contratadaPorId: member.id, contratadaEm: new Date(), canceladaEm: null, conectadaEm: null, zernioAccountId: null, usuario: null },
      create: { schoolId, rede: "instagram", valorMensalCentavos: PRECO_INSTAGRAM_CENTAVOS, contratadaPorId: member.id },
    });
    await avisarDono(`📸 ${escola.name} contratou o Instagram da filial (R$ 49/mês), por ${member.name}. Emitir a cobrança mensal.`);
  }
  revalidatePath("/", "layout");
  return linkParaConectar(schoolId, escola.name);
}

/** Novo link de conexão (contratado e ainda não conectado, ou desconectado). */
export async function conectarInstagram(schoolId: string) {
  await exigirGestaoDifusao(schoolId);
  const escola = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true } });
  const atual = await db.redeSocialFilial.findUnique({ where: { schoolId_rede: { schoolId, rede: "instagram" } } });
  if (!atual || atual.status === "cancelada") throw new Error("Contrate o Instagram da filial antes de conectar.");
  return linkParaConectar(schoolId, escola.name);
}

async function linkParaConectar(schoolId: string, nome: string) {
  const profileId = await perfilDaFilial(schoolId, nome);
  await db.redeSocialFilial.update({ where: { schoolId_rede: { schoolId, rede: "instagram" } }, data: { zernioProfileId: profileId } });
  return linkDeConexao("instagram", profileId, `${await origem()}/api/integracoes/instagram?filial=${encodeURIComponent(schoolId)}`);
}

/** Cancela o pacote: desliga a conta na Zernio (para de contar como conta paga) e avisa o dono para parar a cobrança. */
export async function cancelarInstagram(schoolId: string) {
  const member = await exigirGestaoDifusao(schoolId);
  const atual = await db.redeSocialFilial.findUnique({ where: { schoolId_rede: { schoolId, rede: "instagram" } }, include: { school: { select: { name: true } } } });
  if (!atual || atual.status === "cancelada") return;
  if (atual.zernioAccountId) await chamarZernio(`/accounts/${atual.zernioAccountId}`, { method: "DELETE" }).catch((e) => console.error("Zernio: falha ao desligar a conta:", e));
  await db.redeSocialFilial.update({ where: { id: atual.id }, data: { status: "cancelada", canceladaEm: new Date(), zernioAccountId: null } });
  await avisarDono(`📸 ${atual.school.name} cancelou o Instagram da filial, por ${member.name}. Parar a cobrança mensal.`);
  revalidatePath("/", "layout");
}
