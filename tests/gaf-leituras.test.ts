import test from "node:test";
import assert from "node:assert/strict";
import { leiturasEmSequencia, rotuloTexto, SEM_LEITURA, TEXTOS_GAF, textoGaf } from "../src/lib/gaf-leituras";

test("cronograma do Teseu: 24 textos em 6 bimestres, com link para o site do GAF", () => {
  assert.equal(TEXTOS_GAF.length, 24);
  assert.equal(rotuloTexto(TEXTOS_GAF[0]), "#01 – O Heroísmo");
  assert.equal(TEXTOS_GAF[23].url, "https://gaf.oinabn.com.br/artigos/teseu/artigo24.html");
  assert.equal(TEXTOS_GAF[4].bimestre, 2);
  assert.equal(textoGaf("teseu-07")?.titulo, "Do maravilhoso que é transmitir o Ideal Filosófico");
  assert.equal(textoGaf("inexistente"), null);
});

test("sequência: a partir do primeiro texto escolhido, os próximos encontros seguem o cronograma", () => {
  const r = leiturasEmSequencia([
    { id: "a", leituraGaf: null },
    { id: "b", leituraGaf: "teseu-05" },
    { id: "c", leituraGaf: null },
    { id: "d", leituraGaf: SEM_LEITURA },
    { id: "e", leituraGaf: null },
    { id: "f", leituraGaf: "teseu-10" },
    { id: "g", leituraGaf: null },
  ]);
  assert.equal(r.get("a")!.origem, "a_definir");
  assert.equal(r.get("b")!.texto?.numero, 5);
  assert.equal(r.get("b")!.origem, "escolhida");
  assert.equal(r.get("c")!.texto?.numero, 6);
  assert.equal(r.get("c")!.origem, "automatica");
  assert.equal(r.get("d")!.origem, "sem_leitura");
  assert.equal(r.get("e")!.texto?.numero, 7, "sem leitura não avança a sequência");
  assert.equal(r.get("f")!.texto?.numero, 10, "escolha manual recomeça dali");
  assert.equal(r.get("g")!.texto?.numero, 11);
});

test("fim do cronograma: depois do último texto, os encontros ficam a definir", () => {
  const r = leiturasEmSequencia([
    { id: "a", leituraGaf: "teseu-24" },
    { id: "b", leituraGaf: null },
    { id: "c", leituraGaf: null },
  ]);
  assert.equal(r.get("b")!.origem, "a_definir");
  assert.equal(r.get("c")!.origem, "a_definir");
});
