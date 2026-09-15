import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a service role key — ignora RLS e pode administrar
 * usuários de Auth (criar, resetar senha). NUNCA importar isso num Client
 * Component nem devolver pro navegador. Uso: provisionamento de conta
 * (scripts/provision-member-auth.ts) e qualquer operação administrativa
 * futura do BPO/Diretor.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
