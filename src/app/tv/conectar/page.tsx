import { ConectarTvForm } from "@/components/director/conectar-tv-form";
import { exigirArea } from "@/lib/area-trabalho";
import { db } from "@/lib/db";
import { normalizarCodigo } from "@/lib/telas-conexao";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conectar TV — Portal",
  robots: { index: false, follow: false },
};

/**
 * Aberta pelo QR da TV (/tv) no celular do voluntário (pedido do usuário 2026-10-24): escolhe
 * qual tela da filial aquela TV vai mostrar. Exige login e a área Eventos.
 */
export default async function ConectarTvVoluntarioPage(props: { searchParams: Promise<{ c?: string }> }) {
  const { c = "" } = await props.searchParams;
  const codigo = normalizarCodigo(c) ?? "";
  const member = await exigirArea("eventos", `/tv/conectar${codigo ? `?c=${codigo}` : ""}`);
  const telas = await db.telaEventos.findMany({ where: { schoolId: member.schoolId }, orderBy: { createdAt: "asc" }, select: { id: true, nome: true } });
  return (
    <main className="mx-auto min-h-dvh max-w-md bg-na-bg px-4 py-8 dark:bg-gray-950">
      <h1 className="text-2xl font-black text-na-green-dark dark:text-emerald-400">Conectar TV</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Escolha o que a TV vai mostrar. Ela muda sozinha em alguns segundos.</p>
      <ConectarTvForm schoolId={member.schoolId} telas={telas} codigoInicial={codigo} />
    </main>
  );
}
