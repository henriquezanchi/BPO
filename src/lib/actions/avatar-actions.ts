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

/** Foto de perfil — pedido do usuário 2026-09-30: deixa o Portal mais pessoal e ajuda a diretoria a reconhecer quem é quem. */
export async function uploadAvatar(memberId: string, formData: FormData) {
  await requireAuthenticatedMember(memberId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Selecione uma imagem.");
  if (!file.type.startsWith("image/")) throw new Error("Só é possível enviar imagens.");
  if (file.size > TAMANHO_MAXIMO) throw new Error("Imagem muito grande — máximo 3MB.");

  await garantirBucket();

  const extensao = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".jpg";
  const path = `${memberId}/${Date.now()}${extensao}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (error) throw new Error(`Falha ao subir a imagem: ${error.message}`);

  const antigo = (await db.member.findUniqueOrThrow({ where: { id: memberId } })).avatarPath;
  await db.member.update({ where: { id: memberId }, data: { avatarPath: path } });
  if (antigo) await supabaseAdmin.storage.from(BUCKET).remove([antigo]).catch(() => {});

  revalidatePath("/portal");
  revalidatePath("/diretor");
  return { avatarUrl: getAvatarUrl(path) };
}

export async function removerAvatar(memberId: string) {
  await requireAuthenticatedMember(memberId);
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  if (member.avatarPath) await supabaseAdmin.storage.from(BUCKET).remove([member.avatarPath]).catch(() => {});
  await db.member.update({ where: { id: memberId }, data: { avatarPath: null } });
  revalidatePath("/portal");
  revalidatePath("/diretor");
}
