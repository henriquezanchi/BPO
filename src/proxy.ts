import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROTAS_PROTEGIDAS = ["/portal"];

/**
 * Next.js 16: "middleware" foi renomeado pra "proxy" (arquivo E nome da
 * função). Duas responsabilidades por request, seguindo o padrão do
 * @supabase/ssr: (1) refrescar o cookie de sessão antes que expire, (2)
 * mandar quem não está logado pro /login antes de renderizar /portal/**.
 *
 * NÃO cobre Server Actions (não são uma rota separada no matcher — ver
 * aviso na doc do Next 16) — por isso src/lib/auth.ts também valida a
 * sessão dentro de cada action que recebe um memberId.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isRotaProtegida = ROTAS_PROTEGIDAS.some((rota) => request.nextUrl.pathname.startsWith(rota));
  if (isRotaProtegida && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
