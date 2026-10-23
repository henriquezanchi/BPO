import { ehAdministradorNacional, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { areasNaFilial, type AreaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { escolasAberturas } from "@/lib/aberturas/permissoes";
import { ehFV } from "@/lib/grupos-portal";
import { filiaisAdministradas } from "@/lib/recursos-filial";
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
  | "secretarias";

export type Destino = { href: string; rotulo: string; descricao: string; icone: IconeDestino; secao: "Meu trabalho" | "Secretarias" | "Gestão da filial" | "Nacional"; pendentes?: number };

type Pessoa = Pick<
  Member,
  "id" | "schoolId" | "isDiretor" | "isSubChefe" | "isPedagogo" | "isSecretarioEscolastica" | "isSecretarioEconomia" | "filiaisChefiadas" | "mercurioId" | "mercurioAtivo" | "isMembroPrograma" | "cargos"
>;

export async function destinosDaPessoa(m: Pessoa): Promise<Destino[]> {
  const [acesso, fv, nacional, administra, lideraFV, temGrupo, areas, aberturas, mandatos] = await Promise.all([
    temAcessoVoluntario(m),
    ehFV(m.id),
    ehAdministradorNacional(m),
    filiaisAdministradas(m),
    db.classMembership.count({ where: { memberId: m.id, role: "professor", classGroup: { tipo: { in: ["BF", "BM", "CS"] } } } }),
    // GAF não faz de ninguém voluntário (alunos participam).
    db.classMembership.count({ where: { memberId: m.id, classGroup: { tipo: { in: ["GDVE", "SEC", "BF", "BM", "CS"] }, arquivadoEm: null } } }),
    areasNaFilial(m, m.schoolId),
    escolasAberturas(m as Member),
    db.secretariaMandato.count({where:{memberId:m.id,ativo:true}}),
  ]);
  const chefe = m.isDiretor || m.filiaisChefiadas.length > 0 || nacional;
  const tem = (a: AreaFilial) => areas.includes(a);
  // Pedidos aguardando quem tem a área (pedido do usuário 2026-10-19): alterações de cadastro (Escolástica)
  // e pedidos de diminuir/remover itens da contribuição (Economia).
  const [pedidosCadastro, pedidosComposicao] = await Promise.all([
    tem("escolastica") ? db.contactChangeLog.count({ where: { status: "pendente", member: { schoolId: m.schoolId } } }) : 0,
    tem("economia") ? db.compositionChangeRequest.count({ where: { status: "pendente", member: { schoolId: m.schoolId } } }) : 0,
  ]);
  const d: (Destino | false)[] = [
    { href: "/voluntario", rotulo: "Início", descricao: "Seus grupos, secretarias e encontros", icone: "inicio", secao: "Meu trabalho" },
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
    { href: "/voluntario/termo", rotulo: "Termo de voluntariado", descricao: "Assinatura do termo", icone: "termo", secao: "Meu trabalho" },
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
    (chefe || temGrupo > 0 || mandatos > 0) && { href: "/voluntario/secretarias", rotulo: "Rede de secretarias", descricao: "Materiais, avisos, reuniões e planos", icone: "secretarias", secao: "Secretarias" },
    tem("cafe") && { href: "/voluntario/cafe", rotulo: "Café", descricao: "Caixa Fortuna", icone: "cafe", secao: "Secretarias" },
    tem("direcao") && { href: "/voluntario/filial", rotulo: "Visão da filial", descricao: "Resumo da filial e de cada área", icone: "direcao", secao: "Gestão da filial" },
    administra.length > 0 && { href: "/admin", rotulo: "Administração", descricao: "Secretarias, GAF, recursos e senhas", icone: "admin", secao: "Gestão da filial" },
    (chefe || lideraFV > 0) && { href: "/voluntario/acessos", rotulo: "Liberar acessos", descricao: "Quem vê a área de voluntários", icone: "acessos", secao: "Gestão da filial" },
    nacional && { href: "/nacional", rotulo: "Painel Nacional", descricao: "Toda a OINAB-N", icone: "nacional", secao: "Nacional" },
  ];
  const lista = d.filter(Boolean) as Destino[];
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
