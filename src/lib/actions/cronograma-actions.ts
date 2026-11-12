"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { type AcaoCronograma, SITUACOES, type Situacao, gravarCronograma, lerCronograma } from "@/lib/cronograma-spread";
import { ehDonoDoSistema } from "@/lib/dono-do-sistema";
import { revalidatePath } from "next/cache";

/** Edição do cronograma do spread (lib/cronograma-spread.ts). Só o dono do sistema. */
const erro = (error: string) => ({ ok: false as const, error });
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

async function permitido() {
  const eu = await getAuthenticatedMember();
  return !!eu && ehDonoDoSistema(eu);
}

async function alterar(fn: (acoes: AcaoCronograma[]) => AcaoCronograma[] | string) {
  if (!(await permitido())) return erro("Só o dono do sistema edita o cronograma.");
  const r = fn(await lerCronograma());
  if (typeof r === "string") return erro(r);
  await gravarCronograma(r);
  revalidatePath("/admin/cronograma");
  return { ok: true as const };
}

type Dados = Omit<AcaoCronograma, "id" | "registros"> & { id?: string };

export async function salvarAcao(d: Dados) {
  const acao = String(d.acao ?? "").trim().slice(0, 300);
  if (!acao) return erro("Escreva a ação.");
  if (!DATA.test(d.inicio) || !DATA.test(d.fim)) return erro("Preencha as duas datas.");
  if (d.fim < d.inicio) return erro("O prazo final não pode ser antes do início.");
  if (!(d.status in SITUACOES)) return erro("Situação inválida.");
  const dias = d.dias === null || d.dias === undefined || Number.isNaN(Number(d.dias)) ? null : Math.max(0, Number(d.dias));
  const campos = {
    acao,
    fase: String(d.fase ?? "").trim().slice(0, 80) || "Sem fase",
    inicio: d.inicio,
    fim: d.fim,
    status: d.status,
    pessoas: String(d.pessoas ?? "").trim().slice(0, 500),
    materiais: String(d.materiais ?? "").trim().slice(0, 2000),
    duracao: String(d.duracao ?? "").trim().slice(0, 120),
    dias,
    obs: String(d.obs ?? "").trim().slice(0, 2000),
  };
  return alterar((acoes) => {
    if (!d.id) return [...acoes, { ...campos, id: `n${Date.now().toString(36)}`, registros: [{ em: hoje(), texto: "Ação incluída" }] }];
    const i = acoes.findIndex((a) => a.id === d.id);
    if (i < 0) return "Essa ação não existe mais. Recarregue a página.";
    const antes = acoes[i];
    const registros = antes.status !== campos.status ? [...antes.registros, { em: hoje(), texto: `Situação: ${SITUACOES[campos.status]}` }] : antes.registros;
    return acoes.map((a, j) => (j === i ? { ...antes, ...campos, registros } : a));
  });
}

export async function excluirAcao(id: string) {
  return alterar((acoes) => (acoes.some((a) => a.id === id) ? acoes.filter((a) => a.id !== id) : "Essa ação não existe mais."));
}

export async function mudarSituacao(id: string, status: Situacao) {
  if (!(status in SITUACOES)) return erro("Situação inválida.");
  return alterar((acoes) =>
    acoes.map((a) => (a.id === id && a.status !== status ? { ...a, status, registros: [...a.registros, { em: hoje(), texto: `Situação: ${SITUACOES[status]}` }] } : a)),
  );
}

export async function registrar(id: string, texto: string) {
  const t = String(texto ?? "").trim().slice(0, 500);
  if (!t) return erro("Escreva o que aconteceu.");
  return alterar((acoes) => acoes.map((a) => (a.id === id ? { ...a, registros: [...a.registros, { em: hoje(), texto: t }] } : a)));
}
