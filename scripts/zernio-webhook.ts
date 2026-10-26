/**
 * Cadastra na Zernio o webhook do Portal (/api/webhooks/zernio) com um segredo novo. O segredo vai direto para o
 * .env.local (ZERNIO_WEBHOOK_SECRET), sem aparecer na tela; depois copie a mesma variável para a Vercel.
 *   npx tsx --env-file=.env.local scripts/zernio-webhook.ts
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { chamarZernio } from "../src/lib/zernio/client";

const URL_WEBHOOK = `${process.env.PORTAL_URL ?? "https://portal-na-one.vercel.app"}/api/webhooks/zernio`;
const EVENTOS = ["message.delivered", "message.read", "message.failed", "message.received", "account.connected", "account.disconnected", "post.platform.published", "post.platform.failed"];

const { webhooks } = await chamarZernio<{ webhooks: { _id: string; url: string; name: string }[] }>("/webhooks/settings");
if (webhooks.some((w) => w.url === URL_WEBHOOK)) {
  console.log(`Já existe um webhook para ${URL_WEBHOOK}. Nada foi feito.`);
  process.exit(0);
}
if (readFileSync(".env.local", "utf8").includes("ZERNIO_WEBHOOK_SECRET=")) throw new Error("O .env.local já tem ZERNIO_WEBHOOK_SECRET; apague a linha antes de criar outro webhook.");

const segredo = randomBytes(32).toString("hex");
await chamarZernio("/webhooks/settings", { method: "POST", body: JSON.stringify({ name: "Portal Nova Acrópole", url: URL_WEBHOOK, secret: segredo, events: EVENTOS }) });
appendFileSync(".env.local", `\nZERNIO_WEBHOOK_SECRET=${segredo}\n`);
console.log(`Webhook criado para ${URL_WEBHOOK}. Segredo gravado no .env.local (ZERNIO_WEBHOOK_SECRET); copie-o para a Vercel.`);
