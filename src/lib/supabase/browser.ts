"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase pra Client Components (ex: formulário de login). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
