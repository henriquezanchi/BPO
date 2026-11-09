import { db } from "@/lib/db";
import { consultarMercurio } from "@/lib/mercurio-db/client";
import { NOMES_DO_CATALOGO, sugerirSecretarias, type FuncaoMercurio } from "@/lib/secretarias";

/**
 * Secretarias da filial a partir das funções do Mercúrio, todo dia (pedido do usuário 09/11/2026: "ao liberar o
 * acesso, verifique qual é a área do voluntário e crie na escola"; ex.: responsável pela manutenção → secretaria
 * Técnica e Manutenção com ele como responsável). Usa o mesmo catálogo das sugestões da tela de Secretarias
 * (secretarias.ts), só com nomes do catálogo. Só acrescenta: não tira ninguém nem apaga secretaria (o que a direção mudou à mão fica); secretaria
 * arquivada pela direção não volta. Os grupos Feminino, Masculino e de Segurança já vêm do cadastro (importar.ts).
 */
export async function funcoesDaUnidade(uni: string): Promise<FuncaoMercurio[]> {
  const u = uni.replace(/[^A-Z0-9]/gi, "");
  return (await consultarMercurio(
    `SELECT d.dfn_matr matricula, d.dfn_funcao funcao, d.dfn_descricao descricao FROM dirigente_funcoes d JOIN cadastro c ON c.cad_matr=d.dfn_matr AND c.cad_situacao='ATI' WHERE d.dfn_atual='S' AND d.dfn_unidade='${u}'`,
  )) as unknown as FuncaoMercurio[];
}

export async function sincronizarSecretariasDaFilial(uni: string) {
  const escola = await db.school.findFirst({ where: { mercurioUnidade: uni }, select: { id: true } });
  if (!escola) return { criadas: 0, vinculos: 0 };
  const sugestoes = sugerirSecretarias(await funcoesDaUnidade(uni));
  const matriculas = [...new Set(sugestoes.flatMap((s) => [...s.responsaveis, ...s.equipe].map((f) => f.matricula)))];
  const pessoas = new Map(
    (await db.member.findMany({ where: { schoolId: escola.id, mercurioAtivo: true, mercurioId: { in: matriculas } }, select: { id: true, mercurioId: true } })).map((p) => [p.mercurioId!, p.id]),
  );
  const existentes = await db.classGroup.findMany({ where: { schoolId: escola.id, tipo: "SEC" }, select: { id: true, name: true, arquivadoEm: true } });
  const porNome = new Map(existentes.map((g) => [g.name.toLocaleLowerCase("pt-BR"), g]));

  let criadas = 0;
  let vinculos = 0;
  for (const s of sugestoes) {
    // Nome fora do catálogo (texto livre da função, ex. "Cgb"): fica só como sugestão na tela de Secretarias.
    if (!NOMES_DO_CATALOGO.has(s.nome)) continue;
    const resp = [...new Set(s.responsaveis.map((f) => pessoas.get(f.matricula)).filter((x): x is string => !!x))];
    const equipe = [...new Set(s.equipe.map((f) => pessoas.get(f.matricula)).filter((x): x is string => !!x && !resp.includes(x)))];
    if (!resp.length && !equipe.length) continue; // ninguém da secretaria no Portal: nada a criar
    let grupo = porNome.get(s.nome.toLocaleLowerCase("pt-BR"));
    if (grupo?.arquivadoEm) continue; // a direção arquivou: respeita
    if (!grupo) {
      grupo = await db.classGroup.create({ data: { schoolId: escola.id, tipo: "SEC", name: s.nome }, select: { id: true, name: true, arquivadoEm: true } });
      porNome.set(s.nome.toLocaleLowerCase("pt-BR"), grupo);
      criadas++;
    }
    const r = await db.classMembership.createMany({
      data: [...resp.map((memberId) => ({ classGroupId: grupo!.id, memberId, role: "professor" as const })), ...equipe.map((memberId) => ({ classGroupId: grupo!.id, memberId, role: "aluno" as const }))],
      skipDuplicates: true,
    });
    vinculos += r.count;
  }
  return { criadas, vinculos };
}
