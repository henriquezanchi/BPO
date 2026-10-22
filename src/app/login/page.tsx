import { LoginClient } from "@/components/login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? searchParams.next : "/portal";

  const erro = typeof searchParams.erro === "string" ? searchParams.erro : null;

  return <LoginClient next={next} erroInicial={erro} />;
}
