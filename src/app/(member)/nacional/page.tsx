import { redirect } from "next/navigation";

/** O Painel Nacional foi absorvido pela Visão geral (pedido do usuário 2026-10-25), no alcance "Todas as filiais". */
export default function PainelNacionalPage() {
  redirect("/voluntario/filial?alcance=todas");
}
