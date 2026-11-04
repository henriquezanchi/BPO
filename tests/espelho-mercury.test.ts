import assert from "node:assert/strict";
import test from "node:test";
import { codigoEscolaridade, codigoEstadoCivil, compararEspelho, fone } from "../src/lib/espelho-mercury/comparar";
import { PROCEDIMENTOS } from "../src/lib/espelho-mercury/manual";
import type { LadoAntigo, LadoNovo, PessoaAntigo, PessoaNovo, TipoAcao } from "../src/lib/espelho-mercury/tipos";

const OPC = { desde: "2026-11-06", filial: "BARRA DO GARÇAS" };

function novo(p: Partial<PessoaNovo> = {}): PessoaNovo {
  return {
    matricula: "50001",
    nome: "MARIA DE TESTE",
    ativo: true,
    ingresso: "2025-03-10",
    nivel: "N2",
    turma: "HILARION",
    inativacao: null,
    contato: { whatsapp: "+55 (66) 99999-0000", whatsappAlt: null, email: "maria@teste.com", cidade: "Barra do Garças", uf: "MT" },
    pessoais: { nascimento: "1990-01-02", naturalidade: "Cuiabá", profissao: "Professora", estadoCivil: "Casada", escolaridade: "Superior", rg: "123", cpf: null },
    composicao: [{ rotulo: "CONTRIBUIÇÃO MENSAL", valor: 150 }],
    recibos: [],
    mesesPagos: [],
    ...p,
  };
}

function antigo(p: Partial<PessoaAntigo> = {}): PessoaAntigo {
  return {
    matricula: "50001",
    nome: "MARIA DE TESTE",
    unidade: "BGA",
    situacao: "ATI",
    ingresso: "2025-03-10",
    nivel: "N2",
    turma: "HILARION",
    contato: { whatsapp: "66999990000", whatsappAlt: "", email: "MARIA@teste.com", cidade: "BARRA DO GARCAS", uf: "MT" },
    pessoais: { nascimento: "1990-01-02", naturalidade: "CUIABA", profissao: "PROFESSORA", estadoCivil: "CAS", escolaridade: "GR3", rg: "123", cpf: "" },
    composicao: [{ grupo: "101", rotulo: "CONTRIBUIÇÃO MENSAL", valor: 150 }],
    ...p,
  };
}

const ladoNovo = (pessoas: PessoaNovo[], extra: Partial<LadoNovo> = {}): LadoNovo => ({ pessoas, turmas: [], movimentos: [], cargos: [], ...extra });
const ladoAntigo = (pessoas: PessoaAntigo[], extra: Partial<LadoAntigo> = {}): LadoAntigo => ({
  unidade: "BGA",
  pessoas,
  outrasUnidades: [],
  recibos: [],
  turmas: [{ nome: "HILARION", nivel: "N2" }],
  comFuncao: new Set(),
  produtos: [
    { cod: "101", descricao: "CONTRIBUIÇÃO MENSAL" },
    { cod: "205", descricao: "BIBLIOTECA" },
  ],
  ...extra,
});
const tipos = (a: { tipo: TipoAcao }[]) => a.map((x) => x.tipo).sort();

test("cadastros iguais (com diferenças só de formato) não geram nada", () => {
  assert.deepEqual(compararEspelho(ladoNovo([novo()]), ladoAntigo([antigo()]), OPC), []);
});

test("aluno novo vira cadastro manual; inativo novo sem cadastro antigo não gera nada", () => {
  const a = compararEspelho(ladoNovo([novo(), novo({ matricula: "50002", ativo: false })]), ladoAntigo([]), OPC);
  assert.deepEqual(tipos(a), ["incluir_aluno"]);
  assert.equal(a[0].robo, null);
  assert.equal(a[0].dados["Composição: CONTRIBUIÇÃO MENSAL"], "R$ 150,00");
});

test("matrícula usada no antigo por outra pessoa é conflito para revisão", () => {
  const a = compararEspelho(ladoNovo([novo()]), ladoAntigo([], { outrasUnidades: [{ matricula: "50001", nome: "JOÃO OUTRO", unidade: "GYN", situacao: "ATI" }] }), OPC);
  assert.deepEqual(tipos(a), ["conflito_matricula"]);
  assert.equal(a[0].revisao, true);
});

test("inativado no novo pede inativação e ignora o resto do cadastro", () => {
  const a = compararEspelho(ladoNovo([novo({ ativo: false, nivel: "N3", inativacao: { em: "2026-11-10", motivo: "Mudou de cidade" } })]), ladoAntigo([antigo()]), OPC);
  assert.deepEqual(tipos(a), ["inativar"]);
  assert.equal(a[0].dados["Data da inativação"], "10/11/2026");
});

test("ativo no antigo e fora do novo é revisão", () => {
  const a = compararEspelho(ladoNovo([]), ladoAntigo([antigo()]), OPC);
  assert.deepEqual(tipos(a), ["ausente_no_novo"]);
});

test("contato e dados pessoais diferentes vão para o robô; campo vazio no novo não apaga o antigo", () => {
  const a = compararEspelho(
    ladoNovo([novo({ contato: { whatsapp: "66988887777", whatsappAlt: null, email: null, cidade: null, uf: null }, pessoais: { nascimento: null, naturalidade: null, profissao: "Médica", estadoCivil: "Divorciada", escolaridade: null, rg: null, cpf: null } })]),
    ladoAntigo([antigo()]),
    OPC,
  );
  assert.deepEqual(tipos(a), ["atualizar_contato", "atualizar_dados_pessoais"]);
  const contato = a.find((x) => x.tipo === "atualizar_contato")!;
  assert.deepEqual(contato.robo, { tipo: "contato", payload: { whatsapp: "66988887777" } });
  const pessoais = a.find((x) => x.tipo === "atualizar_dados_pessoais")!;
  assert.deepEqual(pessoais.robo?.payload, { profession: "MÉDICA", estadoCivil: "DIV" });
});

test("telefone que já está como residencial no antigo não gera atualização", () => {
  const a = compararEspelho(ladoNovo([novo({ contato: { whatsapp: "6634010000", whatsappAlt: null, email: null, cidade: null, uf: null } })]), ladoAntigo([antigo({ contato: { ...antigo().contato, whatsappAlt: "6634010000" } })]), OPC);
  assert.deepEqual(a, []);
});

test("nível, turma e ingresso diferentes viram tarefas manuais", () => {
  const a = compararEspelho(ladoNovo([novo({ nivel: "N3", turma: "Sócrates", ingresso: "2025-03-11" })]), ladoAntigo([antigo()]), OPC);
  assert.deepEqual(tipos(a), ["alterar_ingresso", "alterar_nivel", "alterar_turma"]);
  assert.ok(a.every((x) => x.robo === null));
});

test("composição: altera valor, inclui do catálogo, exclui o que saiu e separa o que não existe no antigo", () => {
  const a = compararEspelho(
    ladoNovo([novo({ composicao: [{ rotulo: "Contribuição Mensal", valor: 180 }, { rotulo: "Biblioteca", valor: 10 }, { rotulo: "Taxa Nova", valor: 5 }] })]),
    ladoAntigo([antigo({ composicao: [{ grupo: "101", rotulo: "CONTRIBUIÇÃO MENSAL", valor: 150 }, { grupo: "300", rotulo: "CAFÉ", valor: 20 }] })]),
    OPC,
  );
  assert.deepEqual(tipos(a), ["composicao_sem_correspondencia", "editar_valor_composicao", "excluir_item_composicao", "incluir_item_composicao"]);
  assert.deepEqual(a.find((x) => x.tipo === "editar_valor_composicao")!.robo, { tipo: "editar_composicao", payload: { grupo: "101", valor: "180,00" } });
  assert.deepEqual(a.find((x) => x.tipo === "incluir_item_composicao")!.robo, { tipo: "incluir_composicao", payload: { grupo: "205", valor: "10,00" } });
});

test("composição sem nenhum nome em comum não sai excluindo tudo: vira uma revisão só", () => {
  const a = compararEspelho(ladoNovo([novo({ composicao: [{ rotulo: "Plano Básico", valor: 150 }] })]), ladoAntigo([antigo()]), OPC);
  assert.deepEqual(tipos(a), ["composicao_sem_correspondencia"]);
  assert.equal(a[0].revisao, true);
});

test("recibos: só a partir do desde; casados não geram nada; contribuição de um mês vai para o robô", () => {
  const recibos = [
    { id: "r0", numero: "900", data: "2026-11-01", valor: 150, descricao: null, ativo: true }, // antes do desde
    { id: "r1", numero: "901", data: "2026-11-07", valor: 150, descricao: null, ativo: true }, // já no antigo
    { id: "r2", numero: "902", data: "2026-11-10", valor: 150, descricao: null, ativo: true }, // contribuição de 1 mês
    { id: "r3", numero: "903", data: "2026-11-12", valor: 300, descricao: null, ativo: true }, // 2 meses: manual
    { id: "r4", numero: "904", data: "2026-11-12", valor: 45, descricao: "Livro", ativo: true }, // avulso
  ];
  const mesesPagos = [
    { ano: 2026, mes: 11, valor: 150, pagoEm: "2026-11-10" },
    { ano: 2026, mes: 12, valor: 150, pagoEm: "2026-11-12" },
    { ano: 2027, mes: 1, valor: 150, pagoEm: "2026-11-12" },
  ];
  const a = compararEspelho(ladoNovo([novo({ recibos, mesesPagos })]), ladoAntigo([antigo()], { recibos: [{ id: "77", matricula: "50001", data: "2026-11-07", valor: 150, cancelado: false }] }), OPC);
  assert.deepEqual(a.map((x) => x.chave).sort(), ["recibo:r2", "recibo:r3", "recibo:r4"]);
  assert.deepEqual(a.find((x) => x.chave === "recibo:r2")!.robo, { tipo: "contribuicao", payload: { ano: 2026, mes: 11, valor: 150, pagoEm: "2026-11-10" } });
  assert.equal(a.find((x) => x.chave === "recibo:r3")!.tipo, "lancar_contribuicao");
  assert.equal(a.find((x) => x.chave === "recibo:r3")!.robo, null);
  assert.equal(a.find((x) => x.chave === "recibo:r4")!.tipo, "lancar_recibo_avulso");
});

test("dois pagamentos iguais no mesmo dia: um recibo do antigo só casa com um do novo", () => {
  const r = { data: "2026-11-10", valor: 150, descricao: null, ativo: true };
  const a = compararEspelho(
    ladoNovo([novo({ recibos: [{ ...r, id: "a", numero: "1" }, { ...r, id: "b", numero: "2" }] })]),
    ladoAntigo([antigo()], { recibos: [{ id: "77", matricula: "50001", data: "2026-11-10", valor: 150, cancelado: false }] }),
    OPC,
  );
  assert.equal(a.length, 1);
});

test("recibo cancelado no novo e válido no antigo é revisão de cancelamento", () => {
  const a = compararEspelho(
    ladoNovo([novo({ recibos: [{ id: "c", numero: "905", data: "2026-11-10", valor: 150, descricao: null, ativo: false }] })]),
    ladoAntigo([antigo()], { recibos: [{ id: "88", matricula: "50001", data: "2026-11-10", valor: 150, cancelado: false }] }),
    OPC,
  );
  assert.deepEqual(tipos(a), ["cancelar_recibo"]);
  assert.equal(a[0].revisao, true);
});

test("turma nova, movimento do mês e cargo sem função viram tarefas manuais", () => {
  const a = compararEspelho(
    ladoNovo([novo()], {
      turmas: [{ nome: "HILARION", nivel: "N2", diaSemana: 3, hora: "20:00", ativa: true }, { nome: "Platão", nivel: "N1", diaSemana: 2, hora: "19:30", ativa: true }],
      movimentos: [
        { ano: 2026, mes: 10, linhas: [{ rubrica: "LUZ", tipo: "EXPENSE", entradas: 0, saidas: 90 }] }, // antes do desde
        { ano: 2026, mes: 11, linhas: [{ rubrica: "LUZ", tipo: "EXPENSE", entradas: 0, saidas: 120 }] },
      ],
      cargos: [{ matricula: "50001", nome: "MARIA DE TESTE", cargo: "TESOUREIRA" }, { matricula: "50009", nome: "X", cargo: "Não informado" }],
    }),
    ladoAntigo([antigo()]),
    OPC,
  );
  assert.deepEqual(tipos(a), ["conferir_funcoes", "criar_turma", "lancar_movimento_mes"]);
  assert.equal(a.find((x) => x.tipo === "criar_turma")!.dados["Dia"], "TERÇA");
  assert.equal(a.find((x) => x.tipo === "lancar_movimento_mes")!.dados["Saída: LUZ"], "R$ 120,00");
});

test("a chave muda quando o valor de destino muda", () => {
  const a1 = compararEspelho(ladoNovo([novo({ nivel: "N3" })]), ladoAntigo([antigo()]), OPC);
  const a2 = compararEspelho(ladoNovo([novo({ nivel: "N4" })]), ladoAntigo([antigo()]), OPC);
  assert.notEqual(a1[0].chave, a2[0].chave);
  assert.equal(compararEspelho(ladoNovo([novo({ nivel: "N3" })]), ladoAntigo([antigo()]), OPC)[0].chave, a1[0].chave);
});

test("normalizações", () => {
  assert.equal(fone("+55 (66) 99999-0000"), "66999990000");
  assert.equal(fone("066 3401-0000"), "6634010000");
  assert.equal(codigoEstadoCivil("União estável"), "UNE");
  assert.equal(codigoEstadoCivil("outro"), null);
  assert.equal(codigoEscolaridade("Pós-graduação"), "GRP");
  assert.equal(codigoEscolaridade("Ensino Superior Incompleto"), "GR4");
  assert.equal(codigoEscolaridade("Ensino médio"), "GR2");
});

test("todo tipo de ação tem passo a passo manual", () => {
  const todos: TipoAcao[] = ["incluir_aluno", "conflito_matricula", "ausente_no_novo", "inativar", "reativar", "alterar_nivel", "alterar_turma", "alterar_ingresso", "atualizar_contato", "atualizar_dados_pessoais", "incluir_item_composicao", "excluir_item_composicao", "editar_valor_composicao", "composicao_sem_correspondencia", "lancar_contribuicao", "lancar_recibo_avulso", "cancelar_recibo", "criar_turma", "lancar_movimento_mes", "conferir_funcoes"];
  for (const t of todos) assert.ok(PROCEDIMENTOS[t].passos.length > 0, t);
});
