import {carregarContextoSecretaria,podeAcessarSecretaria} from "@/lib/secretarias-rede/acesso";
import { AreaSecretaria } from "@/components/secretarias-rede/area-secretaria";
import { AvisosDoGrupo } from "@/components/grupos/avisos-do-grupo";
import { DiarioFvDoGrupo } from "@/components/fv/diario-fv-servidor";
import { EscalaDoGrupo } from "@/components/grupos/escala-servidor";
import { GrupoPainel } from "@/components/grupos/grupo-painel";
import { ShellTrabalho } from "@/components/trabalho/shell-trabalho";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { destinosDaPessoa } from "@/lib/area-trabalho";
import { getAuthenticatedMember } from "@/lib/auth";
import { detalheDoGrupo } from "@/lib/grupos-dados";
import { ProgramacaoTurma } from "@/components/member/professor/programacao-turma";
import { RepertorioArtes } from "@/components/grupos/repertorio-artes";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { agendaDaTurma } from "@/lib/programacao-turma";
import { fusoDaEscola } from "@/lib/fuso-escola";
import { hojeNoFuso } from "@/lib/diario";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Página de um grupo: GAF, GDVE, secretaria ou Grupo Feminino/Masculino/de
 * Segurança. Voluntários e administração veem dentro da Área do Voluntário;
 * quem só participa de um GAF (aluno) vê uma página simples, com volta ao Portal.
 */
export default async function GrupoPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ de?: string; aba?: string; dia?: string }> }) {
  const { id } = await props.params;
  const { aba, dia } = await props.searchParams;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=/grupos/${id}`);
  const [dados, destinos] = await Promise.all([detalheDoGrupo(member, id), destinosDaPessoa(member)]);
  if (!dados) notFound();
  const orientacoes=dados.grupo.tipo==='SEC'&&member.mercurioAtivo&&podeAcessarSecretaria(await carregarContextoSecretaria(member),dados.grupo.name);
  // Uma tela só por grupo (pedido do usuário 2026-10-25): avisos/enquetes (antes em Professor) e orientações viram abas.
  // Programação do grupo para o WhatsApp (17/11/2026): quem gere o grupo (GAF, GDVE, Pedagogos, secretarias...).
  const fuso = fusoDaEscola(member.school?.uf);
  const programacao = dados.papel.podeGerir ? (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <CollapsibleSection title={<h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200"><span className="sm:hidden">Programação no WhatsApp</span><span className="hidden sm:inline">Programação do grupo para o WhatsApp</span></h2>}>
        <ProgramacaoTurma
          items={await agendaDaTurma(dados.grupo.id)}
          fuso={fuso}
          escola={member.school?.name ?? ""}
          hoje={hojeNoFuso(fuso)}
          publicos={dados.grupo.tipo === "PED" ? ["Pedagogos", "Integrantes"] : ["Integrantes", "Voluntários", "Membros", "Alunos"]}
          turmaNoTexto={dados.grupo.tipo === "PED" ? "turma de Pedagogos" : undefined}
          onde={ondeDoGrupo(dados.grupo)}
          descricaoItens="encontros e atividades do grupo"
        />
      </CollapsibleSection>
    </section>
  ) : null;
  const painel = (
    <GrupoPainel
      dados={dados}
      abaInicial={aba}
      avisos={dados.papel.podeGerir ? <AvisosDoGrupo grupoId={dados.grupo.id} /> : undefined}
      orientacoes={orientacoes ? <AreaSecretaria secretaria={dados.grupo.name} /> : undefined}
      repertorio={dados.grupo.tipo === "SEC" && /\barte/i.test(dados.grupo.name) ? <RepertorioArtes grupoId={dados.grupo.id} podeEditar={dados.papel.podeGerir || dados.papel.integrante} /> : undefined}
      escala={dados.grupo.tipo === "PED" ? <EscalaDoGrupo grupoId={dados.grupo.id} euId={member.id} podeGerir={dados.papel.podeGerir} /> : undefined}
      diarioFv={dados.grupo.tipo === "GDVE" && (dados.papel.integrante || dados.papel.responsavel) ? <DiarioFvDoGrupo member={member} dia={dia} /> : undefined}
    />
  );

  if (!destinos.length) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
        <div className="flex items-center justify-between">
          <Link href="/portal" className="-my-2 flex min-h-11 w-fit items-center gap-1.5 text-[13px] font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft size={14} /> Portal do Aluno
          </Link>
          <ThemeToggle />
        </div>
        {painel}
        {programacao}
      </main>
    );
  }
  return (
    <ShellTrabalho ativo={dados.grupo.tipo === "SEC" ? "/secretarias" : "/grupos"}>
      {painel}
      {programacao}
    </ShellTrabalho>
  );
}

/** "Presencial · Sala Platão", "Online · https://meet…" ou "Presencial e online · Sala X · link" (24/11/2026). */
function ondeDoGrupo(g: { modalidade: string | null; local: string | null; linkOnline: string | null }) {
  const modo = g.modalidade === "online" ? "Online" : g.modalidade === "misto" ? "Presencial e online" : "Presencial";
  const partes = [modo, g.modalidade !== "online" ? g.local?.trim() : null, g.modalidade !== "presencial" ? g.linkOnline?.trim() : null].filter(Boolean);
  return partes.join(" · ");
}
