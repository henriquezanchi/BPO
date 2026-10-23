import { db } from "@/lib/db";
import {
  carregarContextoSecretaria,
  podeGerirMandatoExistente,
  podePublicarNoTerritorio,
  podeVerPublicacao,
  secretariasParaPublicar,
  secretariasNacionaisAtivas,
  escoposDeMandatoPermitidos,
  territoriosDePublicacao,
  podeGerirEscalaSecretaria,
  podeVerEscalaSecretaria,
  escolasAutorizadasParaEscala,
  leituraConfirmadaNaVersao,
  type Territorio,
  type LeituraVersao,
} from "@/lib/secretarias-rede/acesso";
import type { Member } from "@prisma/client";

type PessoaAtiva = Pick<Member, "id" | "schoolId" | "mercurioId" | "mercurioAtivo" | "isDiretor" | "isSubChefe" | "isSecretarioEscolastica" | "isSecretarioEconomia" | "filiaisChefiadas">;

export async function carregarBibliotecaSecretarias(member: PessoaAtiva) {
  const ctx = await carregarContextoSecretaria(member);
  const idsEscolasEscala = escolasAutorizadasParaEscala(ctx);
  const [publicacoes, mandatos, escalasRaw] = await Promise.all([
    db.secretariaPublicacao.findMany({ where: { publicado: true }, orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }] }),
    db.secretariaMandato.findMany({ orderBy: [{ secretaria: "asc" }, { escopo: "asc" }] }),
    idsEscolasEscala.length
      ? db.secretariaEscala.findMany({ where: { schoolId: { in: idsEscolasEscala } }, orderBy: [{ secretaria: "asc" }, { diaSemana: "asc" }, { inicioMinuto: "asc" }] })
      : Promise.resolve([]),
  ]);
  const visiveis = publicacoes.filter((publicacao) =>
    podeVerPublicacao(ctx, publicacao.secretaria, { schoolIds: publicacao.schoolIds, ufs: publicacao.ufs }),
  );
  const idsPublicacoes = visiveis.map((publicacao) => publicacao.id);
  const escalas = escalasRaw.filter((escala) => podeVerEscalaSecretaria(ctx, escala.secretaria, escala.schoolId));
  const [leituras, autores, membrosMandato] = await Promise.all([
    idsPublicacoes.length
      ? db.secretariaLeitura.findMany({ where: { memberId: member.id, publicacaoId: { in: idsPublicacoes } }, select: { publicacaoId: true, versao: true } })
      : Promise.resolve([]),
    db.member.findMany({ where: { id: { in: [...new Set(visiveis.map((p) => p.autorId))] } }, select: { id: true, name: true } }),
    db.member.findMany({ where: { id: { in: [...new Set(mandatos.map((m) => m.memberId))] } }, select: { id: true, name: true, school: { select: { name: true, uf: true } } } }),
  ]);
  const [membrosEscala, escolasEscala] = await Promise.all([
    escalas.length
      ? db.member.findMany({ where: { id: { in: [...new Set(escalas.map((escala) => escala.memberId))] } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    idsEscolasEscala.length
      ? db.school.findMany({ where: { id: { in: idsEscolasEscala } }, select: { id: true, name: true, city: true, uf: true } })
      : Promise.resolve([]),
  ]);
  const nomesAutores = new Map(autores.map((autor) => [autor.id, autor.name]));
  const leiturasVersao: LeituraVersao[] = leituras;
  const nomesMembros = new Map(membrosMandato.map((pessoa) => [pessoa.id, { name: pessoa.name, school: pessoa.school.name, uf: pessoa.school.uf }]));
  const nomesEquipeEscala = new Map(membrosEscala.map((pessoa) => [pessoa.id, pessoa.name]));
  const escolasEscalaNome = new Map(escolasEscala.map((escola) => [escola.id, escola.name]));
  const publicacoesProntas = visiveis.map((publicacao) => {
    const territorio: Territorio = { schoolIds: publicacao.schoolIds, ufs: publicacao.ufs };
    const podeGerir = podePublicarNoTerritorio(ctx, publicacao.secretaria, territorio);
    return {
      id: publicacao.id,
      secretaria: publicacao.secretaria,
      autorId: publicacao.autorId,
      autorNome: nomesAutores.get(publicacao.autorId) ?? "Membro da rede",
      titulo: publicacao.titulo,
      tipo: publicacao.tipo,
      conteudo: publicacao.conteudo,
      url: publicacao.url,
      schoolIds: publicacao.schoolIds,
      ufs: publicacao.ufs,
      inicio: publicacao.inicio?.toISOString() ?? null,
      fim: publicacao.fim?.toISOString() ?? null,
      versao: publicacao.versao,
      exigeLeitura: publicacao.exigeLeitura,
      criadoEm: publicacao.createdAt.toISOString(),
      atualizadoEm: publicacao.updatedAt.toISOString(),
      lida: leituraConfirmadaNaVersao(leiturasVersao, publicacao.id, publicacao.versao),
      podeGerir,
    };
  });
  const mandatosGerenciaveis = mandatos
    .filter((mandato) => podeGerirMandatoExistente(ctx, mandato))
    .map((mandato) => ({
      id: mandato.id,
      memberId: mandato.memberId,
      nomeMembro: nomesMembros.get(mandato.memberId)?.name ?? "Membro não encontrado",
      escolaMembro: nomesMembros.get(mandato.memberId)?.school ?? "",
      ufMembro: nomesMembros.get(mandato.memberId)?.uf ?? null,
      secretaria: mandato.secretaria,
      escopo: mandato.escopo,
      schoolIds: mandato.schoolIds,
      ufs: mandato.ufs,
      ativo: mandato.ativo,
    }));
  const escalasProntas = escalas.map((escala) => ({
    id: escala.id,
    secretaria: escala.secretaria,
    schoolId: escala.schoolId,
    schoolName: escolasEscalaNome.get(escala.schoolId) ?? "Escola da rede",
    memberId: escala.memberId,
    memberName: nomesEquipeEscala.get(escala.memberId) ?? "Membro da rede",
    funcao: escala.funcao,
    diaSemana: escala.diaSemana,
    inicioMinuto: escala.inicioMinuto,
    fimMinuto: escala.fimMinuto,
    validaDe: escala.validaDe,
    validaAte: escala.validaAte,
    confirmado: escala.confirmado,
    podeGerir: podeGerirEscalaSecretaria(ctx, escala.secretaria, escala.schoolId),
  }));
  const secretariasBiblioteca = [...new Set(publicacoesProntas.map((publicacao) => publicacao.secretaria))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const ufs = [...new Set(ctx.escolas.flatMap((escola) => escola.uf ? [escola.uf.toUpperCase()] : []))].sort();
  const escoposMandatoPermitidos = escoposDeMandatoPermitidos(ctx);
  const podeGerirMandatos = escoposMandatoPermitidos.length > 0;
  const escolasMandatoLocal = ctx.member.isDiretor ? [...new Set([member.schoolId, ...ctx.escolasChefiadas])] : [];
  const escolasPayload = ctx.administradorNacional
    ? ctx.escolas
    : ctx.escolas.filter((escola) => idsEscolasEscala.includes(escola.id) || escolasMandatoLocal.includes(escola.id) || visiveis.some((pub) => pub.schoolIds.includes(escola.id)));
  const ufsPayload = [...new Set(escolasPayload.flatMap((escola) => escola.uf ? [escola.uf.toUpperCase()] : []))].sort();
  const secretariasEscala = [...new Set([...secretariasParaPublicar(ctx), ...escalasProntas.map((escala) => escala.secretaria)])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const hoje = new Date();
  const validadeEscalaAte = new Date(hoje);
  validadeEscalaAte.setUTCDate(validadeEscalaAte.getUTCDate() + 60);
  return {
    membroId: member.id,
    publicacoes: publicacoesProntas,
    secretariasBiblioteca,
    secretariasPublicaveis: secretariasParaPublicar(ctx),
    territoriosPublicacao: territoriosDePublicacao(ctx),
    podePublicarLivre: ctx.administradorNacional,
    escolas: escolasPayload,
    ufs: ctx.administradorNacional ? ufs : ufsPayload,
    escolaIdUsuario: member.schoolId,
    escoposMandatoPermitidos,
    secretariasNacionais: secretariasNacionaisAtivas(ctx),
    escolasMandatoLocal,
    podeGerirMandatos,
    mandatos: mandatosGerenciaveis,
    escolasEscala: escolasEscala.map((escola) => ({ id: escola.id, name: escola.name, city: escola.city, uf: escola.uf })),
    escalas: escalasProntas,
    secretariasEscala,
    podeGerirEscalaLivre: ctx.administradorNacional || ctx.escolasDirecionadas.length > 0,
    hoje: hoje.toISOString().slice(0, 10),
    validadeEscalaAte: validadeEscalaAte.toISOString().slice(0, 10),
  };
}

export type PaginaSecretariasRede = Awaited<ReturnType<typeof carregarBibliotecaSecretarias>>;

