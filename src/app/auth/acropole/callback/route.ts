import { db } from "@/lib/db";
import { COOKIE_OIDC, trocarCodigo } from "@/lib/login-acropole";
import { importarPorEmail } from "@/lib/mercurio-db/primeiro-acesso";
import { salvarSessaoAgora } from "@/lib/agora/sessao";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";

/** Redirecionamento com cabeçalhos alteráveis: o Next acrescenta os cookies (sessão, PKCE) gravados por cookies(). */
function redirecionar(destino: string) {
  return new Response(null, { status: 302, headers: { location: destino } });
}

/**
 * Volta do login unificado da Nova Acrópole. Acha o cadastro do Portal pelo
 * e-mail da conta Nova Acrópole e abre a sessão normal do Portal (Supabase),
 * sem senha. Quem ainda não tinha login no Portal ganha um agora; logins
 * existentes não são recriados (recriar trocaria a senha).
 */
function erro(origem: string, mensagem: string) {
  const u = new URL("/login", origem);
  u.searchParams.set("erro", mensagem);
  return redirecionar(u.toString());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pote = await cookies();
  const salvo = pote.get(COOKIE_OIDC)?.value;
  pote.delete({ name: COOKIE_OIDC, path: "/auth/acropole" });
  if (url.searchParams.get("error"))
    return erro(
      url.origin,
      "O login da Nova Acrópole foi cancelado ou recusado.",
    );
  if (!salvo) return erro(url.origin, "O login expirou. Tente de novo.");
  const { verifier, state, nonce, next } = JSON.parse(salvo) as {
    verifier: string;
    state: string;
    nonce: string;
    next: string;
  };
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== state)
    return erro(url.origin, "Login inválido. Tente de novo.");

  let pessoa;
  try {
    pessoa = await trocarCodigo(code, verifier, nonce, url.origin);
  } catch (e) {
    console.error("Login Nova Acrópole:", e);
    return erro(
      url.origin,
      e instanceof Error
        ? e.message
        : "Não foi possível concluir o login da Nova Acrópole.",
    );
  }
  if (pessoa.email && !pessoa.emailVerificado) {
    return erro(url.origin, "Confirme o seu e-mail na conta Nova Acrópole (veja a mensagem que eles enviaram) e tente de novo.");
  }
  if (!pessoa.email) {
    console.error(
      "Login Nova Acrópole sem e-mail; campos recebidos:",
      pessoa.claims.join(","),
    );
    return erro(
      url.origin,
      "Sua conta Nova Acrópole não informou o e-mail. Entre com e-mail e senha (os 6 primeiros números do CPF) ou fale com a secretaria.",
    );
  }

  // 1) Conta do Portal com esse e-mail? Gera o acesso sem senha.
  let link = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: pessoa.email,
  });
  if (link.error) {
    // 2) Sem conta no Portal: cadastro ativo com esse e-mail e ainda sem login ganha um login agora.
    const buscar = () =>
      db.member.findMany({
        where: {
          email: { equals: pessoa.email, mode: "insensitive" },
          mercurioAtivo: true,
          authUserId: null,
        },
      });
    let membros = await buscar();
    // 3) Ninguém no Portal com esse e-mail: procura no Mercúrio e importa na hora (26/10/2026), se a unidade da
    //    pessoa já tem escola no Portal. Antes, quem não tinha sido importado não conseguia entrar.
    if (!membros.length) {
      const importado = await importarPorEmail(pessoa.email).catch((e) => {
        console.error("Login Nova Acrópole: importação no primeiro acesso falhou:", e);
        return { situacao: "erro" as const };
      });
      if (importado.situacao === "fora_do_portal")
        return erro(url.origin, "O Portal do Membro ainda não chegou à sua escola. Assim que chegar, você poderá entrar com esta mesma conta.");
      if (importado.situacao === "importado") membros = await buscar();
    }
    if (membros.length !== 1) {
      return erro(
        url.origin,
        membros.length
          ? "Mais de um cadastro da escola usa este e-mail. Fale com a secretaria para separar os cadastros."
          : `Não encontramos um cadastro ativo na escola com o e-mail ${pessoa.email}. Entre com o e-mail cadastrado na sua escola e a senha (os 6 primeiros números do CPF), ou fale com a secretaria.`,
      );
    }
    const criado = await supabaseAdmin.auth.admin.createUser({
      email: pessoa.email,
      email_confirm: true,
      password: crypto.randomBytes(24).toString("base64url"),
    });
    if (criado.error || !criado.data.user)
      return erro(
        url.origin,
        "Não foi possível criar seu acesso ao Portal. Fale com a secretaria.",
      );
    await db.member.update({
      where: { id: membros[0].id },
      data: { authUserId: criado.data.user.id },
    });
    link = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: pessoa.email,
    });
    if (link.error)
      return erro(
        url.origin,
        "Não foi possível abrir sua sessão. Tente de novo.",
      );
  }

  const usuario = link.data.user;
  const membro = usuario
    ? await db.member.findFirst({ where: { authUserId: usuario.id }, select: { id: true } })
    : null;
  if (!usuario || !membro) {
    return erro(
      url.origin,
      "Sua conta do Portal não está ligada a um cadastro. Fale com a secretaria.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (error)
    return erro(
      url.origin,
      "Não foi possível abrir sua sessão. Tente de novo.",
    );
  // Túnel do Ágora (2026-10-27): guarda os tokens do login unificado, cifrados, para o Portal chamar o Ágora como o
  // próprio aluno. Uma falha aqui não impede a entrada no Portal (só o Ágora não aparece).
  await salvarSessaoAgora(membro.id, pessoa.tokens).catch((e) =>
    console.error("Login Nova Acrópole: sessão do Ágora não gravada:", e instanceof Error ? e.message : e),
  );
  return redirecionar(new URL(next || "/portal", url.origin).toString());
}
