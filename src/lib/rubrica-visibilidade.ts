/**
 * Quais rubricas do catálogo de composição cada membro pode VER/incluir —
 * pedido do usuário 2026-10-08, a partir do mapeamento real que ele deu
 * (rubrica → grupo que pode usá-la). Regras não cobertas aqui (ex:
 * "CONTRIBUIÇÃO CURSO DE FILOSOFIA" só pra Alunos, e o grupo "FV pra cima"
 * — CC Filial/Nacional, DD Filial, CG Filial/Nacional, Conselho Filial)
 * ficam de fora de propósito: ainda não temos no Mercúrio um sinal
 * confiável de "é Aluno" nem de "é FV/Machado" (ver conversa sobre a view do
 * João Guilherme) — melhor não restringir do que restringir errado. Essas
 * continuam visíveis pra todo mundo até existir esse dado.
 */

type MembroComGrupos = {
  isCirculoDeAmigos: boolean;
  isMembroPrograma: boolean;
  isCorrentinha: boolean;
  isTavolas: boolean;
  isJanos: boolean;
  isDiretor: boolean;
  isSubChefe: boolean;
};

interface RegraRubrica {
  labelRegex: RegExp;
  permitido: (m: MembroComGrupos) => boolean;
}

const REGRAS: RegraRubrica[] = [
  { labelRegex: /c[íi]rculo de amigos/i, permitido: (m) => m.isCirculoDeAmigos },
  // "AP" (ex: "CONTRIBUIÇÃO MEMBRO AP", "CONTRIBUIÇÃO JANOS AP") é a mesma
  // regra de acesso, só que também dá direito à AcrópolePlay (confirmado
  // pelo usuário 2026-10-08) — trata igual ao grupo base.
  { labelRegex: /^contribui[cç][ãa]o membro( ap)?$/i, permitido: (m) => m.isMembroPrograma },
  { labelRegex: /correntinha/i, permitido: (m) => m.isCorrentinha },
  { labelRegex: /t[áa]volas/i, permitido: (m) => m.isTavolas },
  { labelRegex: /^contribui[cç][ãa]o janos( ap)?$/i, permitido: (m) => m.isJanos },
  { labelRegex: /dirigente/i, permitido: (m) => m.isDiretor || m.isSubChefe },
];

/** Sem regra batendo = sem restrição (rubricas "Todos" ou eventuais/dependentes de oferta). */
export function rubricaVisivelPara(label: string, member: MembroComGrupos): boolean {
  const regra = REGRAS.find((r) => r.labelRegex.test(label));
  return regra ? regra.permitido(member) : true;
}

/** Rubricas que o próprio membro pode incluir pelo Portal (pedido do usuário 2026-10-25); as demais, só pela secretaria. */
const INCLUIVEIS_PELO_MEMBRO = /^(contribui[cç][ãa]o biblioteca|doa[cç][ãa]o crian[cç]a para o bem mensal|contribui[cç][ãa]o voluntariado|doa[cç][ãa]o mensal de membro\/provacionista)$/i;

export function rubricaIncluivelPeloMembro(label: string): boolean {
  return INCLUIVEIS_PELO_MEMBRO.test(label.trim().replace(/\s+/g, " "));
}
