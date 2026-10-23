import assert from "node:assert/strict";
import test from "node:test";
import {
  escolasDoTerritorio,
  podeAcessarSecretaria,
  contextoDaSecretaria,
  escoposDeMandatoPermitidos,
  leituraConfirmadaNaVersao,
  podeAtribuirMandato,
  podeGerirEscalaSecretaria,
  podeGerirMandatoExistente,
  podePublicarNoTerritorio,
  territorioContem,
  validarTerritorio,
  versaoSolicitadaEstaAtual,
  type ContextoSecretaria,
  type EscolaTerritorio,
  type MandatoRede,
} from "../src/lib/secretarias-rede/regras";

const escolas: EscolaTerritorio[] = [
  { id: "escola-a1", name: "Escola A1", city: "Cidade A", uf: "AA" },
  { id: "escola-a2", name: "Escola A2", city: "Cidade B", uf: "AA" },
  { id: "escola-b1", name: "Escola B1", city: "Cidade C", uf: "BB" },
];

function contexto(overrides: Partial<ContextoSecretaria> = {}): ContextoSecretaria {
  return {
    member: { id: "ator", schoolId: "escola-a1", isDiretor: false },
    administradorNacional: false,
    mandatos: [],
    responsabilidades: [],
    escolas,
    escolasChefiadas: [],
    escolasDirecionadas: [],
    ...overrides,
  };
}

function mandato(overrides: Partial<MandatoRede> = {}): MandatoRede {
  return {
    id: "mandato-1",
    memberId: "alvo",
    secretaria: "Secretaria de Saúde",
    escopo: "regional",
    schoolIds: [],
    ufs: ["AA"],
    ativo: true,
    ...overrides,
  };
}

test("território combina escolas e UFs como interseção e UF isolada continua limitada", () => {
  assert.deepEqual(escolasDoTerritorio(escolas, { schoolIds: ["escola-a1"], ufs: ["BB"] }), []);
  assert.deepEqual(escolasDoTerritorio(escolas, { schoolIds: [], ufs: ["aa"] }).map(({ id }) => id), ["escola-a1", "escola-a2"]);
  assert.equal(territorioContem(escolas, { schoolIds: [], ufs: ["AA"] }, { schoolIds: [], ufs: ["BB"] }), false);
  assert.equal(territorioContem(escolas, { schoolIds: [], ufs: ["AA"] }, { schoolIds: ["escola-a1"], ufs: [] }), true);
  assert.throws(() => validarTerritorio(escolas, { schoolIds: ["escola-a1"], ufs: ["BB"] }, "regional"), /não contém escolas/);
  assert.throws(() => validarTerritorio(escolas, { schoolIds: ["fora-da-rede"], ufs: [] }, "local"), /escolas informadas não existe/);
});

test("diretor local atribui somente em escolas chefiadas e não altera mandatos nacional ou regional", () => {
  const ctx = contexto({
    member: { id: "diretor", schoolId: "escola-a1", isDiretor: true },
    escolasChefiadas: ["escola-a1", "escola-a2"],
  });
  assert.deepEqual(escoposDeMandatoPermitidos(ctx), ["local"]);
  assert.equal(podeAtribuirMandato(ctx, "Secretaria de Saúde", "local", { schoolIds: ["escola-a1"], ufs: [] }), true);
  assert.equal(podeAtribuirMandato(ctx, "Secretaria de Saúde", "local", { schoolIds: ["escola-a2"], ufs: [] }), true);
  assert.equal(podeAtribuirMandato(ctx, "Secretaria de Saúde", "local", { schoolIds: ["escola-b1"], ufs: [] }), false);
  assert.equal(podeAtribuirMandato(ctx, "Secretaria de Saúde", "regional", { schoolIds: [], ufs: ["AA"] }), false);
  assert.equal(podeGerirMandatoExistente(ctx, mandato({ escopo: "nacional", schoolIds: [], ufs: [] })), false);
  assert.equal(podeGerirMandatoExistente(ctx, mandato({ schoolIds: ["escola-a2"], ufs: [], escopo: "local" })), true);
  assert.equal(podeGerirMandatoExistente(ctx, mandato({ schoolIds: ["escola-b1"], ufs: [], escopo: "local" })), false);
  assert.equal(podeGerirMandatoExistente(ctx, mandato()), false);
  assert.equal(podeAtribuirMandato(ctx, "Secretaria de Saúde", "regional", { schoolIds: [], ufs: [] }), false);
});

test("publicação nacional exige administrador ou mandato nacional da secretaria", () => {
  const responsabilidade = { secretaria: "Secretaria de Saúde", schoolId: "escola-a1", uf: "AA", papel: "responsavel" as const };
  const local = contexto({ responsabilidades: [responsabilidade] });
  assert.equal(podePublicarNoTerritorio(local, "Secretaria de Saúde", { schoolIds: ["escola-a1"], ufs: [] }), true);
  assert.equal(podePublicarNoTerritorio(local, "Secretaria de Saúde", { schoolIds: [], ufs: [] }), false);
  const nacional = mandato({ memberId: "ator", escopo: "nacional", schoolIds: [], ufs: [] });
  assert.equal(podePublicarNoTerritorio(contexto({ mandatos: [nacional] }), "Secretaria de Saúde", { schoolIds: [], ufs: [] }), true);
});

test("titular nacional só administra regionais da própria secretaria", () => {
  const nacional = mandato({ id: "meu-nacional", memberId: "ator", escopo: "nacional", schoolIds: [], ufs: [] });
  const ctx = contexto({ mandatos: [nacional] });
  assert.deepEqual(escoposDeMandatoPermitidos(ctx), ["regional"]);
  assert.equal(podeAtribuirMandato(ctx, "Secretaria de Saúde", "regional", { schoolIds: [], ufs: ["AA"] }), true);
  assert.equal(podeAtribuirMandato(ctx, "Secretaria de Saúde", "local", { schoolIds: ["escola-a1"], ufs: [] }), false);
  assert.equal(podeAtribuirMandato(ctx, "Secretaria de Saúde", "nacional", { schoolIds: [], ufs: [] }), false);
  assert.equal(podeAtribuirMandato(ctx, "Secretaria de Educação", "regional", { schoolIds: [], ufs: ["AA"] }), false);
  assert.equal(podeGerirMandatoExistente(ctx, mandato({ id: "regional-a", ufs: ["AA"] })), true);
  assert.equal(podeGerirMandatoExistente(ctx, mandato({ id: "regional-outra-secretaria", secretaria: "Secretaria de Educação", ufs: ["AA"] })), false);
  assert.equal(podeGerirMandatoExistente(ctx, mandato({ id: "outro-nacional", escopo: "nacional", schoolIds: [], ufs: [] })), false);
});

test("titular regional não gerencia escala fora das UFs do mandato", () => {
  const ctx = contexto({ mandatos: [mandato({ memberId: "ator", ufs: ["AA"] })] });
  assert.equal(podeGerirEscalaSecretaria(ctx, "Secretaria de Saúde", "escola-a2"), true);
  assert.equal(podeGerirEscalaSecretaria(ctx, "Secretaria de Saúde", "escola-b1"), false);
  assert.equal(podeGerirEscalaSecretaria(ctx, "Secretaria de Educação", "escola-a1"), false);
});

test("leitura antiga não confirma nova versão da publicação", () => {
  const leituras = [{ publicacaoId: "pub-1", versao: 1 }];
  assert.equal(leituraConfirmadaNaVersao(leituras, "pub-1", 1), true);
  assert.equal(leituraConfirmadaNaVersao(leituras, "pub-1", 2), false);
  assert.equal(versaoSolicitadaEstaAtual(2, 1), false);
  assert.equal(versaoSolicitadaEstaAtual(2, 2), true);
});


test('administração nacional de Economia não autoriza outra secretaria',()=>{
 const ctx=contexto({mandatos:[mandato({secretaria:'Economia',escopo:'nacional',ufs:[],schoolIds:[]})]});
 assert.equal(podeAcessarSecretaria(ctx,'Economia'),true);
 assert.equal(podeAcessarSecretaria(ctx,'Abertura de Turma'),false);
 assert.equal(podePublicarNoTerritorio(ctx,'Abertura de Turma',{schoolIds:[],ufs:[]}),false);
 assert.equal(podeAtribuirMandato(ctx,'Abertura de Turma','regional',{schoolIds:[],ufs:['AA']}),false);
});
test('contexto de uma secretaria não carrega mandatos nem responsabilidades das demais',()=>{
 const ctx=contexto({mandatos:[mandato({secretaria:'Economia'}),mandato({secretaria:'Abertura de Turma'})],responsabilidades:[{secretaria:'Escolástica',schoolId:'escola-a1',uf:'AA',papel:'responsavel'}]});
 const limitado=contextoDaSecretaria(ctx,'Secretaria de Economia');
 assert.equal(limitado.mandatos.length,1);assert.equal(limitado.mandatos[0].secretaria,'Economia');assert.equal(limitado.responsabilidades.length,0);
});
