import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * O Painel da Direção virou parte da Área do Voluntário (pedido do usuário
 * 2026-10-19): Visão da filial, Escolástica, Economia, Eventos e Café, cada
 * um no menu. Este endereço continua funcionando e leva para lá.
 */
export default function DiretorPage() {
  redirect("/voluntario/filial");
}
