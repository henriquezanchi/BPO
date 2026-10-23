import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "@/lib/auth";
import { recursosDaFilial } from "@/lib/recursos-filial";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decifrarLinkPlay, identidadePlayConfere, PLAY_LOGIN } from "@/lib/acropole-play/core";

import { acessoAutomaticoPlayHabilitado, chaveDoCofrePlay } from "@/lib/acropole-play/cofre";
import { encontrarOuVincularPlay } from "@/lib/acropole-play/acesso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
function manual() { return NextResponse.redirect(PLAY_LOGIN, { status:303, headers }); }

export async function GET() {
  // Não recebe ID de aluno nem endereço de redirecionamento do navegador.
  const member = await getAuthenticatedMember();
  if (!member) return NextResponse.json({ error:"Entre no Portal para acessar a Acrópole Play." }, { status:401, headers });
  if (!member.mercurioAtivo || !(await recursosDaFilial(member.schoolId)).acropole_play) {
    return NextResponse.json({ error:"Acesso não disponível para este cadastro." }, { status:403, headers });
  }
  try {
    if (!(await acessoAutomaticoPlayHabilitado())) return manual();
    const supabase = await createSupabaseServerClient();
    const { data:{user}, error } = await supabase.auth.getUser();
    if (error || !user || user.id!==member.authUserId || !user.email_confirmed_at || !member.email || user.email?.trim().toLowerCase()!==member.email.trim().toLowerCase()) return manual();
    const chave = await chaveDoCofrePlay();
    const acesso = await encontrarOuVincularPlay(member, chave);
    if (!acesso || !identidadePlayConfere(user.email, !!user.email_confirmed_at, acesso.emailHash)) return manual();
    const link = decifrarLinkPlay(acesso.loginCiphertext, acesso, chave);
    return NextResponse.redirect(link, { status:303, headers });
  } catch {
    // Não registrar erro bruto: URLs de autenticação não podem ir para logs.
    return NextResponse.json({ error:"O acesso automático está indisponível. Tente novamente mais tarde." }, {status:503,headers});
  }
}
