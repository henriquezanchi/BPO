import { redirect } from "next/navigation";

/** Compatibilidade com links antigos: a lista de secretarias da filial fica em /secretarias. */
export default function AntigaSecretariasPage() {
  redirect("/secretarias");
}
