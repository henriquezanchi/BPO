import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase pra Server Components/Actions — lê/escreve a sessão via
 * cookies (Next.js 16: cookies() é assíncrono). Usar SEMPRE que precisar
 * saber quem está logado no servidor (proxy.ts, páginas, server actions).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de dentro de um Server Component (não pode setar cookie
          // fora de Server Action/Route Handler) — o proxy.ts já cuida de
          // refrescar a sessão a cada request, então isso é seguro ignorar.
        }
      },
    },
  });
}
