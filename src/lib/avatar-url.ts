import { MEMBER_AVATARS_BUCKET as BUCKET } from "@/lib/storage-constants";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Função síncrona pura — fica FORA de avatar-actions.ts de propósito:
 * "use server" só pode exportar async function (mesmo motivo de
 * ACCOUNTANT_DOCS_BUCKET estar em storage-constants.ts em vez de junto
 * das actions). Chamada tanto de Server Components (director-data.ts,
 * member-data.ts) quanto da própria avatar-actions.ts.
 */
export function getAvatarUrl(avatarPath: string | null): string | null {
  if (!avatarPath) return null;
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(avatarPath);
  return publicUrl;
}
