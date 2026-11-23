import { BotaoImprimir } from "@/components/economia/botao-imprimir";
import { exigirArea } from "@/lib/area-trabalho";
import { fortunaProdutosDoCaixa } from "@/lib/fortuna/client";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

const PORTAL = process.env.PORTAL_URL || "https://portal-na-one.vercel.app";

/**
 * Cartaz do autoatendimento da lanchonete (23/11/2026): QR que abre /cafe?caixa=<id do caixa no Fortuna>. A área do Café
 * informa o número do caixa (o mesmo do Fortuna); quando as rotas novas do Fortuna estiverem no ar, o nome do caixa
 * aparece sozinho.
 */
export default async function QrCafePage(props: { searchParams: Promise<{ caixa?: string }> }) {
  await exigirArea("cafe", "/voluntario/cafe/qr");
  const { caixa } = await props.searchParams;
  const id = Number(caixa);
  if (!Number.isInteger(id) || id <= 0)
    return (
      <main className="mx-auto grid max-w-md gap-3 p-6">
        <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">QR do autoatendimento</h1>
        <form className="flex gap-2">
          <label htmlFor="caixa" className="sr-only">Número do caixa no Fortuna</label>
          <input id="caixa" name="caixa" inputMode="numeric" required placeholder="Número do caixa no Fortuna" className="min-h-10 flex-1 rounded-lg border border-gray-300 px-3 dark:border-gray-700 dark:bg-gray-900" />
          <button type="submit" className="min-h-10 rounded-lg bg-na-green px-4 font-bold text-white">Gerar</button>
        </form>
        <p className="text-sm text-gray-500">O número aparece no Fortuna, na lista de caixas da filial.</p>
      </main>
    );
  const nome = await fortunaProdutosDoCaixa(id).then((r) => r.cashier.title).catch(() => `Caixa nº ${id}`);
  const qr = await QRCode.toString(`${PORTAL}/cafe?caixa=${id}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#043a33", light: "#0000" } });
  return (
    <main className="mx-auto grid max-w-[190mm] gap-6 bg-white p-8 text-center text-[#043a33] print:p-0">
      <style>{`@page { size: A4; margin: 15mm; } @media print { header, nav, .nao-imprimir { display: none !important; } body { background: #fff !important; } }`}</style>
      <div className="nao-imprimir flex justify-center"><BotaoImprimir /></div>
      <p className="text-lg font-semibold uppercase tracking-[0.2em]">Lanchonete · {nome}</p>
      <h1 className="text-5xl font-black leading-tight text-balance">Pegue, pague no celular e bom apetite</h1>
      <p className="text-2xl">Aponte a câmera para o código</p>
      <div className="mx-auto size-[110mm] max-w-full" dangerouslySetInnerHTML={{ __html: qr }} />
      <ol className="mx-auto grid max-w-[150mm] gap-2 text-left text-xl">
        <li><b>1.</b> Entre no Portal com a sua senha, se pedir.</li>
        <li><b>2.</b> Escolha os produtos e toque em <b>Pagar com meu saldo</b>.</li>
        <li><b>3.</b> Mostre a tela verde, se pedirem, e pegue o produto.</li>
      </ol>
      <p className="text-base">Sem saldo? Recarregue pelo Portal, no cartão do Fortuna.</p>
    </main>
  );
}
