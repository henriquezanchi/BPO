import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedMember } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/avatar-url";
import { codigoDaCarteirinha } from "@/lib/carteirinha";

export const dynamic = "force-dynamic";

const NIVEIS: Record<string, string> = { PP: "Provacionista", CA: "Círculo de Amigos", CO: "Correntinha", TA: "Távolas", JN: "Janos" };
function nivelLegivel(nivel: string | null) {
  if (!nivel) return null;
  const n = /^N(\d)$/.exec(nivel);
  return n ? `${n[1]}º nível` : (NIVEIS[nivel] ?? null);
}

/**
 * Carteirinha digital (pedido do usuário 07/11/2026): nome, foto, matrícula, filial e nível, com um QR que a recepção
 * dos eventos lê com a câmera para marcar a presença (lib/carteirinha.ts). A situação é a de agora: quem saiu da escola
 * não vê a carteirinha válida.
 */
export default async function CarteirinhaPage() {
  const member = await getAuthenticatedMember();
  if (!member) redirect("/login?next=/portal/carteirinha");
  const matricula = member.mercurioId ?? member.registrationNo;
  const qr = matricula && /^\d+$/.test(matricula) ? await QRCode.toString(codigoDaCarteirinha(matricula), { type: "svg", margin: 0, errorCorrectionLevel: "M" }) : null;
  const foto = getAvatarUrl(member.avatarPath);
  const nome = member.name.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  const filial = member.school.name.replace(/^Nova Acrópole\s*-\s*/i, "");
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-na-bg p-4 dark:bg-gray-950">
      <Link href="/portal" className="-my-2 flex min-h-11 w-fit items-center gap-1.5 text-[13px] font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft size={14} /> Portal do Aluno
      </Link>

      <article className="overflow-hidden rounded-3xl bg-gradient-to-br from-na-green-dark to-na-green text-white shadow-lg">
        <div className="flex items-center justify-between px-5 pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/na-logo.png" alt="Nova Acrópole" className="h-9 w-auto brightness-0 invert" />
          <span className="text-[10px] font-semibold tracking-[0.18em] text-na-gold uppercase">Carteirinha</span>
        </div>

        <div className="flex items-center gap-4 px-5 pt-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/40 bg-white/15">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- vem do Supabase Storage
              <img src={foto} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold">{nome.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-bold [text-wrap:balance]">{nome}</p>
            <p className="mt-1 text-[13px] text-white/85">{filial}</p>
            {nivelLegivel(member.nivel) && <p className="text-[13px] text-white/85">{nivelLegivel(member.nivel)}</p>}
          </div>
        </div>

        <dl className="mx-5 mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-3 text-[12px]">
          <div>
            <dt className="text-white/70">Matrícula</dt>
            <dd className="text-base font-bold tabular-nums">{matricula ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-white/70">Situação em {hoje}</dt>
            <dd className={`text-base font-bold ${member.mercurioAtivo ? "" : "text-red-200"}`}>{member.mercurioAtivo ? "Ativo" : "Inativo"}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-col items-center gap-2 bg-white px-5 py-5 text-gray-900">
          {qr && member.mercurioAtivo ? (
            <>
              <div className="h-48 w-48 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="text-center text-[12px] text-gray-600">Mostre na recepção dos eventos para marcar sua presença.</p>
            </>
          ) : (
            <p className="text-center text-[13px] text-gray-700">
              {member.mercurioAtivo ? "Sua matrícula ainda não chegou ao Portal. Fale com a secretaria." : "Carteirinha disponível só para quem está ativo na escola."}
            </p>
          )}
        </div>
      </article>
      <p className="text-center text-[11px] text-gray-500 dark:text-gray-400">Dica: adicione o Portal à tela inicial do celular para abrir a carteirinha mais rápido.</p>
    </main>
  );
}
