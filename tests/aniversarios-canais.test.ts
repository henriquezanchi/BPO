import assert from "node:assert/strict";
import test from "node:test";
import { celebracaoDeHoje, diasQueComemoramHoje, textoParabens, textoParaColegas, textoTempoDeCasa } from "../src/lib/aniversarios";
import { anosDeCasa } from "../src/lib/badges";
import { calcularCanais, mesesEntre } from "../src/lib/mercurio-db/resumo-filial";

const meioDia = (iso: string) => new Date(`${iso}T12:00:00Z`);

test("meses completos entre datas", () => {
  assert.equal(mesesEntre("2025-01-15", "2025-04-14"), 2);
  assert.equal(mesesEntre("2025-01-15", "2025-04-15"), 3);
  assert.equal(mesesEntre("2024-11-30", "2025-11-30"), 12);
});

test("canais: permanência só conta quem já teve tempo de ficar", () => {
  const c = calcularCanais(
    [
      { canal: "Contato pessoal", ingresso: "2025-01-10", ativo: true, baixa: null }, // 22 meses, ficou
      { canal: "Contato pessoal", ingresso: "2025-03-01", ativo: false, baixa: "2025-05-15" }, // saiu com 2 meses
      { canal: "Contato pessoal", ingresso: "2026-09-01", ativo: true, baixa: null }, // 2 meses: fora das bases
      { canal: "Internet-página Web", ingresso: "2025-06-01", ativo: false, baixa: "2026-01-10" }, // saiu com 7 meses
    ],
    "2026-11-06",
  );
  assert.equal(c[0].canal, "Contato pessoal");
  assert.deepEqual({ entraram: c[0].entraram, ativos: c[0].ativos }, { entraram: 3, ativos: 2 });
  assert.deepEqual(c[0].m3, { base: 2, ficaram: 1 });
  assert.deepEqual(c[0].m12, { base: 2, ficaram: 1 });
  const web = c.find((x) => x.canal.startsWith("Internet"))!;
  assert.deepEqual(web.m6, { base: 1, ficaram: 1 });
  assert.deepEqual(web.m12, { base: 1, ficaram: 0 });
});

test("29 de fevereiro comemora no dia 28 em ano não bissexto", () => {
  assert.deepEqual(diasQueComemoramHoje("2027-02-28"), [{ mes: 2, dia: 28 }, { mes: 2, dia: 29 }]);
  assert.deepEqual(diasQueComemoramHoje("2028-02-28"), [{ mes: 2, dia: 28 }]);
  assert.deepEqual(diasQueComemoramHoje("2026-11-06"), [{ mes: 11, dia: 6 }]);
});

test("celebração do dia: aniversário vence o tempo de casa; casa só a partir de 1 ano", () => {
  assert.deepEqual(celebracaoDeHoje("2026-11-06", meioDia("1990-11-06"), meioDia("2020-11-06")), { tipo: "aniversario" });
  assert.deepEqual(celebracaoDeHoje("2026-11-06", meioDia("1990-01-02"), meioDia("2020-11-06")), { tipo: "casa", anos: 6 });
  assert.equal(celebracaoDeHoje("2026-11-06", null, meioDia("2026-11-06")), null);
  assert.equal(celebracaoDeHoje("2026-11-06", null, null), null);
});

test("textos dos avisos em nome da Nova Acrópole", () => {
  assert.equal(textoParabens("MARIA DE TESTE SILVA").titulo, "Feliz aniversário, Maria!");
  assert.ok(textoParabens("Maria").corpo.startsWith("A Nova Acrópole celebra com você"));
  assert.equal(textoParaColegas(["MARIA DE TESTE"]).titulo, "Hoje é aniversário de Maria Teste");
  assert.equal(textoParaColegas(["ANA LIMA", "JOÃO REIS", "ANA LIMA"]).corpo, "Ana Lima e João Reis fazem aniversário. Que tal dar os parabéns?");
  assert.equal(textoTempoDeCasa("JOSÉ", 1).titulo, "1 ano de Nova Acrópole!");
  assert.equal(textoTempoDeCasa("JOSÉ", 5).titulo, "5 anos de Nova Acrópole!");
});

test("anos de casa pelo calendário", () => {
  assert.equal(anosDeCasa(meioDia("2020-11-07"), meioDia("2026-11-06")), 5);
  assert.equal(anosDeCasa(meioDia("2020-11-06"), meioDia("2026-11-06")), 6);
});
