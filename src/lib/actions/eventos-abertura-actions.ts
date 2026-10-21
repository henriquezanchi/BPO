"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";

/** Filiais do Portal, para abrir as inscrições de um evento a outras filiais (pedido do usuário 2026-10-19). */
export async function listarFiliaisParaEventos() {
  const m = await getAuthenticatedMember();
  if (!m) return [];
  const escolas = await db.school.findMany({ where: { language: "pt" }, select: { id: true, name: true, uf: true }, orderBy: { name: "asc" } });
  return escolas.map((e) => ({ id: e.id, nome: e.name.replace(/^Nova Acrópole\s*-\s*/i, ""), uf: e.uf }));
}
