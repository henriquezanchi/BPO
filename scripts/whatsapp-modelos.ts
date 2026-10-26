/**
 * Cadastra na Meta (via Zernio) os modelos do WhatsApp do financeiro (src/lib/whatsapp/modelos.ts) e mostra a
 * situação de cada um. Rodar depois de conectar o número central e pôr ZERNIO_WHATSAPP_ACCOUNT_ID no .env:
 *   npx tsx --env-file=.env scripts/whatsapp-modelos.ts            (só lista a situação)
 *   npx tsx --env-file=.env scripts/whatsapp-modelos.ts --cadastrar (envia os que faltam para aprovação)
 * A Meta revisa em minutos a 24 h. Um modelo recusado precisa de texto novo (e nome novo) em modelos.ts.
 */
import { chamarZernio } from "../src/lib/zernio/client";
import { IDIOMA_MODELOS, MODELOS, RODAPE_MODELOS } from "../src/lib/whatsapp/modelos";

const conta = process.env.ZERNIO_WHATSAPP_ACCOUNT_ID;
if (!conta) throw new Error("Falta ZERNIO_WHATSAPP_ACCOUNT_ID no .env (id da conta do número central na Zernio).");
const PORTAL = process.env.PORTAL_URL ?? "https://portal-na-one.vercel.app";

type Modelo = { name: string; status: string; language: string };
const { templates } = await chamarZernio<{ templates: Modelo[] }>(`/whatsapp/templates?accountId=${conta}&language=${IDIOMA_MODELOS}`);
const situacao = new Map(templates.map((t) => [t.name, t.status]));

for (const [nome, m] of Object.entries(MODELOS)) {
  const atual = situacao.get(nome);
  if (atual || !process.argv.includes("--cadastrar")) {
    console.log(`${nome}: ${atual ?? "não cadastrado"}`);
    continue;
  }
  await chamarZernio("/whatsapp/templates", {
    method: "POST",
    body: JSON.stringify({
      accountId: conta,
      name: nome,
      category: "UTILITY",
      language: IDIOMA_MODELOS,
      components: [
        { type: "body", text: m.texto, example: { body_text: [m.exemplo] } },
        { type: "footer", text: RODAPE_MODELOS },
        {
          type: "buttons",
          buttons: [
            { type: "url", text: "Abrir o Portal", url: `${PORTAL}/portal` },
            { type: "quick_reply", text: "Sair da lista" },
          ],
        },
      ],
    }),
  });
  console.log(`${nome}: enviado para aprovação`);
}
