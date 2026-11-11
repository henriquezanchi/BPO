import { AbasArea } from "@/components/trabalho/areas";
import { ABAS_ESCOLASTICA } from "@/lib/abas-escolastica";
import { getAuthenticatedMember } from "@/lib/auth";
import { acessoNovosPedagogos, temAcessoNovosPedagogos } from "@/lib/solicitacoes-pedagogo";

/** Abas da Escolástica; "Novos pedagogos" só aparece para o Chefe, o Sub-Chefe e a administração nacional (11/11/2026). */
export async function AbasEscolastica({ atual }: { atual: string }) {
  const member = await getAuthenticatedMember();
  const comNovos = !!member && temAcessoNovosPedagogos(await acessoNovosPedagogos(member));
  return <AbasArea base="/escolastica" atual={atual} abas={comNovos ? ABAS_ESCOLASTICA : ABAS_ESCOLASTICA.filter(([id]) => id !== "novos-pedagogos")} />;
}
