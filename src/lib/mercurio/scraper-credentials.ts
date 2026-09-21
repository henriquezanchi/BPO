import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente pro projeto Supabase do scraper/CRM (crm-agencia-na) — DIFERENTE
 * do Supabase do BPO (src/lib/supabase.ts, src/lib/db.ts). É onde ficam
 * cifradas as credenciais reais do Mercúrio e a trava de concorrência.
 *
 * Criado sob demanda (não no topo do módulo) — em produção (Docker/Railway)
 * as env vars só existem em runtime, não durante `next build`, e o Next
 * importa este módulo ao coletar dados de TODAS as rotas (inclusive as que
 * nunca chamam essas funções), então um client "eager" derrubava o build.
 */
let scraperSupabase: SupabaseClient | null = null;
function getScraperSupabase(): SupabaseClient {
  if (!scraperSupabase) {
    scraperSupabase = createClient(process.env.MERCURIO_SUPABASE_URL!, process.env.MERCURIO_SUPABASE_SERVICE_ROLE_KEY!);
  }
  return scraperSupabase;
}

const LIMITE_RODADA_ATIVA_MS = 5 * 60 * 1000; // mesmo limiar do scraper original (js/scraper-progresso.js)

/**
 * A credencial do Mercúrio é compartilhada entre TODOS os usuários/filiais
 * — login concorrente já corrompeu dado entre filiais em produção (ver
 * scraper/mercurio.js, crm-agencia-na). Por isso QUALQUER automação que
 * loga no Mercúrio — o scraper agendado E este adapter — precisa checar e
 * respeitar a mesma trava (scraper_progresso) antes de logar.
 */
export async function verificarRodadaJaEmAndamento() {
  const { data } = await getScraperSupabase().from("scraper_progresso").select("*").eq("id", "mercurio").maybeSingle();
  if (!data || data.concluido || !data.atualizado_em) return null;
  const idadeMs = Date.now() - new Date(data.atualizado_em).getTime();
  if (idadeMs > LIMITE_RODADA_ATIVA_MS) return null; // travada/morta — não bloqueia
  return data as { filial: string | null; etapa: string | null; atualizado_em: string };
}

export async function lerCredencialMercurio(sistema: "mercurio" | "mercurio_http") {
  const { data, error } = await getScraperSupabase().rpc("ler_credencial_scraper", {
    p_sistema: sistema,
    p_filial: "GLOBAL",
    p_chave: process.env.MERCURIO_CREDENCIAIS_CHAVE,
  });
  if (error) throw new Error(`Erro ao ler credencial de ${sistema}: ${error.message}`);
  if (!data || data.length === 0) throw new Error(`Nenhuma credencial salva pra ${sistema}/GLOBAL.`);
  return data[0] as { usuario: string; senha: string };
}
