import { BotaoImprimir } from "@/components/economia/botao-imprimir";
import { areasNaFilial } from "@/lib/areas-filial";
import { getAuthenticatedMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { ehDonoDoSistema } from "@/lib/dono-do-sistema";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

const PORTAL = process.env.PORTAL_URL || "https://portal-na-one.vercel.app";

/**
 * Cartaz do pátio (12/11/2026, cronograma do spread): QR code que abre o pagamento guiado (/pagar) da filial.
 * A Economia imprime em A4 (ou A3) pelo navegador. O QR leva a sigla da filial para medir o uso.
 */
export default async function CartazPage(props: { searchParams: Promise<{ filial?: string }> }) {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/economia/cartaz");
  const { filial } = await props.searchParams;
  const schoolId = filial && ehDonoDoSistema(member) ? filial : member.schoolId;
  if (!ehDonoDoSistema(member) && !(await areasNaFilial(member, schoolId)).includes("economia")) redirect("/voluntario");
  const escola = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, mercurioUnidade: true } });
  const destino = `${PORTAL}/pagar?${new URLSearchParams({ filial: escola.mercurioUnidade ?? "", origem: "patio" })}`;
  const qr = await QRCode.toString(destino, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#043a33", light: "#0000" } });
  const nome = escola.name.replace(/^Nova Acr[oó]pole\s*-\s*/i, "");

  return (
    <main className="mx-auto grid max-w-[190mm] gap-6 bg-white p-8 text-center text-[#043a33] print:p-0">
      <style>{`@page { size: A4; margin: 15mm; } @media print { header, nav, .nao-imprimir { display: none !important; } body { background: #fff !important; } }`}</style>
      <div className="nao-imprimir flex justify-center gap-3">
        <BotaoImprimir />
      </div>
      <p className="text-lg font-semibold uppercase tracking-[0.2em]">Nova Acrópole · {nome}</p>
      <h1 className="text-5xl font-black leading-tight text-balance">Pague a sua contribuição pelo celular</h1>
      <p className="text-2xl">Aponte a câmera para o código</p>
      <div className="mx-auto size-[110mm] max-w-full" dangerouslySetInnerHTML={{ __html: qr }} />
      <ol className="mx-auto grid max-w-[150mm] gap-2 text-left text-xl">
        <li><b>1.</b> Entre no Portal com a sua senha, se pedir.</li>
        <li><b>2.</b> O Portal mostra a sua contribuição e gera o Pix sozinho.</li>
        <li><b>3.</b> Toque em <b>Copiar o código</b> e confirme no app do seu banco.</li>
      </ol>
      <p className="text-base">Dúvidas? Fale com a secretaria da escola.</p>
    </main>
  );
}
