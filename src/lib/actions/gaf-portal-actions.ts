"use server";

import { getAuthenticatedMember } from "@/lib/auth";
import { gafNoPortal, meusGrupos, type GafNoPortal } from "@/lib/grupos-dados";

/** GAFs da pessoa como aparecem no Portal do aluno (carregados ao abrir o quadro do GAF). */
export async function meusGafsNoPortal(): Promise<GafNoPortal[]> {
  const eu = await getAuthenticatedMember();
  if (!eu) return [];
  const gafs = await meusGrupos(eu, ["GAF"]);
  return (await Promise.all(gafs.map((g) => gafNoPortal(eu, g.id)))).filter((g): g is GafNoPortal => !!g);
}
