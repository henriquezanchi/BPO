import test from "node:test";
import assert from "node:assert/strict";
import { idsDoEventoUlisses, inscritosDaLista } from "../src/lib/ulisses/inscritos";

test("ids do evento do Ulisses saem do externalUid", () => {
  assert.deepEqual(idsDoEventoUlisses("ulisses:24343:132:9001"), { eventoId: 24343, filialId: 132, produto: "9001" });
  assert.equal(idsDoEventoUlisses("manual:1"), null);
  assert.equal(idsDoEventoUlisses(null), null);
});

test("inscritos do Ulisses: só deste evento, alunos casados por e-mail ou celular, presença e ordem por nome", () => {
  const alunos = [
    { name: "Ana Souza", registrationNo: "123", email: "ana@exemplo.com", whatsapp: "66999990000" },
    { name: "Bruno Lima", registrationNo: "456", email: null, whatsapp: "(66) 98888-7777" },
  ];
  const lista = inscritosDaLista(
    [
      { nome: "Carla Público", email: "carla@x.com", ddd: "66", telefone: "911112222", emailEventos: [{ id: 3, evento: { id: 10 }, compareceu: false }] },
      { nome: "Ana  Souza", email: "ANA@exemplo.com ", emailEventos: [{ id: 1, evento: { id: 10 }, compareceu: true }, { id: 9, evento: { id: 77 } }] },
      { nome: "Bruno", ddd: 66, telefone: 88887777, emailEventos: [{ id: 2, evento: { id: 10 }, compareceu: null }] },
      { nome: "Outro Evento", emailEventos: [{ id: 4, evento: { id: 77 } }] },
    ],
    10,
    "p1",
    alunos,
  );
  assert.deepEqual(lista.map((i) => i.nome), ["Ana Souza", "Bruno", "Carla Público"]);
  assert.deepEqual(lista[0], { id: 1, nome: "Ana Souza", aluno: { nome: "Ana Souza", matricula: "123" }, compareceu: true });
  assert.equal(lista[1].aluno?.matricula, "456", "celular sem o 9 casa com o cadastro");
  assert.equal(lista[2].aluno, null);
});

test("inscritos do Ulisses: com produto informado, fica só a inscrição da data do Portal", () => {
  const [i] = inscritosDaLista([{ nome: "Ana", emailEventos: [{ id: 5, evento: { id: 10 }, produto: { id: 1 } }, { id: 6, evento: { id: 10 }, produto: { id: 2 }, compareceu: true }] }], 10, "2", []);
  assert.equal(i.id, 6);
  assert.equal(i.compareceu, true);
});
