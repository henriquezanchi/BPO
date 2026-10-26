import type { MercurioAdapter } from "./adapter";
import { MockMercurioAdapter } from "./mock-adapter";
import { PlaywrightMercurioAdapter } from "./playwright-adapter";
import { MercuryAdapter } from "@/lib/mercury/adapter";

const temCredenciaisReais = Boolean(
  process.env.MERCURIO_SUPABASE_URL && process.env.MERCURIO_SUPABASE_SERVICE_ROLE_KEY && process.env.MERCURIO_CREDENCIAIS_CHAVE,
);

/**
 * Sem credenciais, falha em vez de fingir (26/10/2026): o adaptador de teste devolvia { ok: true } e uma tarefa da
 * fila podia aparecer como lançada no Mercúrio sem ter sido gravada. O de teste só com MERCURIO_USAR_MOCK=1.
 */
const semCredenciais = new Proxy({} as MercurioAdapter, {
  get: (_alvo, metodo) => metodo === "then" ? undefined : async () => {
    throw new Error(`Credenciais do Mercúrio ausentes (MERCURIO_SUPABASE_URL, MERCURIO_SUPABASE_SERVICE_ROLE_KEY, MERCURIO_CREDENCIAIS_CHAVE): ${String(metodo)} não foi executado.`);
  },
});

export const mercurioAdapter: MercurioAdapter = temCredenciaisReais
  ? new PlaywrightMercurioAdapter()
  : process.env.MERCURIO_USAR_MOCK === "1"
    ? new MockMercurioAdapter()
    : semCredenciais;

const mercuryAdapter = new MercuryAdapter();

/** Escolhe o sistema-fonte pela escola (School.sistemaRegistro) — "mercury" = API nova; qualquer outra coisa = Mercúrio antigo via RPA. */
export function adapterParaEscola(school: { sistemaRegistro: string }): MercurioAdapter {
  return school.sistemaRegistro === "mercury" ? mercuryAdapter : mercurioAdapter;
}

export type {
  MercurioAdapter,
  MercurioCatalogItem,
  MercurioComposition,
  MercurioCompositionItem,
  MercurioContactChanges,
  MercurioContactData,
  MercurioMemberIdentity,
  MercurioPersonalChanges,
  MercurioPersonalData,
  MercurioReceiptContent,
  MercurioWriteResult,
} from "./adapter";
