import { caminhoSecretaria } from "@/lib/secretarias-rede/destinos";
import { chaveSecretaria } from "@/lib/secretarias-rede/regras";
import { ehAdministradorNacional, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { areasNaFilial, type AreaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { escolasAberturas } from "@/lib/aberturas/permissoes";
import { ehFV } from "@/lib/grupos-portal";
import { filiaisAdministradas } from "@/lib/recursos-filial";
import { gestaoDeOportunidades } from "@/lib/oportunidades";
import type { Member } from "@prisma/client";
import { redirect } from "next/navigation";

/**
 * Área do Voluntário (pedido do usuário 2026-10-19: "uma forma mais simples
 * de encontrar as coisas — um portal só para o voluntário e o administrador,
 * mostrando só o que cada um pode ver"). Uma lista só de destinos, calculada
 * com as mesmas regras de cada tela; o menu e os atalhos usam esta lista.
 * Cada página continua reconferindo a permissão por conta própria.
 *
 * O antigo Painel da Direção foi distribuído pelas áreas da filial
 * (areas-filial.ts): Visão da filial, Escolástica, Economia, Eventos e Café.
 */
export type IconeDestino =
  | "inicio"
  | "instrutor"
  | "grupos"
  | "escolastica"
  | "avaliacao"
  | "economia"
  | "eventos"
  | "cafe"
  | "direcao"
  | "admin"
  | "acessos"
  | "nacional"
  | "termo"
  | "calendario"
  | "aberturas"
  | "secretarias"
  | "oportunidades";

export type Destino = { href: string; rotulo: string; descricao: string; icone: IconeDestino; secao: "Meu trabalho" | "Secretarias" | "Gestão da filial" | "Nacional"; pendentes?: number };

type Pessoa = Pick<
  Member,
  "id" | "schoolId" | "isDiretor" | "isSubChefe" | "isPedagogo" | "isSecretarioEscolastica" | "isSecretarioEconomia" | "filiaisChefiadas" | "mercurioId" | "mercurioAtivo" | "isMembroPrograma" | "cargos"
>;

export async function destinosDaPessoa(m: Pessoa): Promise<Destino[]> {
  const [acesso, fv, nacional, administra, lideraFV, temGrupo, areas, aberturas, mandatos, oportunidades, interessados] = await Promise.all([
    temAcessoVoluntario(m),
    ehFV(m.id),
    ehAdministradorNacional(m),
    filiaisAdministradas(m),
    db.classMembership.count({ where: { memberId: m.id, role: "professor", classGroup: { tipo: { in: ["BF", "BM", "CS"] } } } }),
    // GAF não faz de ninguém voluntário (alunos participam).
    db.classMembership.count({ where: { memberId: m.id, classGroup: { tipo: { in: ["GDVE", "SEC", "BF", "BM", "CS"] }, arquivadoEm: null } } }),
    areasNaFilial(m, m.schoolId),
    escolasAberturas(m as Member),
    db.secretariaMandato.findMany({where:{memberId:m.id,ativo:true},select:{secretaria:true,escopo:true}}),
    gestaoDeOportunidades(m),
    // Interessados aguardando resposta nas oportunidades de que a pessoa é responsável.
    db.interesseVoluntariado.count({ where: { status: "pendente", oportunidade: { responsavelId: m.id, encerradaEm: null } } }),
  ]);
  const chefe = m.isDiretor || m.filiaisChefiadas.length > 0 || nacional;
  const emSecretaria = await db.classMembership.count({ where: { memberId: m.id, classGroup: { tipo: "SEC", arquivadoEm: null } } });
  const tem = (a: AreaFilial) => areas.includes(a);
  // Pedidos aguardando quem tem a área (pedido do usuário 2026-10-19): alterações de cadastro (Escolástica)
  // e pedidos de diminuir/remover itens da contribuição (Economia).
  const [pedidosCadastro, pedidosComposicao] = await Promise.all([
    tem("escolastica") ? db.contactChangeLog.count({ where: { status: "pendente", member: { schoolId: m.schoolId } } }) : 0,
    tem("economia") ? db.compositionChangeRequest.count({ where: { status: "pendente", member: { schoolId: m.schoolId } } }) : 0,
  ]);
  const d: (Destino | false)[] = [
    { href: "/voluntario", rotulo: "Início", descricao: "Seus grupos, secretarias e encontros", icone: "inicio", secao: "Meu trabalho" },
    // Grupos num lugar só (pedido do usuário 2026-10-25): ver, criar e coordenar.
    (acesso || fv || temGrupo > 0 || administra.length > 0) && { href: "/grupos", rotulo: "Grupos", descricao: "GAF, estudos e leituras, grupos de FV e GDVE", icone: "grupos", secao: "Meu trabalho" },
    (m.isPedagogo || lideraFV > 0) && {
      href: "/professor",
      rotulo: m.isPedagogo ? "Instrutor" : "Avisos dos grupos",
      descricao: m.isPedagogo ? "Turmas, atividades e enquetes" : "Avisos e atividades dos grupos de FV",
      icone: "instrutor",
      secao: "Meu trabalho",
    },
    (tem("eventos") || tem("direcao")) && {
      href: "/voluntario/calendario",
      rotulo: "Calendário",
      descricao: "Aulas, reuniões, eventos e feriados da filial",
      icone: "calendario",
      secao: "Meu trabalho",
    },
    // Oportunidades de voluntariado (pedido do usuário 2026-10-29): Direção e responsáveis de secretarias e grupos.
    (oportunidades.podeCadastrar || interessados > 0) && {
      href: "/voluntario/oportunidades",
      rotulo: "Oportunidades",
      descricao: interessados ? `${interessados} interessado${interessados === 1 ? "" : "s"} aguardando resposta` : "O que a filial precisa e quem se ofereceu",
      icone: "oportunidades",
      secao: "Meu trabalho",
      pendentes: interessados,
    },
    { href: "/voluntario/termo", rotulo: "Termo de voluntariado", descricao: "Como assinar o termo com a filial", icone: "termo", secao: "Meu trabalho" },
    // Secretarias da filial, à parte de Grupos (pedido do usuário 2026-10-25).
    (administra.length > 0 || emSecretaria > 0) && { href: "/secretarias", rotulo: "Secretarias da filial", descricao: "Responsáveis, equipes e atividades de cada secretaria", icone: "secretarias", secao: "Secretarias" },
    tem("escolastica") && {
      href: "/escolastica",
      rotulo: "Escolástica",
      descricao: pedidosCadastro ? `${pedidosCadastro} alteraç${pedidosCadastro === 1 ? "ão" : "ões"} de cadastro aguardando` : "Membros, pendências e solicitações de cadastro",
      icone: "escolastica",
      secao: "Secretarias",
      pendentes: pedidosCadastro,
    },
    tem("economia") && {
      href: pedidosComposicao ? "/economia?aba=composicao" : "/economia",
      rotulo: "Economia",
      descricao: pedidosComposicao ? `${pedidosComposicao} pedido${pedidosComposicao === 1 ? "" : "s"} de contribuição aguardando` : "Contribuições, cobrança, contas e tesouraria",
      icone: "economia",
      secao: "Secretarias",
      pendentes: pedidosComposicao,
    },
    tem("eventos") && { href: "/voluntario/eventos", rotulo: "Eventos", descricao: "Gestão de eventos e calendário", icone: "eventos", secao: "Secretarias" },
    aberturas.length > 0 && { href: "/voluntario/aberturas", rotulo: "Abertura de turmas", descricao: "Planejamento, equipe, interessados e resultados", icone: "aberturas", secao: "Secretarias" },
    tem("cafe") && { href: "/voluntario/cafe", rotulo: "Café", descricao: "Caixa Fortuna", icone: "cafe", secao: "Secretarias" },
    (tem("direcao") || nacional || m.filiaisChefiadas.length > 0) && { href: "/voluntario/filial", rotulo: "Visão geral", descricao: nacional ? "Índices por área, da filial ao nacional" : "Índices da filial por área", icone: "direcao", secao: "Gestão da filial" },
    // Atendimentos individuais dos instrutores (pedido do usuário 2026-10-25): números para a Direção.
    (chefe || m.isSubChefe) && { href: "/escolastica/atendimentos", rotulo: "Atendimentos dos instrutores", descricao: "Quem abriu horários, mais livres, mais cheios", icone: "instrutor", secao: "Gestão da filial" },
    administra.length > 0 && { href: "/admin", rotulo: "Administração", descricao: "Recursos do Portal, administradores, senhas e liberar acessos", icone: "admin", secao: "Gestão da filial" },
    // Quem administra a filial libera acessos pela Administração (aba); responsáveis de grupo, por aqui.
    !(administra.length && (chefe || m.isSubChefe)) && (chefe || m.isSubChefe || lideraFV > 0) && { href: "/voluntario/acessos", rotulo: "Liberar acessos", descricao: "Quem vê a área de voluntários", icone: "acessos", secao: "Gestão da filial" },
    // Saúde do Portal (26/10/2026): rotinas agendadas e serviços externos.
    nacional && { href: "/admin/saude", rotulo: "Saúde do Portal", descricao: "Rotinas agendadas e serviços externos", icone: "admin", secao: "Nacional" },
  ];
  const lista = d.filter(Boolean) as Destino[];
  const nomes=new Map(mandatos.map(m=>[chaveSecretaria(m.secretaria),m.secretaria]));
  for(const nome of nomes.values()){const href=caminhoSecretaria(nome),base=href.split('?')[0];if(lista.some(d=>d.href.split('?')[0]===base))continue;
    lista.push({href,rotulo:nome,descricao:'Orientações e administração da secretaria',icone:'secretarias',secao:'Secretarias'});
  }

  // Só Início e Termo, sem grupos nem acesso: não é voluntário.
  const temFuncao = lista.length > 2 || temGrupo > 0 || acesso || fv || m.cargos.length > 0;
  return temFuncao ? lista : [];
}

/** Página de uma área da filial: só entra quem tem a área na própria filial; os outros voltam ao início. */
export async function exigirArea(area: AreaFilial, voltaPara: string) {
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?next=${voltaPara}`);
  if (!(await areasNaFilial(member, member.schoolId)).includes(area)) redirect("/voluntario");
  return member;
}
