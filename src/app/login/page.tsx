import { LoginClient } from "@/components/login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? searchParams.next : "/portal";

  const erro = typeof searchParams.erro === "string" ? searchParams.erro : null;

  // Só o login unificado (pedido do usuário 2026-10-22). E-mail e senha ficam escondidos em ?modo=senha, só para emergência.
  const comSenha = searchParams.modo === "senha";

  return <LoginClient next={next} erroInicial={erro} comSenha={comSenha} />;
}
