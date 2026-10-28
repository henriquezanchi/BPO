import { LoginClient } from "@/components/login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? searchParams.next : "/portal";

  const erro = typeof searchParams.erro === "string" ? searchParams.erro : null;

  // E-mail e senha (6 primeiros números do CPF) de volta à tela, ao lado do login unificado (pedido do usuário 2026-10-27:
  // em Barra do Garças há quem não consiga entrar pela conta Nova Acrópole).
  return <LoginClient next={next} erroInicial={erro} />;
}
