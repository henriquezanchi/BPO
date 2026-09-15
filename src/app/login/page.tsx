import { LoginClient } from "@/components/login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = typeof searchParams.next === "string" ? searchParams.next : "/portal";

  return <LoginClient next={next} />;
}
