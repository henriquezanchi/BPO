"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { enviarPush } from "@/lib/push";
import { acessoSugestoes } from "@/lib/sugestoes";
import { LIMITE_DIA, RESPOSTA_MAX, categoria, ehCategoria, ehStatus, lerAparelho, lerTexto, podeLer } from "@/lib/sugestoes-comum";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

/** Caixa de sugestões (lib/sugestoes.ts). Cada ação reconfere quem é a pessoa e o que ela pode ler. */
const erro = (error: string) => ({ ok: false as const, error });

export async function enviarSugestao(dados: { categoria: string; texto: string; anonima: boolean; largura?: number; app?: boolean }) {
  const eu = await getAuthenticatedMember();
  if (!eu) return erro("Entre no Portal de novo para enviar.");
  if (!ehCategoria(dados?.categoria)) return erro("Escolha uma categoria.");
  const t = lerTexto(dados?.texto);
  if (!t.ok) return erro(t.erro);
  const desde = new Date(Date.now() - 24 * 3600_000);
  if ((await db.sugestaoPortal.count({ where: { memberId: eu.id, createdAt: { gte: desde } } })) >= LIMITE_DIA)
    return erro("Você já enviou várias sugestões hoje. Tente de novo amanhã.");
  const ua = (await headers()).get("user-agent") ?? "";
  await db.sugestaoPortal.create({
    data: {
      memberId: eu.id,
      schoolId: eu.schoolId,
      categoria: dados.categoria,
      texto: t.texto,
      anonima: !!dados.anonima,
      aparelho: lerAparelho(ua, Number(dados?.largura) || null, !!dados?.app),
    },
  });
  revalidatePath("/portal/sugestoes");
  revalidatePath("/voluntario/sugestoes");
  return { ok: true as const };
}

async function registroQuePossoLer(id: string) {
  const eu = await getAuthenticatedMember();
  if (!eu) return null;
  const reg = await db.sugestaoPortal.findUnique({ where: { id } });
  if (!reg || !podeLer(await acessoSugestoes(eu), reg)) return null;
  return { eu, reg };
}

export async function mudarStatusSugestao(id: string, status: string) {
  if (!ehStatus(status) || status === "respondida") return erro("Situação inválida.");
  const ok = await registroQuePossoLer(id);
  if (!ok) return erro("Sugestão não encontrada.");
  await db.sugestaoPortal.update({ where: { id }, data: { status } });
  revalidatePath("/voluntario/sugestoes");
  return { ok: true as const };
}

/** Responde: quem enviou vê a resposta em "Minhas sugestões" e recebe um aviso no celular (se ativou). */
export async function responderSugestao(id: string, resposta: string) {
  const ok = await registroQuePossoLer(id);
  if (!ok) return erro("Sugestão não encontrada.");
  const texto = String(resposta ?? "").trim().slice(0, RESPOSTA_MAX);
  if (texto.length < 2) return erro("Escreva a resposta.");
  await db.sugestaoPortal.update({ where: { id }, data: { resposta: texto, status: "respondida", respondidaEm: new Date(), respondidaPorId: ok.eu.id } });
  await enviarPush([ok.reg.memberId], {
    titulo: "Sua sugestão foi respondida",
    corpo: `${categoria(ok.reg.categoria)?.rotulo ?? "Sugestão"}: ${texto.slice(0, 120)}${texto.length > 120 ? "…" : ""}`,
    url: "/portal/sugestoes",
    etiqueta: `sugestao-${id}`,
  }).catch(() => null);
  revalidatePath("/voluntario/sugestoes");
  revalidatePath("/portal/sugestoes");
  return { ok: true as const };
}
