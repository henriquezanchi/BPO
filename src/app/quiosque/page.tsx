import { Quiosque } from "@/components/cafe/quiosque";
import { FortunaErro, fortunaProdutosDoCaixa } from "@/lib/fortuna/client";
import { aparelhoAtual } from "@/lib/quiosque";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lanchonete · Nova Acrópole" };

/**
 * Quiosque da lanchonete (23/11/2026; lib/quiosque.ts): computador ou tablet da escola. Só abre num aparelho ativado
 * pela área do Café (Área do Voluntário → Café). Não usa o login de ninguém.
 */
export default async function QuiosquePage(props: { searchParams: Promise<{ demo?: string }> }) {
  if ((await props.searchParams).demo === "1")
    return (
      <Quiosque
        demo
        caixa="Lanchonete (exemplo)"
        cashierId={0}
        produtos={[
          { id: 1, title: "Café coado", description: "Copo de 200 ml", price: "4.00", stock: 30 },
          { id: 2, title: "Pão de queijo", description: "Unidade", price: "5.50", stock: 20 },
          { id: 3, title: "Bolo de cenoura", description: "Fatia", price: "8.00", stock: 6 },
          { id: 4, title: "Suco natural", description: "Laranja, 300 ml", price: "9.00", stock: 0 },
          { id: 5, title: "Água mineral", description: "500 ml", price: "3.50", stock: 40 },
          { id: 6, title: "Coxinha", description: "Frango", price: "7.00", stock: 12 },
          { id: 7, title: "Cappuccino", description: "Copo de 200 ml", price: "7.50", stock: 15 },
          { id: 8, title: "Chocolate", description: "Barra 25 g", price: "4.50", stock: 25 },
        ]}
      />
    );
  const a = await aparelhoAtual();
  const aviso = (titulo: string, texto: string) => (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-black text-na-green-dark dark:text-emerald-400">{titulo}</h1>
      <p className="text-gray-600 dark:text-gray-400">{texto}</p>
    </main>
  );
  if (!a) return aviso("Quiosque não ativado", "Para usar este aparelho como quiosque da lanchonete, alguém da área do Café entra no Portal aqui e toca em “Usar este aparelho como quiosque” (Área do Voluntário → Café).");
  const catalogo = await fortunaProdutosDoCaixa(a.cashierId).catch((e) => (e instanceof FortunaErro ? e : new FortunaErro(String(e), 500)));
  if (catalogo instanceof FortunaErro)
    return catalogo.status === 404 || catalogo.status === 403
      ? aviso("Autoatendimento ainda não liberado", "Este caixa ainda não está no autoatendimento do Fortuna. Pague no caixa da lanchonete.")
      : aviso("Lanchonete fora do ar", "Não deu para carregar os produtos agora. Tente de novo em instantes.");
  return <Quiosque caixa={catalogo.cashier.title} cashierId={a.cashierId} produtos={catalogo.products} />;
}
