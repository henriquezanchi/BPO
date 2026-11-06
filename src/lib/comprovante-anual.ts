import { consultarMercurio, sqlNumero } from "@/lib/mercurio-db/client";

export type LinhaComprovante = { recibo: string; data: string; descricao: string; referencia: string | null; valor: number };

/**
 * Comprovante anual de contribuições (pedido do usuário 06/11/2026): os recibos que a escola emitiu em nome da pessoa no
 * ano (data do recibo), lidos ao vivo do Mercúrio (`reciboc`/`reciboi` são views online). Cancelados ficam de fora, com
 * a mesma regra de importar.ts. Uma linha por item do recibo.
 */
export async function lerComprovanteAnual(matricula: string, ano: number): Promise<{ linhas: LinhaComprovante[]; total: number }> {
  const linhas = await consultarMercurio(
    `SELECT r.rec_id, r.rec_data, r.rec_status, r.rec_data_cancel, i.rei_item, i.rei_ano, i.rei_mes, i.rei_valtotal, p.pro_descricao FROM reciboc r JOIN reciboi i ON i.rei_id=r.rec_id LEFT JOIN produtos p ON p.pro_cod=i.rei_produto WHERE i.rei_matr=${sqlNumero(matricula)} AND r.rec_data >= '${ano}-01-01' AND r.rec_data < '${ano + 1}-01-01' ORDER BY r.rec_data, r.rec_id, i.rei_item`,
  );
  const validas = linhas
    .filter((l) => l.rec_status !== "CAN" && !(l.rec_data_cancel && l.rec_data_cancel >= "1900-01-01"))
    .map((l) => ({
      recibo: l.rec_id ?? "",
      data: (l.rec_data ?? "").slice(0, 10),
      descricao: (l.pro_descricao ?? "Contribuição").trim(),
      referencia: Number(l.rei_mes) >= 1 && Number(l.rei_mes) <= 12 && Number(l.rei_ano) > 1900 ? `${String(l.rei_mes).padStart(2, "0")}/${l.rei_ano}` : null,
      valor: Number(l.rei_valtotal ?? 0),
    }))
    .filter((l) => l.valor > 0);
  return { linhas: validas, total: Math.round(validas.reduce((s, l) => s + l.valor, 0) * 100) / 100 };
}
