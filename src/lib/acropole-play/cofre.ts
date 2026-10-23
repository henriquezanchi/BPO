import "server-only";
import { db } from "@/lib/db";
import { chavePlay } from "./core";
export async function chaveDoCofrePlay() {
  const linhas = await db.$queryRaw<{chave: string | null}[]>`SELECT public.acropole_play_chave() AS chave`;
  return chavePlay(linhas[0]?.chave ?? undefined);
}
export async function acessoAutomaticoPlayHabilitado() {
  const linhas = await db.$queryRaw<{enabled:boolean}[]>`SELECT "enabled" FROM "AcropolePlayConfig" WHERE "id"=true`;
  return linhas[0]?.enabled === true;
}
