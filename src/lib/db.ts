import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// A chave de API da subconta Asaas da filial nunca vem nas consultas comuns (elas acabam serializadas para o
// navegador, ex.: member.school no Portal). Quem precisa dela pede explicitamente (asaas/conta-escola.ts).
const criar = () => new PrismaClient({ adapter, omit: { school: { asaasSubaccountApiKey: true } } });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof criar> | undefined;
};

export const db = globalForPrisma.prisma ?? criar();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
