import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

// Conexões sob pico (01/11/2026): poucas por instância, com espera máxima, em vez do padrão do pg (10 por instância e
// espera sem fim, que esgotava o pooler do Supabase e deixava páginas presas até o tempo-limite). attachDatabasePool
// devolve as conexões ociosas antes de a Vercel congelar a função; fora da Vercel não faz nada.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 });
attachDatabasePool(pool);
const adapter = new PrismaPg(pool);

// A chave de API da subconta Asaas da filial nunca vem nas consultas comuns (elas acabam serializadas para o
// navegador, ex.: member.school no Portal). Quem precisa dela pede explicitamente (asaas/conta-escola.ts).
const criar = () => new PrismaClient({ adapter, omit: { school: { asaasSubaccountApiKey: true } } });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof criar> | undefined;
};

export const db = globalForPrisma.prisma ?? criar();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
