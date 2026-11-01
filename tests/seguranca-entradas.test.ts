import assert from "node:assert/strict";
import test from "node:test";
import { destinoSeguro } from "../src/lib/login-acropole";
import { GET } from "../src/app/api/imagem-evento/route";

test("depois do login, só caminhos do próprio Portal", () => {
  assert.equal(destinoSeguro("/diario?dia=2026-11-01"), "/diario?dia=2026-11-01");
  assert.equal(destinoSeguro("/grupos/abc#topo"), "/grupos/abc#topo");
  for (const ruim of ["//site.com", "/\\site.com", "/%09/site.com", "/\t/site.com", "https://site.com", "javascript:alert(1)", "", null, undefined]) {
    assert.equal(destinoSeguro(ruim), "/portal", String(ruim));
  }
});

test("imagem do evento: só o bucket do Ulisses, sem trocar de bucket pelo caminho", async () => {
  const pedir = (url: string) => GET(new Request(`http://localhost/api/imagem-evento?url=${encodeURIComponent(url)}`));
  for (const ruim of [
    "https://s3-sa-east-1.amazonaws.com/br.com.acropolebrasil.outro/x.png",
    "https://s3-sa-east-1.amazonaws.com/br.com.acropolebrasil.ckfinder/../atacante/x.svg",
    "https://s3-sa-east-1.amazonaws.com/br.com.acropolebrasil.ckfinder/%2e%2e/atacante/x.svg",
    "http://s3-sa-east-1.amazonaws.com/br.com.acropolebrasil.ckfinder/x.png",
    "https://evil.com/br.com.acropolebrasil.ckfinder/x.png",
  ]) {
    const r = await pedir(ruim);
    assert.equal(r.status, 400, ruim);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  }
});
