"use server";

import { requireAuthenticatedMember } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/avatar-url";
import { db } from "@/lib/db";
import { MEMBER_AVATARS_BUCKET as BUCKET } from "@/lib/storage-constants";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const TAMANHO_MAXIMO = 3 * 1024 * 1024; // 3MB — suficiente pra foto de celular, evita upload gigante sem querer

async function garantirBucket() {
  await supabaseAdmin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: TAMANHO_MAXIMO }).catch(() => {});
}

const TIPOS_DE_FOTO: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

/** O tipo informado pelo navegador confere com os primeiros bytes do arquivo (01/11/2026). */
function conteudoDeFoto(b: Uint8Array, tipo: string) {
  if (tipo === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (tipo === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (tipo === "image/webp") return String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  return false;
}

/** Foto de perfil — pedido do usuário 2026-09-30: deixa o Portal mais pessoal e ajuda a diretoria a reconhecer quem é quem. */
// Devolve { erro } em vez de lançar (25/11/2026): em produção o Next esconde a mensagem de um throw e a pessoa só via
// "Ocorreu um erro inesperado". A foto também é reduzida no aparelho antes de subir (profile-edit-panel.tsx), porque
// a foto original do celular passa do limite de corpo das ações do servidor.
export async function uploadAvatar(memberId: string, formData: FormData): Promise<{ avatarUrl: string | null; erro?: string }> {
  await requireAuthenticatedMember(memberId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { avatarUrl: null, erro: "Selecione uma imagem." };
  // Só fotos (31/10/2026): o bucket é público, e SVG pode carregar script.
  const extensao = TIPOS_DE_FOTO[file.type];
  if (!extensao) return { avatarUrl: null, erro: "Envie uma foto em JPG, PNG ou WebP." };
  if (file.size > TAMANHO_MAXIMO) return { avatarUrl: null, erro: "Imagem muito grande: o máximo é 3 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!conteudoDeFoto(bytes, file.type)) return { avatarUrl: null, erro: "Envie uma foto em JPG, PNG ou WebP." };

  await garantirBucket();

  const path = `${memberId}/${Date.now()}${extensao}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) {
    console.error("[avatar] falha ao subir", error.message);
    return { avatarUrl: null, erro: "Não deu para guardar a foto agora. Tente de novo em instantes." };
  }

  const antigo = (await db.member.findUniqueOrThrow({ where: { id: memberId } })).avatarPath;
  await db.member.update({ where: { id: memberId }, data: { avatarPath: path } });
  if (antigo) await supabaseAdmin.storage.from(BUCKET).remove([antigo]).catch(() => {});

  revalidatePath("/portal");
  revalidatePath("/", "layout");
  return { avatarUrl: getAvatarUrl(path) };
}

export async function removerAvatar(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  if (member.avatarPath) await supabaseAdmin.storage.from(BUCKET).remove([member.avatarPath]).catch(() => {});
  await db.member.update({ where: { id: memberId }, data: { avatarPath: null } });
  revalidatePath("/portal");
  revalidatePath("/", "layout");
}
