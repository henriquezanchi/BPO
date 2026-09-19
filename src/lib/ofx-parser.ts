/**
 * Parser mínimo de extrato OFX (formato SGML "tag aberta sem fechar" da
 * v1.x, o mais comum em banco brasileiro, mas tolera v2.x/XML também —
 * extraímos por regex em vez de exigir um parser XML de verdade). Só
 * extrai o que precisamos: as transações (STMTTRN), sem validar o resto
 * do arquivo (cabeçalho SGML, agregados de saldo etc).
 */
export interface OfxTransacao {
  fitId: string;
  data: Date;
  valor: number; // negativo = débito (saída), positivo = crédito (entrada) — mesma convenção do OFX
  descricao: string;
}

function extrairTag(bloco: string, tag: string): string | undefined {
  const m = bloco.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"));
  return m?.[1]?.trim();
}

function parseDataOfx(raw: string): Date | null {
  // "YYYYMMDD" ou "YYYYMMDDHHMMSS[.mmm][+-TZ]" — só os 8 primeiros dígitos importam pra nós.
  const digitos = raw.slice(0, 8);
  if (!/^\d{8}$/.test(digitos)) return null;
  const ano = Number(digitos.slice(0, 4));
  const mes = Number(digitos.slice(4, 6));
  const dia = Number(digitos.slice(6, 8));
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Só as transações de DÉBITO (valor negativo no extrato) — decisão explícita do usuário: crédito/conciliação com Mercúrio fica pra depois. */
export function parseOfxDebitos(conteudo: string): OfxTransacao[] {
  const blocos = conteudo.split(/<STMTTRN>/i).slice(1);
  const transacoes: OfxTransacao[] = [];

  for (const bloco of blocos) {
    const valorRaw = extrairTag(bloco, "TRNAMT");
    const dataRaw = extrairTag(bloco, "DTPOSTED");
    const fitId = extrairTag(bloco, "FITID");
    if (!valorRaw || !dataRaw || !fitId) continue;

    const valor = Number(valorRaw.replace(",", "."));
    if (!Number.isFinite(valor) || valor >= 0) continue; // só débito

    const data = parseDataOfx(dataRaw);
    if (!data) continue;

    const descricao = extrairTag(bloco, "MEMO") || extrairTag(bloco, "NAME") || "Lançamento do extrato";
    transacoes.push({ fitId, data, valor, descricao: descricao.trim() });
  }

  return transacoes;
}
