import type { Acao, LadoAntigo, LadoNovo, PessoaAntigo, PessoaNovo, ReciboAntigo } from "./tipos";

/**
 * Compara o Mercúrio novo (fonte da verdade) com o antigo e devolve o que precisa ser feito no antigo. Função pura:
 * não lê nem grava nada (tests/espelho-mercury.test.ts). Regras (docs/PLANO-ESPELHO-MERCURY-MERCURIO.md):
 *  - o novo vence, mas campo vazio no novo não apaga o antigo (pode ser só "não informado" lá);
 *  - dinheiro só é lançado do `desde` em diante (antes disso o antigo era a fonte) e nunca é corrigido sozinho:
 *    divergência vira revisão;
 *  - a chave de cada ação muda quando o valor de destino muda, para uma correção nova não se confundir com a antiga.
 */
export function compararEspelho(novo: LadoNovo, antigo: LadoAntigo, opcoes: { desde: string; filial: string }): Acao[] {
  const acoes: Acao[] = [];
  const antigos = new Map(antigo.pessoas.map((p) => [p.matricula, p]));
  const doNovo = new Set(novo.pessoas.map((p) => p.matricula));

  for (const p of novo.pessoas) {
    const a = antigos.get(p.matricula);
    if (!a) acoes.push(...pessoaSoNoNovo(p, antigo));
    else acoes.push(...diferencasDaPessoa(p, a, antigo));
  }

  for (const a of antigo.pessoas) {
    if (a.situacao !== "ATI" || doNovo.has(a.matricula)) continue;
    acoes.push({
      tipo: "ausente_no_novo",
      chave: `ausente:${a.matricula}`,
      matricula: a.matricula,
      nome: a.nome,
      area: "escolastica",
      resumo: `Ativo no Mercúrio antigo, mas não aparece na filial no Mercúrio novo`,
      dados: { Matrícula: a.matricula, Nome: a.nome },
      robo: null,
      revisao: true,
    });
  }

  acoes.push(...recibos(novo, antigo, opcoes.desde));
  acoes.push(...turmas(novo, antigo));
  acoes.push(...movimentos(novo, opcoes.desde, opcoes.filial));
  acoes.push(...cargos(novo, antigo));
  return acoes;
}

// ---------------------------------------------------------------- pessoas

function pessoaSoNoNovo(p: PessoaNovo, antigo: LadoAntigo): Acao[] {
  const outra = antigo.outrasUnidades.find((o) => o.matricula === p.matricula);
  if (outra) {
    const mesmaPessoa = norm(outra.nome) === norm(p.nome);
    return [
      {
        tipo: "conflito_matricula",
        chave: `conflito:${p.matricula}:${outra.unidade}`,
        matricula: p.matricula,
        nome: p.nome,
        area: "escolastica",
        resumo: mesmaPessoa
          ? `No antigo, esta matrícula está na unidade ${outra.unidade} (transferência ainda não feita no antigo?)`
          : `Matrícula já usada no antigo por outra pessoa: ${outra.nome} (${outra.unidade})`,
        dados: { Matrícula: p.matricula, "Nome no novo": p.nome, "Nome no antigo": outra.nome, "Unidade no antigo": outra.unidade, "Situação no antigo": outra.situacao },
        robo: null,
        revisao: true,
      },
    ];
  }
  if (!p.ativo) return [];
  const dados: Record<string, string> = { Matrícula: p.matricula, Nome: p.nome };
  if (p.ingresso) dados["Data de ingresso"] = br(p.ingresso);
  if (p.nivel) dados["Nível"] = p.nivel;
  if (p.turma) dados["Turma"] = p.turma;
  if (p.contato?.whatsapp) dados["Celular/WhatsApp"] = p.contato.whatsapp;
  if (p.contato?.email) dados["E-mail"] = p.contato.email;
  if (p.contato?.cidade) dados["Cidade/UF"] = `${p.contato.cidade}${p.contato.uf ? `/${p.contato.uf}` : ""}`;
  if (p.pessoais?.nascimento) dados["Nascimento"] = br(p.pessoais.nascimento);
  if (p.pessoais?.cpf) dados["CPF"] = p.pessoais.cpf;
  if (p.pessoais?.rg) dados["RG"] = p.pessoais.rg;
  if (p.pessoais?.profissao) dados["Profissão"] = p.pessoais.profissao;
  for (const c of p.composicao ?? []) dados[`Composição: ${c.rotulo}`] = moeda(c.valor);
  return [
    {
      tipo: "incluir_aluno",
      chave: `incluir:${p.matricula}`,
      matricula: p.matricula,
      nome: p.nome,
      area: "escolastica",
      // O banco de consulta do antigo só tem ativos: pode ser aluno novo ou alguém inativo lá (aí é reingresso).
      resumo: `Ativo no novo e fora dos ativos do antigo: cadastrar com a mesma matrícula (ou reativar, se ela já existir inativa)`,
      dados,
      robo: null,
      revisao: false,
    },
  ];
}

function diferencasDaPessoa(p: PessoaNovo, a: PessoaAntigo, antigo: LadoAntigo): Acao[] {
  const acoes: Acao[] = [];
  const base = { matricula: p.matricula, nome: p.nome };
  const ativoNoAntigo = a.situacao === "ATI";

  if (!p.ativo && ativoNoAntigo) {
    acoes.push({
      ...base,
      tipo: "inativar",
      chave: `inativar:${p.matricula}`,
      area: "escolastica",
      resumo: `Inativado no novo${p.inativacao?.em ? ` em ${br(p.inativacao.em)}` : ""}: inativar no antigo`,
      dados: { "Data da inativação": p.inativacao?.em ? br(p.inativacao.em) : "(não informada no novo)", Motivo: p.inativacao?.motivo ?? "(não informado no novo)" },
      robo: null,
      revisao: false,
    });
    return acoes; // inativo no novo: o resto do cadastro não precisa acompanhar
  }
  if (!p.ativo) return acoes;
  if (!ativoNoAntigo) {
    acoes.push({
      ...base,
      tipo: "reativar",
      chave: `reativar:${p.matricula}`,
      area: "escolastica",
      resumo: `Ativo no novo, mas "${a.situacao}" no antigo: reativar (reingresso)`,
      dados: { "Situação no antigo": a.situacao, "Data de ingresso no novo": p.ingresso ? br(p.ingresso) : "(não informada)" },
      robo: null,
      revisao: false,
    });
  }

  if (p.nivel && p.nivel !== (a.nivel ?? "")) {
    acoes.push({ ...base, tipo: "alterar_nivel", chave: `nivel:${p.matricula}:${p.nivel}`, area: "escolastica", resumo: `Nível: ${a.nivel || "(vazio)"} → ${p.nivel}`, dados: { "Nível no antigo": a.nivel || "(vazio)", "Nível correto": p.nivel }, robo: null, revisao: false });
  }
  if (p.turma && norm(p.turma) !== norm(a.turma ?? "")) {
    acoes.push({ ...base, tipo: "alterar_turma", chave: `turma:${p.matricula}:${norm(p.turma)}`, area: "escolastica", resumo: `Turma: ${a.turma || "(nenhuma)"} → ${p.turma}`, dados: { "Turma no antigo": a.turma || "(nenhuma)", "Turma correta": p.turma }, robo: null, revisao: false });
  }
  if (p.ingresso && p.ingresso !== a.ingresso) {
    acoes.push({ ...base, tipo: "alterar_ingresso", chave: `ingresso:${p.matricula}:${p.ingresso}`, area: "escolastica", resumo: `Data de ingresso: ${a.ingresso ? br(a.ingresso) : "(vazia)"} → ${br(p.ingresso)}`, dados: { "No antigo": a.ingresso ? br(a.ingresso) : "(vazia)", Correta: br(p.ingresso) }, robo: null, revisao: false });
  }

  if (p.contato) {
    const mudou: Record<string, string> = {};
    const payload: Record<string, string> = {};
    const c = p.contato;
    // O antigo tem dois telefones (celular e residencial) sem dizer qual é o WhatsApp: basta o número estar em um deles.
    const tels = new Set([fone(a.contato.whatsapp), fone(a.contato.whatsappAlt)].filter(Boolean));
    if (c.whatsapp && !tels.has(fone(c.whatsapp))) { mudou["Celular/WhatsApp"] = fone(c.whatsapp); payload.whatsapp = fone(c.whatsapp); }
    if (c.whatsappAlt && !tels.has(fone(c.whatsappAlt))) { mudou["Telefone alternativo"] = fone(c.whatsappAlt); payload.whatsappAlt = fone(c.whatsappAlt); }
    if (c.email && c.email.trim().toLowerCase() !== a.contato.email.trim().toLowerCase()) { mudou["E-mail"] = c.email.trim(); payload.email = c.email.trim(); }
    if (c.cidade && norm(c.cidade) !== norm(a.contato.cidade)) { mudou["Cidade"] = c.cidade.toUpperCase(); payload.addressCity = c.cidade.toUpperCase(); }
    if (c.uf && norm(c.uf) !== norm(a.contato.uf)) { mudou["UF"] = c.uf.toUpperCase(); payload.addressState = c.uf.toUpperCase(); }
    if (Object.keys(payload).length) {
      acoes.push({ ...base, tipo: "atualizar_contato", chave: `contato:${p.matricula}:${hash(payload)}`, area: "escolastica", resumo: `Contato: ${Object.keys(mudou).join(", ")}`, dados: mudou, robo: { tipo: "contato", payload }, revisao: false });
    }
  }

  if (p.pessoais) {
    const s = p.pessoais;
    const mudou: Record<string, string> = {};
    const payload: Record<string, string> = {};
    if (s.nascimento && s.nascimento !== a.pessoais.nascimento) { mudou["Nascimento"] = br(s.nascimento); payload.birthDate = s.nascimento; }
    if (s.naturalidade && norm(s.naturalidade) !== norm(a.pessoais.naturalidade)) { mudou["Naturalidade"] = s.naturalidade.toUpperCase(); payload.naturalidade = s.naturalidade.toUpperCase(); }
    if (s.profissao && norm(s.profissao) !== norm(a.pessoais.profissao)) { mudou["Profissão"] = s.profissao.toUpperCase(); payload.profession = s.profissao.toUpperCase(); }
    const civil = codigoEstadoCivil(s.estadoCivil);
    if (civil && civil !== a.pessoais.estadoCivil) { mudou["Estado civil"] = s.estadoCivil!; payload.estadoCivil = civil; }
    const esco = codigoEscolaridade(s.escolaridade);
    if (esco && esco !== a.pessoais.escolaridade) { mudou["Escolaridade"] = s.escolaridade!; payload.escolaridade = esco; }
    if (s.rg && digitos(s.rg) !== digitos(a.pessoais.rg)) { mudou["RG"] = s.rg; payload.rgNumero = s.rg; }
    if (Object.keys(payload).length) {
      acoes.push({ ...base, tipo: "atualizar_dados_pessoais", chave: `pessoais:${p.matricula}:${hash(payload)}`, area: "escolastica", resumo: `Dados pessoais: ${Object.keys(mudou).join(", ")}`, dados: mudou, robo: { tipo: "pessoais", payload }, revisao: false });
    }
  }

  if (p.composicao) acoes.push(...composicao(p, a, antigo));
  return acoes;
}

function composicao(p: PessoaNovo, a: PessoaAntigo, antigo: LadoAntigo): Acao[] {
  const acoes: Acao[] = [];
  const base = { matricula: p.matricula, nome: p.nome, area: "economia" as const };
  const novos = p.composicao!.map((c) => ({ ...c, chave: norm(c.rotulo) }));
  const doAntigo = new Map(a.composicao.map((c) => [norm(c.rotulo), c]));
  const casados = novos.filter((n) => doAntigo.has(n.chave)).length;

  // Nomes que não batem em nada (catálogos diferentes nos dois sistemas): não sai excluindo tudo do antigo.
  if (a.composicao.length && novos.length && casados === 0) {
    return [
      {
        ...base,
        tipo: "composicao_sem_correspondencia",
        chave: `comp-revisar:${p.matricula}:${hash(novos.map((n) => [n.chave, n.valor]))}`,
        resumo: `Composição do novo não tem nenhum item com o mesmo nome do antigo: conferir à mão`,
        dados: Object.fromEntries([...novos.map((n) => [`Novo: ${n.rotulo}`, moeda(n.valor)]), ...a.composicao.map((c) => [`Antigo: ${c.rotulo}`, moeda(c.valor)])]),
        robo: null,
        revisao: true,
      },
    ];
  }

  for (const n of novos) {
    const atual = doAntigo.get(n.chave);
    if (atual) {
      if (centavos(atual.valor) !== centavos(n.valor)) {
        acoes.push({ ...base, tipo: "editar_valor_composicao", chave: `comp-valor:${p.matricula}:${atual.grupo}:${centavos(n.valor)}`, resumo: `Composição: ${n.rotulo} ${moeda(atual.valor)} → ${moeda(n.valor)}`, dados: { Item: n.rotulo, "Valor no antigo": moeda(atual.valor), "Valor correto": moeda(n.valor) }, robo: { tipo: "editar_composicao", payload: { grupo: atual.grupo, valor: virgula(n.valor) } }, revisao: false });
      }
      continue;
    }
    const produto = antigo.produtos.find((pr) => norm(pr.descricao) === n.chave);
    if (produto) {
      acoes.push({ ...base, tipo: "incluir_item_composicao", chave: `comp-incluir:${p.matricula}:${produto.cod}:${centavos(n.valor)}`, resumo: `Composição: incluir ${n.rotulo} (${moeda(n.valor)})`, dados: { Item: n.rotulo, Valor: moeda(n.valor) }, robo: { tipo: "incluir_composicao", payload: { grupo: produto.cod, valor: virgula(n.valor) } }, revisao: false });
    } else {
      acoes.push({ ...base, tipo: "composicao_sem_correspondencia", chave: `comp-sem:${p.matricula}:${n.chave}:${centavos(n.valor)}`, resumo: `Composição: "${n.rotulo}" não existe no catálogo do antigo`, dados: { Item: n.rotulo, Valor: moeda(n.valor) }, robo: null, revisao: true });
    }
  }
  const nomesNovos = new Set(novos.map((n) => n.chave));
  for (const c of a.composicao) {
    if (nomesNovos.has(norm(c.rotulo))) continue;
    acoes.push({ ...base, tipo: "excluir_item_composicao", chave: `comp-excluir:${p.matricula}:${c.grupo}`, resumo: `Composição: excluir ${c.rotulo} (${moeda(c.valor)}), que não está no novo`, dados: { Item: c.rotulo, Valor: moeda(c.valor) }, robo: { tipo: "excluir_composicao", payload: { grupo: c.grupo } }, revisao: false });
  }
  return acoes;
}

// ---------------------------------------------------------------- dinheiro

function recibos(novo: LadoNovo, antigo: LadoAntigo, desde: string): Acao[] {
  const acoes: Acao[] = [];
  // Recibo do antigo já "usado" por um do novo não casa com outro (dois pagamentos iguais no mesmo dia).
  const livres = new Map<string, ReciboAntigo[]>();
  for (const r of antigo.recibos) {
    if (r.cancelado) continue;
    const k = chaveRecibo(r.matricula, r.data, r.valor);
    livres.set(k, [...(livres.get(k) ?? []), r]);
  }

  for (const p of novo.pessoas) {
    for (const r of p.recibos.filter((x) => x.data >= desde).sort((x, y) => x.data.localeCompare(y.data))) {
      const k = chaveRecibo(p.matricula, r.data, r.valor);
      const par = livres.get(k)?.shift();
      const base = { matricula: p.matricula, nome: p.nome, area: "economia" as const };
      if (!r.ativo) {
        if (par)
          acoes.push({ ...base, tipo: "cancelar_recibo", chave: `cancelar:${r.id}`, resumo: `Recibo ${r.numero} cancelado no novo: cancelar o recibo ${par.id} no antigo`, dados: { "Recibo no novo": r.numero, "Recibo no antigo": par.id, Data: br(r.data), Valor: moeda(r.valor) }, robo: null, revisao: true });
        continue;
      }
      if (par) continue;

      const meses = p.mesesPagos.filter((m) => m.pagoEm === r.data);
      const somaMeses = meses.reduce((s, m) => s + m.valor, 0);
      const dados: Record<string, string> = { "Recibo no novo": r.numero, "Data do pagamento": br(r.data), Valor: moeda(r.valor) };
      if (r.descricao) dados["Descrição no novo"] = r.descricao;
      if (meses.length && centavos(somaMeses) === centavos(r.valor)) {
        dados["Meses de contribuição"] = meses.map((m) => `${String(m.mes).padStart(2, "0")}/${m.ano}`).join(", ");
        const umMes = meses.length === 1 ? meses[0] : null;
        acoes.push({
          ...base,
          tipo: "lancar_contribuicao",
          chave: `recibo:${r.id}`,
          resumo: `Contribuição de ${dados["Meses de contribuição"]} paga em ${br(r.data)} (${moeda(r.valor)})`,
          dados,
          // O robô lança um mês por recibo; vários meses num recibo só ficam para a secretaria.
          robo: umMes ? { tipo: "contribuicao", payload: { ano: umMes.ano, mes: umMes.mes, valor: r.valor, pagoEm: r.data } } : null,
          revisao: false,
        });
      } else {
        acoes.push({ ...base, tipo: "lancar_recibo_avulso", chave: `recibo:${r.id}`, resumo: `Recibo ${r.numero} de ${br(r.data)} (${moeda(r.valor)}) não está no antigo`, dados, robo: null, revisao: false });
      }
    }
  }
  return acoes;
}

function movimentos(novo: LadoNovo, desde: string, filial: string): Acao[] {
  const [anoD, mesD] = desde.split("-").map(Number);
  return novo.movimentos
    .filter((m) => m.ano > anoD || (m.ano === anoD && m.mes >= mesD))
    .filter((m) => m.linhas.length)
    .map((m) => {
      const ref = `${String(m.mes).padStart(2, "0")}/${m.ano}`;
      const dados: Record<string, string> = {};
      for (const l of m.linhas) dados[`${l.tipo === "EXPENSE" ? "Saída" : "Entrada"}: ${l.rubrica}`] = moeda(l.tipo === "EXPENSE" ? l.saidas : l.entradas);
      return {
        tipo: "lancar_movimento_mes" as const,
        chave: `movimento:${m.ano}-${m.mes}:${hash(m.linhas)}`,
        matricula: null,
        nome: null,
        area: "economia" as const,
        resumo: `Movimento do caixa de ${ref} (${filial}): conferir no antigo despesas e receitas que não são recibo de aluno`,
        dados,
        robo: null,
        revisao: false,
      };
    });
}

function turmas(novo: LadoNovo, antigo: LadoAntigo): Acao[] {
  const existentes = new Set(antigo.turmas.map((t) => norm(t.nome)));
  const DIAS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
  return novo.turmas
    .filter((t) => t.ativa && !existentes.has(norm(t.nome)))
    .map((t) => ({
      tipo: "criar_turma" as const,
      chave: `turma-nova:${norm(t.nome)}`,
      matricula: null,
      nome: null,
      area: "escolastica" as const,
      resumo: `Turma "${t.nome}" existe no novo e não no antigo`,
      dados: { Turma: t.nome, Nível: t.nivel ?? "(não informado)", Dia: DIAS[t.diaSemana] ?? String(t.diaSemana), Horário: t.hora },
      robo: null,
      revisao: false,
    }));
}

function cargos(novo: LadoNovo, antigo: LadoAntigo): Acao[] {
  return novo.cargos
    .filter((c) => c.matricula && !antigo.comFuncao.has(c.matricula) && !/n[aã]o informado/i.test(c.cargo))
    .map((c) => ({
      tipo: "conferir_funcoes" as const,
      chave: `funcao:${c.matricula}:${norm(c.cargo)}`,
      matricula: c.matricula,
      nome: c.nome,
      area: "escolastica" as const,
      resumo: `Cargo "${c.cargo}" no novo, sem função atual no antigo`,
      dados: { Cargo: c.cargo },
      robo: null,
      revisao: false,
    }));
}

// ---------------------------------------------------------------- normalização

export function norm(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}
const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
/** Telefone sem país e sem zero de operadora: "+55 (66) 99999-0000" → "66999990000". */
export function fone(s: string | null | undefined): string {
  let d = digitos(s);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.replace(/^0+/, "");
}
const centavos = (v: number) => Math.round(v * 100);
const chaveRecibo = (m: string, data: string, valor: number) => `${m}|${data}|${centavos(valor)}`;
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const virgula = (v: number) => v.toFixed(2).replace(".", ",");
const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Hash curto e estável (para a chave da ação mudar quando o destino muda). */
function hash(v: unknown): string {
  const s = JSON.stringify(v);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Texto livre do novo → código do select do antigo (personal-data-options.ts). Sem correspondência, não grava. */
export function codigoEstadoCivil(t: string | null): string | null {
  const n = norm(t);
  if (!n) return null;
  if (/^(SOL|CAS|UNE|DIV|SEP|VIU)$/.test(n)) return n;
  if (n.startsWith("SOLTEIR")) return "SOL";
  if (n.startsWith("CASAD")) return "CAS";
  if (n.includes("UNIAO") || n.includes("ESTAVEL")) return "UNE";
  if (n.startsWith("DIVORCI")) return "DIV";
  if (n.startsWith("SEPARAD")) return "SEP";
  if (n.startsWith("VIUV")) return "VIU";
  return null;
}
export function codigoEscolaridade(t: string | null): string | null {
  const n = norm(t);
  if (!n) return null;
  if (/^(GR1|GR2|GR3|GR4|GRP|GRM|GRO)$/.test(n)) return n;
  if (n.includes("DOUTOR")) return "GRO";
  if (n.includes("MESTR")) return "GRM";
  if (n.includes("POS")) return "GRP";
  if (n.includes("SUPERIOR") && n.includes("INCOMPLET")) return "GR4";
  if (n.includes("SUPERIOR") || n.includes("GRADUA")) return "GR3";
  if (n.includes("SEGUNDO") || n.includes("MEDIO")) return "GR2";
  if (n.includes("PRIMEIRO") || n.includes("FUNDAMENTAL")) return "GR1";
  return null;
}
