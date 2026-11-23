/**
 * Filtro das alterações de cadastro feitas pelo próprio membro (pedido do usuário 23/11/2026). Desde então a alteração
 * vale na hora, sem a Escolástica; o filtro barra o que claramente não é dado de cadastro: digitação acidental (celular
 * desbloqueado no bolso), mensagem que era para o WhatsApp, link, telefone ou e-mail impossível. Barrou → recusa na hora
 * com o motivo (decisão do usuário), e nada é gravado. Sem acesso ao banco.
 */
export type ResultadoFiltro = { ok: true } | { ok: false; erros: Record<string, string> };

const NOMES: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  addressStreet: "Rua",
  addressNumber: "Número",
  addressComplement: "Complemento",
  addressNeighborhood: "Bairro",
  addressCity: "Cidade",
  addressState: "Estado",
  addressZip: "CEP",
  naturalidade: "Naturalidade",
  profession: "Profissão",
  estadoCivil: "Estado civil",
  escolaridade: "Escolaridade",
  rgNumero: "RG",
  rgOrgaoEmissor: "Órgão emissor",
  birthDate: "Data de nascimento",
  rgDataEmissao: "Data de emissão do RG",
};
export const nomeDoCampo = (c: string) => NOMES[c] ?? c;

const UFS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
const TAMANHO: Record<string, number> = { addressStreet: 120, addressNumber: 12, addressComplement: 60, addressNeighborhood: 60, addressCity: 60, naturalidade: 60, profession: 80, estadoCivil: 30, escolaridade: 60, rgNumero: 20, rgOrgaoEmissor: 20 };
const DOMINIOS_ERRADOS: Record<string, string> = {
  "gmail.con": "gmail.com", "gmail.co": "gmail.com", "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmail.com.br": "gmail.com",
  "hotmail.con": "hotmail.com", "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com",
  "yahoo.con": "yahoo.com", "yaho.com": "yahoo.com", "outlok.com": "outlook.com", "outlook.con": "outlook.com", "icloud.con": "icloud.com",
};

/** Texto que parece conversa, e não um dado de cadastro. */
const CONVERSA = /\b(oi+|ol[aá]|bom dia|boa tarde|boa noite|tudo bem|tudo bom|obrigad[oa]|por favor|pfv|blz|beleza|kkk+|rsrs|hahaha|te amo|cad[eê]|vou|vamos|chego|chegando|estou|t[oô] indo|me liga|liga pra|amanh[ãa]|hoje [àa]s)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const LINK = /(https?:\/\/|www\.|\.com\b|\.br\b)/i;

/** Sequência que só sai digitando sem querer: muitas letras repetidas, consoantes demais seguidas, quase nenhuma vogal. */
function pareceAcidental(t: string) {
  const s = t.toLowerCase().replace(/\s+/g, "");
  if (/(.)\1{4,}/.test(s)) return true;
  if (/[bcdfghjklmnpqrstvwxz]{6,}/.test(s.normalize("NFD").replace(/[̀-ͯ]/g, ""))) return true;
  const letras = s.replace(/[^a-zà-ú]/g, "");
  if (letras.length >= 6) {
    const vogais = letras.replace(/[^aeiouà-ú]/g, "").length;
    if (vogais / letras.length < 0.15) return true;
  }
  return false;
}

function conferirTexto(campo: string, v: string): string | null {
  const max = TAMANHO[campo] ?? 80;
  if (v.length > max) return `muito longo (até ${max} caracteres)`;
  if (EMOJI.test(v)) return "tem emoji: parece mensagem, não dado de cadastro";
  if (LINK.test(v) && campo !== "email") return "tem link ou endereço de site";
  if (/[?!]{1,}/.test(v) && campo !== "addressComplement") return "parece uma mensagem (tem ? ou !)";
  if (CONVERSA.test(v)) return "parece uma mensagem de conversa, não dado de cadastro";
  if (pareceAcidental(v)) return "parece digitado sem querer";
  if (/\n/.test(v)) return "tem quebra de linha";
  return null;
}

export function conferirCampo(campo: string, bruto: string | null): string | null {
  const v = (bruto ?? "").trim();
  if (!v) return campo === "whatsapp" || campo === "email" ? "não pode ficar vazio" : null;
  switch (campo) {
    case "whatsapp": {
      const d = v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      if (/[a-z]/i.test(v)) return "use só números (com DDD)";
      if (d.length !== 10 && d.length !== 11) return "precisa ter DDD + número (10 ou 11 dígitos)";
      if (Number(d.slice(0, 2)) < 11 || d[2] === "0") return "DDD inválido";
      if (d.length === 11 && d[2] !== "9") return "celular com 11 dígitos começa com 9 depois do DDD";
      if (/^(\d)\1+$/.test(d.slice(2)) || "0123456789".includes(d.slice(2, 9))) return "número inválido";
      return null;
    }
    case "email": {
      if (/\s/.test(v)) return "não pode ter espaço";
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}(\.[a-z]{2,})?$/i.test(v)) return "formato inválido (ex.: nome@gmail.com)";
      const dominio = v.split("@")[1].toLowerCase();
      if (DOMINIOS_ERRADOS[dominio]) return `confira o final: não seria @${DOMINIOS_ERRADOS[dominio]}?`;
      return null;
    }
    case "addressZip":
      return v.replace(/\D/g, "").length === 8 && !/[a-z]/i.test(v) ? null : "CEP com 8 números";
    case "addressState":
      return UFS.has(v.toUpperCase()) ? null : "use a sigla do estado (ex.: GO)";
    case "addressNumber":
      return /^(\d{1,6}[a-z]?|s\/?n|sn|km ?\d+)$/i.test(v.replace(/\s+/g, " ")) ? null : "use só o número (ou S/N)";
    case "rgNumero":
      return /^[0-9xX.\- ]{4,20}$/.test(v) ? null : "use só números (pode ter X, ponto e traço)";
    case "birthDate":
    case "rgDataEmissao": {
      const d = new Date(`${v}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return "data inválida";
      const ano = d.getUTCFullYear();
      if (ano < 1900 || d.getTime() > Date.now()) return "data fora do possível";
      return null;
    }
    default:
      return conferirTexto(campo, v);
  }
}

/** Confere todas as alterações; o que não for campo conhecido é recusado. */
export function conferirAlteracao(novos: Record<string, string | null>): ResultadoFiltro {
  const erros: Record<string, string> = {};
  for (const [campo, valor] of Object.entries(novos)) {
    if (!NOMES[campo]) {
      erros[campo] = "campo desconhecido";
      continue;
    }
    const e = conferirCampo(campo, valor);
    if (e) erros[campo] = e;
  }
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true };
}

/** Mensagem única para mostrar ao membro. */
export const mensagemDoFiltro = (erros: Record<string, string>) =>
  `Não salvamos: ${Object.entries(erros).map(([c, e]) => `${nomeDoCampo(c)} ${e}`).join("; ")}. Corrija e tente de novo.`;
