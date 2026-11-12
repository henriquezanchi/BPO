/**
 * Cadastra direto na Meta (WhatsApp Cloud API; a empresa é tech provider) os modelos do WhatsApp do financeiro
 * (src/lib/whatsapp/modelos.ts) e mostra a situação de cada um (12/11/2026). Precisa de WHATSAPP_TOKEN e WHATSAPP_WABA_ID:
 *   npx tsx scripts/whatsapp-modelos-meta.ts              (só lista a situação)
 *   npx tsx scripts/whatsapp-modelos-meta.ts --cadastrar  (envia os que faltam para aprovação)
 * Botões: nos avisos de pagamento, "Quero o código Pix" e "Falar com a Economia" vêm primeiro (índices 0 e 1, cujo
 * payload o Portal preenche no envio), depois "Sair da lista" e o link do Portal. Nos demais, "Sair da lista" e o link.
 * A Meta revisa em minutos a 24 h. Modelo recusado precisa de texto novo (e nome novo) em modelos.ts.
 */
import "dotenv/config";
import { chamarGraph } from "../src/lib/whatsapp/meta";
import { IDIOMA_MODELOS, MODELOS, RODAPE_MODELOS } from "../src/lib/whatsapp/modelos";

const waba = process.env.WHATSAPP_WABA_ID;
if (!waba) throw new Error("Falta WHATSAPP_WABA_ID no .env (conta do WhatsApp Business do número do financeiro).");
const PORTAL = process.env.PORTAL_URL ?? "https://portal-na-one.vercel.app";

async function main() {
  const { data } = await chamarGraph<{ data: { name: string; status: string; language: string }[] }>(`${waba}/message_templates?limit=200`, undefined, "GET");
  const situacao = new Map(data.filter((t) => t.language === IDIOMA_MODELOS).map((t) => [t.name, t.status]));
  for (const [nome, m] of Object.entries(MODELOS)) {
    const atual = situacao.get(nome);
    if (atual || !process.argv.includes("--cadastrar")) {
      console.log(`${nome}: ${atual ?? "não cadastrado"}`);
      continue;
    }
    const pagar = (m as { botoes?: readonly string[] }).botoes ?? [];
    await chamarGraph(`${waba}/message_templates`, {
      name: nome,
      category: "UTILITY",
      language: IDIOMA_MODELOS,
      components: [
        { type: "BODY", text: m.texto, example: { body_text: [m.exemplo] } },
        { type: "FOOTER", text: RODAPE_MODELOS },
        {
          type: "BUTTONS",
          buttons: [
            ...pagar.map((text) => ({ type: "QUICK_REPLY", text })),
            { type: "QUICK_REPLY", text: "Sair da lista" },
            { type: "URL", text: "Abrir o Portal", url: `${PORTAL}/portal` },
          ],
        },
      ],
    });
    console.log(`${nome}: enviado para aprovação`);
  }
}
main().catch((e) => console.error("ERRO", (e as Error).message)).finally(() => process.exit(0));
