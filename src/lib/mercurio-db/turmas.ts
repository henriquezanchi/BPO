/**
 * Turma oficial → código que os alunos têm no cadastro, quando o código dos alunos não existe no cadastro de turmas e
 * só uma turma da unidade é esse código seguido de números ("XESOTRIS" → "XESOTRIS1"). Mais de uma candidata: não
 * adivinha.
 */
export function apelidosDeTurma(codigosDosAlunos: string[], turmasOficiais: string[]): Map<string, string> {
  const apelidos = new Map<string, string>();
  for (const codigo of codigosDosAlunos) {
    const candidatas = turmasOficiais.filter((t) => t.length > codigo.length && t.startsWith(codigo) && /^\d+$/.test(t.slice(codigo.length)));
    if (candidatas.length === 1 && !apelidos.has(candidatas[0])) apelidos.set(candidatas[0], codigo);
  }
  return apelidos;
}
