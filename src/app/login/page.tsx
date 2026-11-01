import { LoginClient } from "@/components/login-client";
import { destinoSeguro } from "@/lib/login-acropole";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = destinoSeguro(typeof searchParams.next === "string" ? searchParams.next : null);

  const erro = typeof searchParams.erro === "string" ? searchParams.erro : null;

  // Só o login unificado (pedido do usuário 2026-10-22). E-mail e senha ficam escondidos em ?modo=senha, só para emergência.
  const comSenha = searchParams.modo === "senha";

  return <LoginClient next={next} erroInicial={erro} comSenha={comSenha} />;
}
