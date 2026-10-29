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
    titulo: "Ulisses (eventos públicos e importação diária)",
    // Antes só conferia se a API respondia (29/10/2026: "o Ulisses estava sem importar e não foi apontado"). Agora
    // também falha se a importação diária não rodou nas últimas 26 h ou terminou com erro em alguma filial.
    checar: async () => {
      const r = await comPrazo(fetchAcropole("https://api.acropolebrasil.com.br/eventos/44", { headers: { accept: "application/json" }, cache: "no-store" }));
      if (!r.ok) throw new Error(`API respondeu ${r.status}`);
      const rotina = await db.resumoNacional.findUnique({ where: { chave: "rotina:ulisses" } });
      if (!rotina) throw new Error("API no ar, mas a importação diária nunca rodou");
      const quando = rotina.geradoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      if (Date.now() - rotina.geradoEm.getTime() > 26 * 3600_000) throw new Error(`API no ar, mas a importação não roda desde ${quando}`);
      const dados = rotina.dados as { ok?: boolean; falhas?: string[] };
      if (dados.ok === false) throw new Error(`importação de ${quando} com erro: ${(dados.falhas ?? []).join("; ").slice(0, 200)}`);
      const futuros = await db.event.count({ where: { source: "ulisses", status: "publicado", startsAt: { gte: new Date() } } });
      return `API no ar · importado em ${quando} · ${futuros} eventos futuros no Portal`;
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
        // Uma oscilação de um minuto não deve virar alerta (28/10/2026, Ulisses lento por um instante): falhou, tenta
        // de novo depois de 3 s; só a segunda falha conta.
        const detalhe = await v.checar().catch(async () => {
          await new Promise((ok) => setTimeout(ok, 3000));
          return v.checar();
        });
        return { chave, titulo: v.titulo, ok: true, detalhe, ms: Date.now() - t };
      } catch (e) {
        return { chave, titulo: v.titulo, ok: false, detalhe: e instanceof Error ? e.message : String(e), ms: Date.now() - t };
      }
    }),
  );
}
