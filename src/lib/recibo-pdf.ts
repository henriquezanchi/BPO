import jsPDF from "jspdf";

/**
 * PDF de verdade (não só a caixa de diálogo de impressão do navegador) —
 * pedido do usuário 2026-09-30. Mantém o texto cru exatamente como veio do
 * Mercúrio (fonte monoespaçada, sem tentar reformatar) — é um comprovante
 * financeiro oficial, arriscado reinterpretar o layout dele. Usado tanto no
 * navegador (Baixar PDF) quanto, no futuro, no servidor (anexo do envio por e-mail — ver docs/PENDENCIAS.md).
 */
export function gerarPdfRecibo(rawText: string): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  const margin = 40;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineHeight = 12;

  const linhas = doc.splitTextToSize(rawText, maxWidth);
  let y = margin;
  for (const linha of linhas) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(linha, margin, y);
    y += lineHeight;
  }
  return doc;
}
