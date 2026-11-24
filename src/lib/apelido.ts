import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * "Como gosta de ser chamado" (pedido do usuário 24/11/2026): apelido ou nome de preferência, usado nas saudações do
 * Portal e na chamada do autoatendimento do Fortuna (ex.: "Zanchi" em vez de "Luiz Henrique"). Duas barreiras:
 * regras locais (formato e lista de termos) e, quando há chave da Anthropic, uma revisão por IA que barra nomes
 * jocosos, palavrões, títulos, brincadeiras e tentativas de se passar por outra pessoa. Sem chave, valem só as regras.
 */
export const APELIDO_MAX = 30;

const PROIBIDOS = [
  // palavrões e ofensas (normalizados: sem acento, minúsculas)
  "puta", "puto", "caralho", "porra", "merda", "bosta", "cu", "buceta", "boceta", "piroca", "rola", "pau", "foda", "foder", "fodido", "viado", "veado", "bicha", "sapatao",
  "corno", "vagabund", "vadia", "safad", "piranha", "arromb", "fdp", "filho da puta", "desgraca", "otario", "idiota", "imbecil", "burro", "retardad", "babaca", "escroto", "cuzao", "pinto", "xota", "xoxota",
  "trouxa", "palhaco", "macaco", "preto", "negao", "crioulo", "gordo", "gorda", "baleia", "anao", "nazi", "hitler", "satan", "diabo", "demonio", "capeta",
  // títulos e papéis que não são nome
  "mestre", "doutor", "dr", "dra", "professor", "prof", "diretor", "diretora", "presidente", "rei", "rainha", "principe", "princesa", "deus", "deusa", "senhor", "senhora",
  "chefe", "patrao", "lider", "guru", "sensei", "capitao", "general", "coronel", "sargento", "pastor", "padre", "bispo", "papa", "santo", "santa",
  "admin", "administrador", "sistema", "portal", "nova acropole", "acropole", "suporte", "teste", "null", "undefined",
  // brincadeiras comuns
  "fulano", "ciclano", "beltrano", "ninguem", "alguem", "zezinho", "batman", "bolsonaro", "lula", "jesus", "cristo", "buda", "pikachu", "goku", "naruto",
];

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/** Regras locais; `null` = passou. */
export function regrasDoApelido(apelido: string, nomeCompleto: string): string | null {
  const a = apelido.trim();
  if (!a) return null;
  if (a.length < 2) return "Muito curto.";
  if (a.length > APELIDO_MAX) return `No máximo ${APELIDO_MAX} letras.`;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/.test(a)) return "Use só letras, sem números ou símbolos.";
  if (a.split(/\s+/).length > 3) return "No máximo 3 palavras.";
  if (/(.)\1\1/i.test(a)) return "Letras repetidas demais.";
  if (!/[aeiouyàáâãéêíóôõúü]/i.test(a)) return "Isso não parece um nome.";
  const n = normalizar(a);
  const palavras = n.split(" ");
  for (const p of PROIBIDOS) {
    if (p.includes(" ") ? n.includes(p) : palavras.some((w) => w === p || (p.length >= 5 && w.startsWith(p)))) return "Esse apelido não pode ser usado. Escolha um nome pelo qual as pessoas te conhecem.";
  }
  if (normalizar(nomeCompleto) === n) return "É o seu nome completo; escolha a forma curta pela qual te chamam.";
  return null;
}

const Veredito = z.object({ aceitavel: z.boolean(), motivo: z.string() });

/**
 * Revisão por IA (claude-haiku-5-5, saída estruturada). Aceita apelidos comuns, diminutivos, sobrenomes, nomes do
 * meio e nomes sociais; barra o resto. Em falha da API, não bloqueia (as regras locais já passaram).
 */
export async function revisarApelidoPorIA(apelido: string, nomeCompleto: string): Promise<{ aceitavel: boolean; motivo: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { aceitavel: true, motivo: "" };
  try {
    const cliente = new Anthropic();
    const r = await cliente.messages.parse({
      model: "claude-haiku-5-5",
      max_tokens: 600,
      output_config: { format: zodOutputFormat(Veredito) },
      messages: [
        {
          role: "user",
          content: `Você modera o campo "como gosta de ser chamado" do portal de uma escola de filosofia para adultos (Nova Acrópole, Brasil). O apelido aparece nas saudações do portal e é dito em voz alta na lanchonete quando o pedido fica pronto, na frente de todos.

Nome completo cadastrado: "${nomeCompleto}"
Apelido pedido: "${apelido}"

Aceite quando for uma forma legítima de chamar a pessoa: primeiro nome, nome do meio, sobrenome, diminutivo ou variação (Zé, Dudu, Bia, Zanchi, Pedrinho), nome social, apelido respeitoso e usual, nome em outra língua. Não exija relação com o nome cadastrado: muitos apelidos não têm.
Recuse quando for: palavrão, termo ofensivo ou pejorativo (inclusive disfarçado com letras trocadas), piada ou brincadeira, título ou cargo (Mestre, Doutor, Rei, Diretor), nome de personagem, celebridade ou político, marca, frase ou slogan, tentativa de se passar por outra pessoa ou pela instituição, ou algo que cause constrangimento quando dito em voz alta.
Na dúvida entre um apelido incomum mas inofensivo e uma brincadeira, aceite.
Responda com aceitavel (true/false) e motivo: uma frase curta (até 20 palavras) em português, dirigida à pessoa, só quando recusar; vazio quando aceitar.`,
        },
      ],
    });
    const v = r.parsed_output;
    return v ? { aceitavel: v.aceitavel, motivo: v.motivo } : { aceitavel: true, motivo: "" };
  } catch (e) {
    console.error("[apelido] revisão por IA falhou:", (e as Error).message.slice(0, 200));
    return { aceitavel: true, motivo: "" };
  }
}

/** Validação completa. Retorna o apelido limpo (ou null para apagar) ou lança com a mensagem para a pessoa. */
export async function validarApelido(apelido: string, nomeCompleto: string): Promise<string | null> {
  const a = apelido.replace(/\s+/g, " ").trim();
  if (!a) return null;
  const regra = regrasDoApelido(a, nomeCompleto);
  if (regra) throw new Error(regra);
  const ia = await revisarApelidoPorIA(a, nomeCompleto);
  if (!ia.aceitavel) throw new Error(ia.motivo || "Esse apelido não pode ser usado. Escolha um nome pelo qual as pessoas te conhecem.");
  return a;
}

/** Nome para chamar a pessoa: apelido ou primeiro nome. */
export const nomeDeChamada = (m: { name: string; apelido?: string | null }) => (m.apelido?.trim() || m.name.trim().split(/\s+/)[0]);
