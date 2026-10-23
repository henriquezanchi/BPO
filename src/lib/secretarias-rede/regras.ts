export const TIPOS_PUBLICACAO = ["material", "aviso", "reuniao", "ideia", "plano"] as const;
export type TipoPublicacao = (typeof TIPOS_PUBLICACAO)[number];
export type EscopoMandato = "nacional" | "regional" | "local";
export type Territorio = { schoolIds: string[]; ufs: string[] };
export type EscolaTerritorio = { id: string; name: string; city: string | null; uf: string | null };
export type MandatoRede = { id: string; memberId: string; secretaria: string; escopo: string; schoolIds: string[]; ufs: string[]; ativo: boolean };
export type ResponsabilidadeLocal = { secretaria: string; schoolId: string; uf: string | null; papel: "responsavel" | "equipe" };

export type ContextoSecretaria = {
  member: { id: string; schoolId: string; isDiretor: boolean };
  administradorNacional: boolean;
  mandatos: MandatoRede[];
  responsabilidades: ResponsabilidadeLocal[];
  escolas: EscolaTerritorio[];
  escolasChefiadas: string[];
  escolasDirecionadas: string[];
};

export type LeituraVersao = { publicacaoId: string; versao: number };

export function chaveSecretaria(nome: string) {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^SECRETARIA (?:DE|DO|DA|DOS|DAS) /, "");
}

export function normalizarUf(value: string) {
  return value.trim().toUpperCase();
}

/** A escola precisa satisfazer os dois filtros quando ambos são informados. */
export function escolasDoTerritorio(escolas: EscolaTerritorio[], territorio: Territorio): EscolaTerritorio[] {
  const ids = new Set(territorio.schoolIds);
  const ufs = new Set(territorio.ufs.map(normalizarUf));
  return escolas.filter((escola) => {
    if (ids.size > 0 && !ids.has(escola.id)) return false;
    if (ufs.size > 0 && (!escola.uf || !ufs.has(normalizarUf(escola.uf)))) return false;
    return true;
  });
}

export function territorioContem(escolas: EscolaTerritorio[], continente: Territorio, conteudo: Territorio): boolean {
  const areaContida = new Set(escolasDoTerritorio(escolas, continente).map((escola) => escola.id));
  const areaConteudo = escolasDoTerritorio(escolas, conteudo);
  return areaConteudo.length > 0 && areaConteudo.every((escola) => areaContida.has(escola.id));
}

export function territoriosSeSobrepoem(escolas: EscolaTerritorio[], a: Territorio, b: Territorio): boolean {
  const idsB = new Set(escolasDoTerritorio(escolas, b).map((escola) => escola.id));
  return escolasDoTerritorio(escolas, a).some((escola) => idsB.has(escola.id));
}

export function territorioDoMandato(mandato: Pick<MandatoRede, "schoolIds" | "ufs">): Territorio {
  return { schoolIds: mandato.schoolIds, ufs: mandato.ufs.map(normalizarUf) };
}

export function validarTerritorio(
  escolas: EscolaTerritorio[],
  value: { schoolIds: string[]; ufs: string[] },
  escopo?: EscopoMandato,
): Territorio {
  const schoolIds = [...new Set(value.schoolIds.map((id) => id.trim()).filter(Boolean))];
  const ufs = [...new Set(value.ufs.map(normalizarUf).filter(Boolean))];
  const idsDisponiveis = new Set(escolas.map((escola) => escola.id));
  const ufsDisponiveis = new Set(escolas.flatMap((escola) => escola.uf ? [normalizarUf(escola.uf)] : []));
  if (schoolIds.some((id) => !idsDisponiveis.has(id))) throw new Error("Uma das escolas informadas não existe.");
  if (ufs.some((uf) => !ufsDisponiveis.has(uf))) throw new Error("Uma das UFs informadas não existe. Selecione os estados cadastrados na rede.");
  const territorio = { schoolIds, ufs };
  if (escopo === "nacional" && (schoolIds.length || ufs.length)) throw new Error("Mandato nacional não recebe restrição de escola ou estado.");
  if (escopo === "regional" && !schoolIds.length && !ufs.length) throw new Error("Informe pelo menos uma escola ou UF para o mandato regional.");
  if (escopo === "local" && (schoolIds.length !== 1 || ufs.length)) throw new Error("Mandato local precisa indicar somente uma escola.");
  if ((escopo === "local" || escopo === "regional") && !escolasDoTerritorio(escolas, territorio).length) throw new Error("O território não contém escolas cadastradas.");
  return territorio;
}

function ehTerritorioValidoDoRegistro(ctx: ContextoSecretaria, territorio: Territorio) {
  const idSet = new Set(ctx.escolas.map((escola) => escola.id));
  const ufSet = new Set(ctx.escolas.flatMap((escola) => escola.uf ? [normalizarUf(escola.uf)] : []));
  return territorio.schoolIds.every((id) => idSet.has(id)) && territorio.ufs.every((uf) => ufSet.has(normalizarUf(uf)));
}

export function mandatoBemFormado(ctx: ContextoSecretaria, mandato: MandatoRede) {
  const territorio = territorioDoMandato(mandato);
  if (!ehTerritorioValidoDoRegistro(ctx, territorio)) return false;
  if (mandato.escopo === "nacional") return !territorio.schoolIds.length && !territorio.ufs.length;
  if (mandato.escopo === "regional") return (!!territorio.schoolIds.length || !!territorio.ufs.length) && escolasDoTerritorio(ctx.escolas, territorio).length > 0;
  if (mandato.escopo === "local") return territorio.schoolIds.length === 1 && territorio.ufs.length === 0 && escolasDoTerritorio(ctx.escolas, territorio).length === 1;
  return false;
}

function mandatoValido(ctx: ContextoSecretaria, mandato: MandatoRede) {
  return mandato.ativo && mandatoBemFormado(ctx, mandato);
}

function territoriosPermitidosPara(ctx: ContextoSecretaria, secretaria: string, incluiEquipe = false): Territorio[] {
  if (ctx.administradorNacional) return [{ schoolIds: [], ufs: [] }];
  const key = chaveSecretaria(secretaria);
  return [
    ...ctx.mandatos
      .filter((mandato) => mandatoValido(ctx, mandato) && chaveSecretaria(mandato.secretaria) === key)
      .map(territorioDoMandato),
    ...ctx.responsabilidades
      .filter((r) => r.papel === "responsavel" || (incluiEquipe && r.papel === "equipe"))
      .filter((r) => chaveSecretaria(r.secretaria) === key)
      .map((r) => ({ schoolIds: [r.schoolId], ufs: [] })),
  ];
}

export function podeVerPublicacao(ctx: ContextoSecretaria, secretaria: string, territorio: Territorio): boolean {
  if (ctx.administradorNacional) return true;
  if (!ehTerritorioValidoDoRegistro(ctx, territorio)) return false;
  const key = chaveSecretaria(secretaria);
  const leitorResponsavel = ctx.responsabilidades.some((r) => r.papel === "responsavel" && chaveSecretaria(r.secretaria) === key);
  const leitorEquipeAutorizada = ctx.responsabilidades.some((r) => r.papel === "equipe" && chaveSecretaria(r.secretaria) === key);
  const escopos = territoriosPermitidosPara(ctx, secretaria, true);
  if (leitorResponsavel || leitorEquipeAutorizada || ctx.mandatos.some((m) => mandatoValido(ctx, m) && chaveSecretaria(m.secretaria) === key)) {
    if (escopos.some((escopo) => territoriosSeSobrepoem(ctx.escolas, escopo, territorio))) return true;
  }
  return ctx.escolasChefiadas.length > 0 && territoriosSeSobrepoem(ctx.escolas, { schoolIds: ctx.escolasChefiadas, ufs: [] }, territorio);
}

export function podePublicarNoTerritorio(ctx: ContextoSecretaria, secretaria: string, territorio: Territorio): boolean {
  if (!ehTerritorioValidoDoRegistro(ctx, territorio)) return false;
  if (!territorio.schoolIds.length && !territorio.ufs.length) {
    return ctx.administradorNacional || ctx.mandatos.some((mandato) =>
      mandatoValido(ctx, mandato) &&
      mandato.escopo === "nacional" &&
      chaveSecretaria(mandato.secretaria) === chaveSecretaria(secretaria),
    );
  }
  return territoriosPermitidosPara(ctx, secretaria).some((permitido) => territorioContem(ctx.escolas, permitido, territorio));
}

export function secretariasParaPublicar(ctx: ContextoSecretaria): string[] {
  const nomes = [
    ...ctx.mandatos.filter((m) => mandatoValido(ctx, m)).map((m) => m.secretaria),
    ...ctx.responsabilidades.filter((r) => r.papel === "responsavel").map((r) => r.secretaria),
  ];
  const unicos = new Map<string, string>();
  for (const nome of nomes) if (!unicos.has(chaveSecretaria(nome))) unicos.set(chaveSecretaria(nome), nome);
  return [...unicos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function secretariasNacionaisAtivas(ctx: ContextoSecretaria): string[] {
  return [...new Set(ctx.mandatos
    .filter((mandato) => mandatoValido(ctx, mandato) && mandato.escopo === "nacional")
    .map((mandato) => mandato.secretaria))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function territoriosDePublicacao(ctx: ContextoSecretaria) {
  if (ctx.administradorNacional) return secretariasParaPublicar(ctx).map((nome) => ({ nome, livre: true, territorios: [] as Territorio[] }));
  const porChave = new Map<string, { nome: string; livre: boolean; territorios: Territorio[] }>();
  const incluir = (nome: string, territorio: Territorio) => {
    const key = chaveSecretaria(nome);
    const atual = porChave.get(key) ?? { nome, livre: false, territorios: [] };
    if (!atual.territorios.some((t) => t.schoolIds.join(",") === territorio.schoolIds.join(",") && t.ufs.join(",") === territorio.ufs.join(","))) atual.territorios.push(territorio);
    porChave.set(key, atual);
  };
  for (const mandato of ctx.mandatos.filter((m) => mandatoValido(ctx, m))) incluir(mandato.secretaria, territorioDoMandato(mandato));
  for (const responsabilidade of ctx.responsabilidades.filter((r) => r.papel === "responsavel")) {
    incluir(responsabilidade.secretaria, { schoolIds: [responsabilidade.schoolId], ufs: [] });
  }
  return [...porChave.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function escoposDeMandatoPermitidos(ctx: ContextoSecretaria): EscopoMandato[] {
  if (ctx.administradorNacional) return ["nacional", "regional", "local"];
  const escopos: EscopoMandato[] = [];
  if (ctx.member.isDiretor) escopos.push("local");
  if (ctx.mandatos.some((m) => mandatoValido(ctx, m) && m.escopo === "nacional")) escopos.push("regional");
  return escopos;
}

export function podeAtribuirMandato(ctx: ContextoSecretaria, secretaria: string, escopo: EscopoMandato, territorio: Territorio): boolean {
  try {
    validarTerritorio(ctx.escolas, territorio, escopo);
  } catch {
    return false;
  }
  if (ctx.administradorNacional) return true;
  const permitidos = ctx.mandatos.filter((m) => mandatoValido(ctx, m) && m.escopo === "nacional" && chaveSecretaria(m.secretaria) === chaveSecretaria(secretaria));
  if (escopo === "regional") return permitidos.some((m) => territorioContem(ctx.escolas, territorioDoMandato(m), territorio));
  if (escopo === "local" && ctx.member.isDiretor) {
    const ids = territorio.schoolIds;
    return ids.length === 1 && territorio.ufs.length === 0 && (ids[0] === ctx.member.schoolId || ctx.escolasChefiadas.includes(ids[0]));
  }
  return false;
}

export function membroCabeNoTerritorio(escolas: EscolaTerritorio[], schoolId: string, territorio: Territorio) {
  const escola = escolas.find((item) => item.id === schoolId);
  return !!escola && escolasDoTerritorio(escolas, territorio).some((item) => item.id === escola.id);
}

export function podeGerirMandatoExistente(ctx: ContextoSecretaria, mandato: MandatoRede): boolean {
  if (ctx.administradorNacional) return true;
  if (!mandatoBemFormado(ctx, mandato)) return false;
  const territorio = territorioDoMandato(mandato);
  if (mandato.escopo === "local" && ctx.member.isDiretor && (territorio.schoolIds[0] === ctx.member.schoolId || ctx.escolasChefiadas.includes(territorio.schoolIds[0]))) return true;
  if (mandato.escopo !== "regional") return false;
  return ctx.mandatos.some((m) =>
    mandatoValido(ctx, m) &&
    m.escopo === "nacional" &&
    chaveSecretaria(m.secretaria) === chaveSecretaria(mandato.secretaria) &&
    territorioContem(ctx.escolas, territorioDoMandato(m), territorio),
  );
}

export function podeGerirEscalaSecretaria(ctx: ContextoSecretaria, secretaria: string, schoolId: string): boolean {
  if (ctx.administradorNacional) return true;
  if (ctx.escolasDirecionadas.includes(schoolId)) return true;
  const key = chaveSecretaria(secretaria);
  if (ctx.responsabilidades.some((r) => r.papel === "responsavel" && r.schoolId === schoolId && chaveSecretaria(r.secretaria) === key)) return true;
  return ctx.mandatos.some((m) =>
    mandatoValido(ctx, m) &&
    chaveSecretaria(m.secretaria) === key &&
    escolasDoTerritorio(ctx.escolas, territorioDoMandato(m)).some((escola) => escola.id === schoolId),
  );
}

export function podeVerEscalaSecretaria(ctx: ContextoSecretaria, secretaria: string, schoolId: string): boolean {
  return podeGerirEscalaSecretaria(ctx, secretaria, schoolId);
}

export function escolasAutorizadasParaEscala(ctx: ContextoSecretaria): string[] {
  if (ctx.administradorNacional) return ctx.escolas.map((escola) => escola.id);
  const ids = new Set(ctx.escolasDirecionadas);
  for (const responsabilidade of ctx.responsabilidades) if (responsabilidade.papel === "responsavel") ids.add(responsabilidade.schoolId);
  for (const mandato of ctx.mandatos.filter((m) => mandatoValido(ctx, m))) {
    for (const escola of escolasDoTerritorio(ctx.escolas, territorioDoMandato(mandato))) ids.add(escola.id);
  }
  return [...ids];
}

export function leituraConfirmadaNaVersao(leituras: LeituraVersao[], publicacaoId: string, versao: number): boolean {
  return leituras.some((leitura) => leitura.publicacaoId === publicacaoId && leitura.versao === versao);
}

export function versaoSolicitadaEstaAtual(versaoPublicacao: number, versaoSolicitada: number): boolean {
  return Number.isInteger(versaoSolicitada) && versaoSolicitada > 0 && versaoPublicacao === versaoSolicitada;
}

/** Uma atribuição nacional/regional administra apenas a secretaria indicada. */
export function podeAcessarSecretaria(ctx:ContextoSecretaria,secretaria:string){
 const chave=chaveSecretaria(secretaria);
 return ctx.administradorNacional||ctx.escolasDirecionadas.length>0||
  ctx.mandatos.some(m=>mandatoValido(ctx,m)&&chaveSecretaria(m.secretaria)===chave)||
  ctx.responsabilidades.some(r=>chaveSecretaria(r.secretaria)===chave);
}
export function contextoDaSecretaria(ctx:ContextoSecretaria,secretaria:string):ContextoSecretaria{
 const chave=chaveSecretaria(secretaria);
 return {...ctx,mandatos:ctx.mandatos.filter(m=>chaveSecretaria(m.secretaria)===chave),responsabilidades:ctx.responsabilidades.filter(r=>chaveSecretaria(r.secretaria)===chave)};
}
