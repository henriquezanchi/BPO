import assert from "node:assert/strict";
import test from "node:test";
import { escondidos, chaveDoItem } from "../src/lib/alertas/corrigidos";
import { quemEstaSumindo, textoResumoDirecao } from "../src/lib/avisos-direcao";
import { agoraNoFuso, diaDaSemana, minutoDoLembrete, textoLembreteAula } from "../src/lib/lembrete-aula";

test("dia da semana do Mercúrio, com ou sem acento e '-feira'", () => {
  assert.equal(diaDaSemana("QUINTA"), 4);
  assert.equal(diaDaSemana("Sábado"), 6);
  assert.equal(diaDaSemana("terça-feira"), 2);
  assert.equal(diaDaSemana("DOMINGO"), 0);
  assert.equal(diaDaSemana("???"), null);
});

test("lembrete 3 h antes, nunca antes das 7h", () => {
  assert.equal(minutoDoLembrete("19:30:00"), 16 * 60 + 30);
  assert.equal(minutoDoLembrete("09:00"), 7 * 60);
  assert.equal(minutoDoLembrete("07:00"), 7 * 60);
  assert.equal(minutoDoLembrete(""), null);
  assert.equal(minutoDoLembrete("00:00"), null);
});

test("texto do lembrete com sala, online ou sem sala", () => {
  assert.deepEqual(textoLembreteAula("AMON", "19:30:00", "Platão"), { titulo: "Aula hoje às 19h30", corpo: "Turma Amon, sala Platão." });
  assert.equal(textoLembreteAula("AMIGOS", "20:00", "Online").corpo, "Turma Amigos, aula online.");
  assert.equal(textoLembreteAula("AMIGOS", "20:00", null).titulo, "Aula hoje às 20h");
});

test("data, dia da semana e minuto no fuso", () => {
  // 06/11/2026 é sexta; 22h UTC = 19h em Brasília e 18h em Cuiabá.
  assert.deepEqual(agoraNoFuso(new Date("2026-11-06T22:00:00Z"), "America/Sao_Paulo"), { hoje: "2026-11-06", semana: 5, minuto: 19 * 60 });
  assert.equal(agoraNoFuso(new Date("2026-11-06T22:00:00Z"), "America/Cuiaba").minuto, 18 * 60);
});

test("resumo da direção", () => {
  assert.deepEqual(textoResumoDirecao({ entradas: 2, saidas: 1, comAtraso: 5, pendencias: 3, vencidas: 1 }), {
    titulo: "Sua filial na semana",
    corpo: "2 alunos novos e 1 saída na semana. 5 pessoas com contribuição em atraso. 3 pendências da Escolástica (1 vencida).",
  });
  assert.equal(
    textoResumoDirecao({ entradas: 0, saidas: 0, comAtraso: null, pendencias: 0, vencidas: 0 }).corpo,
    "Nenhuma entrada ou saída na semana. Escolástica sem pendências.",
  );
});

test("aluno sumindo: contribuía e está sem recibo há 60 dias; quem entrou agora ou nunca pagou fica de fora", () => {
  const ativos = [
    { matricula: "1", nome: "A", ingresso: "2024-01-10" }, // último recibo em julho: sumindo
    { matricula: "2", nome: "B", ingresso: "2024-01-10" }, // pagou em outubro: em dia
    { matricula: "3", nome: "C", ingresso: "2026-10-01" }, // entrou há pouco
    { matricula: "4", nome: "D", ingresso: "2020-01-01" }, // sem recibo no ano (isento?): fora
  ];
  const recibos = [
    { matricula: "1", data: "2026-05-05" },
    { matricula: "1", data: "2026-07-03" },
    { matricula: "2", data: "2026-10-28" },
    { matricula: "3", data: "2026-10-01" },
  ];
  assert.deepEqual(quemEstaSumindo(ativos, recibos, "2026-11-09"), [{ matricula: "1", nome: "A", ingresso: "2024-01-10", ultimoRecibo: "2026-07-03" }]);
});

test("alerta marcado como corrigido some só até o próximo resumo", () => {
  const chave = chaveDoItem("ativo_sem_turma", { matricula: "123", nome: "X" });
  assert.equal(chave, "ativo_sem_turma:123");
  const marcados = [{ chave, em: "2026-11-06T15:00:00Z" }];
  assert.ok(escondidos(marcados, new Date("2026-11-06T10:00:00Z")).has(chave));
  assert.ok(!escondidos(marcados, new Date("2026-11-07T10:00:00Z")).has(chave));
});

test("contas a pagar: uma conta pelo nome; várias com total", async () => {
  const { textoContasDoDia: bruto } = await import("../src/lib/avisos-contas");
  // O formato de moeda usa espaço não separável entre "R$" e o valor.
  const textoContasDoDia = (...a: Parameters<typeof bruto>) => {
    const t = bruto(...a);
    return { titulo: t.titulo.replace(/ /g, " "), corpo: t.corpo.replace(/ /g, " ") };
  };
  assert.deepEqual(textoContasDoDia([{ vendor: "Aluguel", amount: 2500, predicted: false }], "hoje"), {
    titulo: "Conta vence hoje: Aluguel",
    corpo: "R$ 2.500,00. Depois de pagar, marque como paga na Economia.",
  });
  const v = textoContasDoDia([{ vendor: "Luz", amount: 300, predicted: true }, { vendor: "Água", amount: 100.5, predicted: false }], "amanha");
  assert.equal(v.titulo, "2 contas vencem amanhã · R$ 400,50");
  assert.ok(v.corpo.startsWith("Luz R$ 300,00 (prevista); Água R$ 100,50"));
});

test("resumo da direção inclui sugestões novas; resumo do Portal para a administração nacional", async () => {
  const { textoResumoSugestoesDoPortal } = await import("../src/lib/avisos-direcao");
  assert.equal(
    textoResumoDirecao({ entradas: 0, saidas: 0, comAtraso: null, pendencias: 0, vencidas: 0, sugestoes: 2 }).corpo,
    "Nenhuma entrada ou saída na semana. Escolástica sem pendências. 2 sugestões novas na caixa de sugestões.",
  );
  assert.equal(textoResumoSugestoesDoPortal({ problemas: 1, ideias: 3 }).corpo, "1 problema relatado e 3 ideias aguardando leitura.");
  assert.equal(textoResumoSugestoesDoPortal({ problemas: 0, ideias: 1 }).corpo, "1 ideia aguardando leitura.");
});
