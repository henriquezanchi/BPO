import { db } from "@/lib/db";
import { fortunaGetBranches } from "@/lib/fortuna/client";
import { consultarMercurio } from "@/lib/mercurio-db/client";
import { fetchAcropole, ponteConfigurada } from "@/lib/ponte";

/**
 * Verificações de saúde dos serviços de que o Portal depende (26/10/2026). Usadas pela rotina /api/cron/saude
 * (de hora em hora, falha avisa o suporte) e pela página /admin/saude. Cada verificação lança erro se falhar.
 */
const TEMPO = 15_000;

async function comPrazo<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, nao) => setTimeout(() => nao(new Error(`sem resposta em ${TEMPO / 1000} s`)), TEMPO))]);
}

export const VERIFICACOES: Record<string, { titulo: string; checar: () => Promise<string> }> = {
  banco: {
    titulo: "Banco do Portal (Supabase)",
    checar: async () => `${await db.school.count()} escolas`,
  },
  ponte: {
    titulo: "Ponte da Cloudflare (login unificado, Ulisses, Fortuna)",
    checar: async () => {
      if (!ponteConfigurada()) return "não configurada (chamadas diretas)";
      const r = await comPrazo(fetch(`${process.env.PONTE_URL}/diagnostico`, { cache: "no-store" }));
      if (!r.ok) throw new Error(`diagnóstico respondeu ${r.status}`);
      const itens = (await r.json()) as { alvo: string; status?: number; bloqueado?: string | null; erro?: string }[];
      const ruins = itens.filter((i) => i.erro || i.bloqueado || (i.status ?? 0) >= 500);
      if (ruins.length) throw new Error(ruins.map((i) => `${new URL(i.alvo).host}: ${i.erro ?? i.bloqueado ?? i.status}`).join("; "));
      return `${itens.length} sistemas alcançados`;
    },
  },
  ulisses: {
    titulo: "Ulisses (eventos públicos)",
    checar: async () => {
      const r = await comPrazo(fetchAcropole("https://api.acropolebrasil.com.br/eventos/44", { headers: { accept: "application/json" }, cache: "no-store" }));
      if (!r.ok) throw new Error(`respondeu ${r.status}`);
      return `${((await r.json()) as unknown[]).length} eventos em Barra do Garças`;
    },
  },
  login: {
    titulo: "Login unificado (Keycloak)",
    checar: async () => {
      const r = await comPrazo(fetchAcropole("https://auth.acropolebrasil.com.br/as/realms/oinabnb/.well-known/openid-configuration", { cache: "no-store" }));
      if (!r.ok) throw new Error(`respondeu ${r.status}`);
      return "no ar";
    },
  },
  fortuna: {
    titulo: "Fortuna (carteira do Café)",
    checar: async () => `${(await comPrazo(fortunaGetBranches())).length} filiais`,
  },
  mercurio: {
    titulo: "Banco de consulta do Mercúrio",
    checar: async () => {
      const [r] = await comPrazo(consultarMercurio("SELECT COUNT(*) AS n FROM cadastro WHERE cad_situacao='ATI'"));
      return `${r?.n ?? "?"} ativos`;
    },
  },
  asaas: {
    titulo: "Asaas (conta principal)",
    checar: async () => {
      const base = process.env.ASAAS_ENV === "sandbox" ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
      if (!process.env.ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurado");
      const r = await comPrazo(fetch(`${base}/wallets`, { headers: { access_token: process.env.ASAAS_API_KEY, "User-Agent": "portal-na" }, cache: "no-store" }));
      if (!r.ok) throw new Error(`respondeu ${r.status}`);
      return "no ar";
    },
  },
};

export type ResultadoVerificacao = { chave: string; titulo: string; ok: boolean; detalhe: string; ms: number };

export async function verificarTudo(): Promise<ResultadoVerificacao[]> {
  return Promise.all(
    Object.entries(VERIFICACOES).map(async ([chave, v]) => {
      const t = Date.now();
      try {
        return { chave, titulo: v.titulo, ok: true, detalhe: await v.checar(), ms: Date.now() - t };
      } catch (e) {
        return { chave, titulo: v.titulo, ok: false, detalhe: e instanceof Error ? e.message : String(e), ms: Date.now() - t };
      }
    }),
  );
}
