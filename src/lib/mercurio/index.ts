import type { MercurioAdapter } from "./adapter";
import { MockMercurioAdapter } from "./mock-adapter";
import { PlaywrightMercurioAdapter } from "./playwright-adapter";

const temCredenciaisReais = Boolean(
  process.env.MERCURIO_SUPABASE_URL && process.env.MERCURIO_SUPABASE_SERVICE_ROLE_KEY && process.env.MERCURIO_CREDENCIAIS_CHAVE,
);

export const mercurioAdapter: MercurioAdapter = temCredenciaisReais ? new PlaywrightMercurioAdapter() : new MockMercurioAdapter();

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
  MercurioWriteResult,
} from "./adapter";
