import { ehAdministradorNacional, temAcessoVoluntario } from "@/lib/acesso-voluntario";
import { escolasQueGereAvaliacao } from "@/lib/avaliacao";
import { db } from "@/lib/db";
import { ehFV } from "@/lib/grupos-portal";
import { filiaisAdministradas } from "@/lib/recursos-filial";
import type { Member } from "@prisma/client";

/**
 * Área do Voluntário (pedido do usuário 2026-10-19: "uma forma mais simples
 * de encontrar as coisas — um portal só para o voluntário e o administrador,
 * mostrando só o que cada um pode ver"). Uma lista só de destinos, calculada
 * com as mesmas regras de cada tela; o menu e os atalhos usam esta lista.
 * Cada página continua reconferindo a permissão por conta própria.
 */
export type IconeDestino = "inicio" | "instrutor" | "grupos" | "escolastica" | "avaliacao" | "economia" | "direcao" | "admin" | "acessos" | "nacional" | "termo";

export type Destino = { href: string; rotulo: string; descricao: string; icone: IconeDestino; secao: "Meu trabalho" | "Gestão da filial" | "Nacional" };

type Pessoa = Pick<
  Member,
  "id" | "schoolId" | "isDiretor" | "isSubChefe" | "isPedagogo" | "isSecretarioEscolastica" | "isSecretarioEconomia" | "filiaisChefiadas" | "mercurioId" | "mercurioAtivo" | "isMembroPrograma" | "cargos"
>;

export async function destinosDaPessoa(m: Pessoa): Promise<Destino[]> {
  const [acesso, fv, nacional, administra, avaliacao, lideraFV, temGrupo] = await Promise.all([
    temAcessoVoluntario(m),
    ehFV(m.id),
    ehAdministradorNacional(m),
    filiaisAdministradas(m),
    escolasQueGereAvaliacao(m),
    db.classMembership.count({ where: { memberId: m.id, role: "professor", classGroup: { tipo: { in: ["BF", "BM", "CS"] } } } }),
    // GAF não faz de ninguém voluntário (alunos participam).
    db.classMembership.count({ where: { memberId: m.id, classGroup: { tipo: { in: ["GDVE", "SEC", "BF", "BM", "CS"] }, arquivadoEm: null } } }),
  ]);
  const chefe = m.isDiretor || m.filiaisChefiadas.length > 0 || nacional;
  const direcao = m.isDiretor || m.isSubChefe;
  const d: (Destino | false)[] = [
    { href: "/voluntario", rotulo: "Início", descricao: "Seus grupos, secretarias e encontros", icone: "inicio", secao: "Meu trabalho" },
    (m.isPedagogo || lideraFV > 0) && {
      href: "/professor",
      rotulo: m.isPedagogo ? "Instrutor" : "Avisos dos grupos",
      descricao: m.isPedagogo ? "Turmas, atividades e enquetes" : "Avisos e atividades dos grupos de FV",
      icone: "instrutor",
      secao: "Meu trabalho",
    },
    (m.isSecretarioEscolastica || direcao) && { href: "/escolastica", rotulo: "Escolástica", descricao: "Agenda de pendências", icone: "escolastica", secao: "Meu trabalho" },
    avaliacao.length > 0 && { href: "/escolastica/avaliacao", rotulo: "Avaliação dos instrutores", descricao: "Questionário, rodadas e relatórios", icone: "avaliacao", secao: "Meu trabalho" },
    (m.isSecretarioEconomia || direcao) && { href: "/economia", rotulo: "Economia", descricao: "Composição da contribuição e tesouraria", icone: "economia", secao: "Meu trabalho" },
    { href: "/voluntario/termo", rotulo: "Termo de voluntariado", descricao: "Assinatura do termo", icone: "termo", secao: "Meu trabalho" },
    direcao && { href: "/diretor", rotulo: "Painel da Direção", descricao: "Visão geral, membros, eventos e finanças", icone: "direcao", secao: "Gestão da filial" },
    administra.length > 0 && { href: "/admin", rotulo: "Administração", descricao: "Secretarias, GAF, recursos e senhas", icone: "admin", secao: "Gestão da filial" },
    (chefe || lideraFV > 0) && { href: "/voluntario/acessos", rotulo: "Liberar acessos", descricao: "Quem vê a área de voluntários", icone: "acessos", secao: "Gestão da filial" },
    nacional && { href: "/nacional", rotulo: "Painel Nacional", descricao: "Toda a OINAB-N", icone: "nacional", secao: "Nacional" },
  ];
  const lista = d.filter(Boolean) as Destino[];
  // Sem nada além do termo e do início, e sem grupos nem acesso: não é voluntário.
  const temFuncao = lista.length > 2 || temGrupo > 0 || acesso || fv || m.cargos.length > 0;
  return temFuncao ? lista : [];
}
