import type { MercurioAdapter } from "./adapter";
import { MockMercurioAdapter } from "./mock-adapter";
import { PlaywrightMercurioAdapter } from "./playwright-adapter";
import { MercuryAdapter } from "@/lib/mercury/adapter";

const temCredenciaisReais = Boolean(
  process.env.MERCURIO_SUPABASE_URL && process.env.MERCURIO_SUPABASE_SERVICE_ROLE_KEY && process.env.MERCURIO_CREDENCIAIS_CHAVE,
);

export const mercurioAdapter: MercurioAdapter = temCredenciaisReais ? new PlaywrightMercurioAdapter() : new MockMercurioAdapter();

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
