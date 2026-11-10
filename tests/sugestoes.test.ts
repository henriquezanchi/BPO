import { test } from "node:test";
import assert from "node:assert/strict";
import { descreverAparelho, destinoDa, lerAparelho, lerTexto, podeLer, semAcessoSugestoes } from "../src/lib/sugestoes-comum";

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const EDGE_WIN = `${CHROME_WIN} Edg/131.0.2903.70`;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const SAFARI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";

test("aparelho, sistema e navegador", () => {
  assert.deepEqual(lerAparelho(CHROME_WIN, 1440), { tipo: "computador", sistema: "Windows", navegador: "Chrome 131", largura: 1440, app: false });
  assert.equal(lerAparelho(EDGE_WIN).navegador, "Edge 131");
  assert.deepEqual(lerAparelho(IPHONE, 390, true), { tipo: "celular", sistema: "iOS", navegador: "Safari 18", largura: 390, app: true });
  assert.equal(lerAparelho(ANDROID).sistema, "Android");
  assert.equal(lerAparelho(ANDROID).tipo, "celular");
  assert.equal(lerAparelho(SAFARI_MAC).tipo, "computador");
  assert.equal(lerAparelho(SAFARI_MAC).navegador, "Safari 18");
  assert.equal(lerAparelho("", -5).largura, null);
  assert.equal(descreverAparelho(lerAparelho(CHROME_WIN, 1440)), "Computador · Windows · Chrome 131 · tela de 1440px");
});

test("texto: mínimo, máximo e espaços", () => {
  assert.equal(lerTexto("curto").ok, false);
  assert.equal(lerTexto("x".repeat(2001)).ok, false);
  const r = lerTexto("  Não consigo mudar o endereço\n\n\n\nno computador  ");
  assert.deepEqual(r, { ok: true, texto: "Não consigo mudar o endereço\n\nno computador" });
});

test("quem lê: Portal para a administração nacional, escola para a direção da filial", () => {
  assert.equal(destinoDa("portal_problema"), "portal");
  assert.equal(destinoDa("aulas"), "filial");
  assert.equal(destinoDa("inexistente"), "filial");
  const chefe = { portal: false, escolas: ["bga"] };
  assert.equal(podeLer(chefe, { categoria: "aulas", schoolId: "bga" }), true);
  assert.equal(podeLer(chefe, { categoria: "aulas", schoolId: "gyn" }), false);
  assert.equal(podeLer(chefe, { categoria: "portal_problema", schoolId: "bga" }), false);
  const nacional = { portal: true, escolas: "todas" as const };
  assert.equal(podeLer(nacional, { categoria: "portal_ideia", schoolId: "gyn" }), true);
  assert.equal(podeLer(nacional, { categoria: "espaco", schoolId: "gyn" }), true);
  assert.equal(semAcessoSugestoes({ portal: false, escolas: [] }), true);
  assert.equal(semAcessoSugestoes(chefe), false);
});

test("classificação: subcategoria obrigatória, assunto curto e contexto pedido", async () => {
  const { lerClassificacao, rotuloCompleto, textoDoProblema } = await import("../src/lib/sugestoes-comum");
  assert.equal(lerClassificacao({ categoria: "aulas", titulo: "Ritmo rápido" }).ok, false);
  assert.equal(lerClassificacao({ categoria: "aulas", subcategoria: "nao_existe", titulo: "Ritmo rápido" }).ok, false);
  assert.equal(lerClassificacao({ categoria: "aulas", subcategoria: "didatica", titulo: "oi" }).ok, false);
  assert.deepEqual(lerClassificacao({ categoria: "aulas", subcategoria: "didatica", titulo: "  Ritmo   rápido " }), {
    ok: true,
    categoria: "aulas",
    subcategoria: "didatica",
    titulo: "Ritmo rápido",
    contexto: "turma",
  });
  const ev = lerClassificacao({ categoria: "eventos", subcategoria: "evento", titulo: "Palestra de sábado" });
  assert.equal(ev.ok && ev.contexto, "evento");
  // "Outro assunto" não tem subcategoria.
  const outro = lerClassificacao({ categoria: "outro", titulo: "Assunto livre" });
  assert.equal(outro.ok && outro.subcategoria, null);
  assert.equal(rotuloCompleto("espaco", "sala"), "Espaço da escola › Sala de aula (cadeiras, som, luz, temperatura)");
  assert.equal(textoDoProblema(" abri ", " travou "), "O que tentei fazer: abri\n\nO que aconteceu: travou");
});
