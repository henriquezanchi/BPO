import test from "node:test";
import assert from "node:assert/strict";
import type { AgendaItem } from "../src/lib/member-data";
import { itensDoMes, textoWhatsappProgramacao, turmaDoMes } from "../src/lib/programacao-mes";

const reuniao = (id: string, iso: string, title: string, description = ""): AgendaItem => ({ kind: "reuniao", id, title, date: new Date(iso), endsAt: new Date(iso), className: "Turma Hilárion", description, fullUniform: false, status: "agendada", cancellationReason: null, version: 1, myResponse: null });
const prova: AgendaItem = { kind: "atividade", id: "p", title: "Prova", date: new Date("2026-12-09T22:30:00Z"), type: "prova", materiaNome: "Psicologia", temas: ["Vontade"], observacao: null, resumos: [], studyItems: null, description: null, className: "Turma Hilárion", reactions: [] };

test("itens do mês: dia da semana real, horário no fuso, prova marcada, cancelada entra como \"Sem reunião\" (só na arte)", () => {
  const itens = itensDoMes(
    [reuniao("a", "2026-12-02T22:30:00Z", "Revisão para a prova", "ISO e Psicologia"), prova, { ...(reuniao("c", "2026-12-16T22:30:00Z", "Aula") as object), status: "cancelada" } as AgendaItem, reuniao("n", "2026-11-25T22:30:00Z", "Aula")],
    2026,
    12,
    "America/Sao_Paulo",
  );
  assert.equal(itens.length, 3);
  assert.deepEqual([itens[0].dia, itens[0].semana, itens[0].horario, itens[0].tipo], [2, 3, "19h30", "revisao"]);
  assert.equal(itens[1].tipo, "prova");
  assert.equal(itens[1].descricao, "Psicologia · Vontade");
  // Cancelada (24/11/2026): vai para a arte como "Sem reunião" e fica fora do texto do WhatsApp.
  assert.deepEqual([itens[2].tipo, itens[2].titulo], ["cancelada", "Sem reunião"]);
  assert.doesNotMatch(textoWhatsappProgramacao({ turma: null, publico: "Membros", ano: 2026, mes: 12, itens }), /Sem reunião/);
});

test("texto do WhatsApp: formato, prova com aviso, até 3 emojis e mensagem-chave", () => {
  const itens = itensDoMes([reuniao("a", "2026-12-02T22:30:00Z", "Revisão para a prova", "ISO e Psicologia"), prova, reuniao("b", "2026-12-12T13:00:00Z", "Aula especial e confraternização")], 2026, 12, "America/Sao_Paulo");
  const t = textoWhatsappProgramacao({ turma: turmaDoMes([prova]), publico: "Membros", ano: 2026, mes: 12, itens });
  assert.match(t, /^\*Programação da Turma Hilárion em dezembro\* 🏛️/);
  // Atividade tem prazo (dia), não horário de aula: sai sem hora.
  assert.match(t, /⚠️ \*09\/12 \(qua\)\* – \*Prova\*: Psicologia · Vontade/);
  assert.match(t, /\*02\/12 \(qua\), 19h30\* – Revisão para a prova: ISO e Psicologia/);
  assert.match(t, /🎉/);
  assert.match(t, /_Todos aprendemos e todos ensinamos_$/);
  assert.ok((t.match(/\p{Extended_Pictographic}/gu) ?? []).length <= 3);
  assert.ok(t.length <= 900);
});
