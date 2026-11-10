import test from "node:test";
import assert from "node:assert/strict";
import { linkWhatsappDaAvaliacao } from "../src/lib/avaliacao-comum";

test("convite da avaliação no WhatsApp: título em negrito e link para /avaliacao", () => {
  const link = linkWhatsappDaAvaliacao("Avaliação *geral* — novembro/2026");
  assert.ok(link.startsWith("https://wa.me/?text="));
  const texto = decodeURIComponent(link.slice("https://wa.me/?text=".length));
  assert.ok(texto.startsWith("*Avaliação geral — novembro/2026*"));
  assert.ok(texto.endsWith("Responda aqui: https://portal-na-one.vercel.app/avaliacao"));
});

test("convite da rodada leva ao link da própria rodada", () => {
  const texto = decodeURIComponent(linkWhatsappDaAvaliacao("Rodada", "abc123").slice("https://wa.me/?text=".length));
  assert.ok(texto.endsWith("Responda aqui: https://portal-na-one.vercel.app/avaliacao?rodada=abc123"));
});
