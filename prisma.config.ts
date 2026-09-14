import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations precisam de conexão direta (não pooled) — o pooler em modo
    // "transaction" (porta 6543) não suporta os prepared statements/advisory
    // locks que `migrate` usa, e a CLI trava esperando. O client de runtime
    // (src/lib/db.ts) continua usando DATABASE_URL, que é o pooler.
    url: env("DIRECT_URL"),
  },
});
