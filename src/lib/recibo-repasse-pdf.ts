import jsPDF from "jspdf";

/**
 * Recibo de doação do repasse (pedido do usuário 24/11/2026): quando a escola pede o repasse do que a conta titular
 * (Barra do Garças) recebeu em nome dela, sai um recibo com valores, data e dados das duas escolas, para o diretor da
 * escola que recebe imprimir e assinar (ou assinar no gov.br) e mandar à escola titular, que precisa dele na
 * contabilidade. Gerado no navegador (jsPDF) a partir dos dados do servidor (lib/repasses.ts → dadosDoRecibo).
 */
export type DadosRecibo = {
  numero: string;
  data: string; // ISO
  valor: number;
  tarifa: number;
  chavePix: string;
  tipoChave: string;
  transferId: string | null;
  status: string;
  cobrancas: { quantidade: number; de: string | null; ate: string | null; bruto: number };
  titular: Escola;
  escola: Escola;
};
type Escola = { nome: string; cnpj: string | null; endereco: string | null; cidade: string | null; uf: string | null; diretor: string | null };

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), d = Math.floor((n % 100) / 10), u = n % 10;
  const partes = [c ? CENTENAS[c] : "", n % 100 < 20 ? UNIDADES[n % 100] : [DEZENAS[d], u ? UNIDADES[u] : ""].filter(Boolean).join(" e ")].filter(Boolean);
  return partes.join(" e ");
}
/** Valor por extenso em reais (até 999 milhões). */
export function porExtenso(valor: number): string {
  const reais = Math.floor(valor + 1e-9), centavos = Math.round((valor - reais) * 100);
  const milhoes = Math.floor(reais / 1e6), milhares = Math.floor((reais % 1e6) / 1000), resto = reais % 1000;
  const partes: string[] = [];
  if (milhoes) partes.push(`${ate999(milhoes)} ${milhoes === 1 ? "milhão" : "milhões"}`);
  if (milhares) partes.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
  if (resto) partes.push(ate999(resto));
  let texto = partes.join(partes.length > 1 && resto && resto < 100 ? " e " : ", ").replace(/, ([^,]*)$/, " e $1");
  if (reais) texto += reais === 1 ? " real" : /milh(ão|ões)$/.test(texto) ? " de reais" : " reais";
  if (centavos) texto += `${reais ? " e " : ""}${ate999(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  return texto || "zero reais";
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataLonga = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" });
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const cnpjFmt = (c: string | null) => (c && /^\d{14}$/.test(c.replace(/\D/g, "")) ? c.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : c ?? "—");
const linhaEscola = (e: Escola) => [e.nome, e.cnpj ? `CNPJ ${cnpjFmt(e.cnpj)}` : null, e.endereco, [e.cidade, e.uf].filter(Boolean).join(" - ") || null].filter(Boolean).join(" · ");

export function gerarReciboDeRepasse(d: DadosRecibo): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const L = 56, W = doc.internal.pageSize.getWidth() - 2 * L;
  let y = 64;
  const texto = (t: string, tam = 11, estilo: "normal" | "bold" = "normal", espaco = 1.45) => {
    doc.setFont("helvetica", estilo); doc.setFontSize(tam);
    const linhas = doc.splitTextToSize(t, W) as string[];
    for (const l of linhas) { doc.text(l, L, y); y += tam * espaco; }
  };
  const pular = (n = 10) => { y += n; };

  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("RECIBO DE DOAÇÃO", L, y); y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90);
  doc.text(`Nº ${d.numero} · ${d.status === "concluido" ? "transferência concluída" : "transferência em andamento"}`, L, y); y += 8;
  doc.setTextColor(0);
  doc.setDrawColor(0, 102, 85); doc.setLineWidth(1.2); doc.line(L, y + 6, L + W, y + 6); y += 26;

  texto("DOADORA (titular da conta de recebimento)", 9, "bold", 1.3);
  texto(linhaEscola(d.titular), 11); pular();
  texto("DONATÁRIA (escola que recebe o repasse)", 9, "bold", 1.3);
  texto(linhaEscola(d.escola), 11); pular(16);

  texto(
    `${d.titular.nome} transferiu a ${d.escola.nome}, por Pix (chave ${d.tipoChave.toLowerCase()} ${d.chavePix}), em ${dataLonga(d.data)}, a importância de ${brl(d.valor)} (${porExtenso(d.valor)}), a título de doação.`,
    11.5,
  );
  pular(4);
  texto(
    `O valor corresponde ao líquido recebido pela conta de ${d.titular.nome} no Asaas em nome de ${d.escola.nome}, pelo Portal Nova Acrópole${d.cobrancas.quantidade ? `: ${d.cobrancas.quantidade} ${d.cobrancas.quantidade === 1 ? "recebimento" : "recebimentos"}${d.cobrancas.de ? ` entre ${dataCurta(d.cobrancas.de)} e ${dataCurta(d.cobrancas.ate ?? d.cobrancas.de)}` : ""}, total bruto ${brl(d.cobrancas.bruto)}` : ""}${d.tarifa ? `; tarifa da transferência ${brl(d.tarifa)}` : ""}.${d.transferId ? ` Comprovante Asaas nº ${d.transferId}.` : ""}`,
    11,
  );
  pular(18);

  texto(`${[d.escola.cidade, d.escola.uf].filter(Boolean).join(" - ") || "____________________"}, ${dataLonga(d.data)}.`, 11);
  pular(44);

  const assinatura = (rotulo: string, nome: string | null, x: number, larg: number) => {
    doc.setDrawColor(0); doc.setLineWidth(0.6); doc.line(x, y, x + larg, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(nome ?? "Nome: ______________________", x, y + 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(rotulo, x, y + 27);
  };
  const metade = (W - 24) / 2;
  assinatura(`Diretor(a) · ${d.escola.nome}`, d.escola.diretor, L, metade);
  assinatura(`Diretor(a) · ${d.titular.nome}`, d.titular.diretor, L + metade + 24, metade);
  y += 56;

  doc.setFontSize(8.5); doc.setTextColor(90);
  texto("Como assinar: imprima e assine, ou assine este PDF digitalmente em assinador.iti.br (gov.br) e envie à escola titular da conta, que guarda o recibo na contabilidade. Gerado pelo Portal Nova Acrópole.", 8.5, "normal", 1.35);
  doc.setTextColor(0);
  return doc;
}
