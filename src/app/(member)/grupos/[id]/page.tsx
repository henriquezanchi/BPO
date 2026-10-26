import {carregarContextoSecretaria,podeAcessarSecretaria} from "@/lib/secretarias-rede/acesso";
import { AreaSecretaria } from "@/components/secretarias-rede/area-secretaria";
import { AvisosDoGrupo } from "@/components/grupos/avisos-do-grupo";
import { EscalaDoGrupo } from "@/components/grupos/escala-servidor";
import { GrupoPainel } from "@/components/grupos/grupo-painel";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { destinosDaPessoa } from "@/lib/area-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { detalheDoGrupo } from "@/lib/grupos-dados";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Página de um grupo: GAF, GDVE, secretaria ou Grupo Feminino/Masculino/de
 * Segurança. Voluntários e administração veem dentro da Área do Voluntário;
 * quem só participa de um GAF (aluno) vê uma página simples, com volta ao Portal.
 */
export default async function GrupoPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ de?: string; aba?: string }> }) {
  const { id } = await props.params;
  const { aba } = await props.searchParams;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/grupos/${id}`);
  const [dados, destinos] = await Promise.all([detalheDoGrupo(member, id), destinosDaPessoa(member)]);
  if (!dados) notFound();
  const orientacoes=dados.grupo.tipo==='SEC'&&member.mercurioAtivo&&podeAcessarSecretaria(await carregarContextoSecretaria(member),dados.grupo.name);
  // Uma tela só por grupo (pedido do usuário 2026-10-25): avisos/enquetes (antes em Professor) e orientações viram abas.
  const painel = (
    <GrupoPainel
      dados={dados}
      abaInicial={aba}
      avisos={dados.papel.podeGerir ? <AvisosDoGrupo grupoId={dados.grupo.id} /> : undefined}
      orientacoes={orientacoes ? <AreaSecretaria secretaria={dados.grupo.name} /> : undefined}
      escala={dados.grupo.tipo === "PED" ? <EscalaDoGrupo grupoId={dados.grupo.id} euId={member.id} podeGerir={dados.papel.podeGerir} /> : undefined}
    />
  );

  if (!destinos.length) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
        <div className="flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft size={14} /> Portal do Aluno
          </Link>
          <ThemeToggle />
        </div>
        {painel}
      </main>
    );
  }
  return (
    <ShellTrabalho ativo={dados.grupo.tipo === "SEC" ? "/secretarias" : "/grupos"}>
      {painel}
    </ShellTrabalho>
  );
}
