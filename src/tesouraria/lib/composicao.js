// Composição das contribuições da filial (tela "EDITAR COMPOSIÇÃO DAS
// CONTRIBUIÇÕES", tes_concomp.php — prints reais com HTML do DevTools,
// 11/10/2026): lista TODOS os ativos com matrícula, nome, nível, turma e o
// valor da contribuição de cada um. Pedido do usuário: em vez de configurar
// valores por categoria (cada filial e cada perfil têm o seu), ler a lista
// real uma vez e usar para:
//   - saber o valor da contribuição de quem fez o Pix (avisar no
//     formulário quando o Pix é bem maior → recibo com vários itens);
//   - achar a matrícula pelo nome na hora, sem abrir o Mercúrio.
// A leitura em si fica em lerComposicaoContribuicoes() (mercurioTesouraria);
// aqui só o que não depende do navegador.

export function normalizarNome(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Partículas que não ajudam a distinguir nomes.
const PARTICULAS = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);

function palavras(texto) {
  return normalizarNome(texto).split(' ').filter((p) => p.length > 1 && !PARTICULAS.has(p));
}

// Procura um nome (ex: o remetente de um Pix, "Guilherme Almeida Galdeano")
// na lista de ativos. Nome igual vence; senão, aceita quando TODAS as
// palavras buscadas aparecem no nome cadastrado (exige ao menos 2 palavras,
// para "MARIA" sozinho não casar com metade da escola). Devolve a lista de
// candidatos — quem chama decide: 1 = achou, 2+ = ambíguo, 0 = não está.
export function procurarNaComposicao(alunos, nomeBuscado) {
  const alvo = normalizarNome(nomeBuscado);
  if (!alvo || !Array.isArray(alunos)) return [];
  const exatos = alunos.filter((a) => normalizarNome(a.nome) === alvo);
  if (exatos.length) return exatos;
  const buscadas = palavras(nomeBuscado);
  if (buscadas.length < 2) return [];
  return alunos.filter((a) => {
    const doNome = new Set(palavras(a.nome));
    return buscadas.every((p) => doNome.has(p));
  });
}
