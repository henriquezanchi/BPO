import { CafeAutoatendimento } from "@/components/member/cafe-autoatendimento";
import { getAuthenticatedMember } from "@/lib/auth";
import { FortunaErro, fortunaGetClient, fortunaProdutosDoCaixa } from "@/lib/fortuna/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Autoatendimento na lanchonete (23/11/2026). O QR do caixa leva a /cafe?caixa=<id do caixa no Fortuna>. Quem não está
 * logado entra e volta. Depende das rotas novas do Fortuna (pacote entregue ao Paulo); antes disso, mostra que ainda não
 * está liberado.
 */
export default async function CafePage(props: { searchParams: Promise<{ caixa?: string }> }) {
  const { caixa } = await props.searchParams;
  const member = await getAuthenticatedMember();
  if (!member) redirect(`/login?${new URLSearchParams({ next: `/cafe${caixa ? `?caixa=${caixa}` : ""}` })}`);
  // Demonstração (23/11/2026, pedido do usuário para testar): cardápio de exemplo e compra simulada, nada é cobrado.
  if (caixa === "demo")
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-center text-sm font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">DEMONSTRAÇÃO · nada é cobrado</p>
        <CafeAutoatendimento
          demo
          cashierId={0}
          caixa="Lanchonete (exemplo)"
          saldo={50}
          nome={member.name.split(" ")[0]}
          produtos={[
            { id: 1, title: "Café coado", description: "Copo de 200 ml", price: "4.00", stock: 30 },
            { id: 2, title: "Pão de queijo", description: "Unidade", price: "5.50", stock: 20 },
            { id: 3, title: "Bolo de cenoura", description: "Fatia com cobertura de chocolate", price: "8.00", stock: 6 },
            { id: 4, title: "Suco natural", description: "Laranja, 300 ml", price: "9.00", stock: 0 },
            { id: 5, title: "Água mineral", description: "500 ml", price: "3.50", stock: 40 },
          ]}
        />
      </main>
    );
  const cashierId = Number(caixa);
  const aviso = (titulo: string, texto: string) => (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-3 p-6 text-center">
      <h1 className="text-xl font-black text-na-green-dark dark:text-emerald-400">{titulo}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">{texto}</p>
      <Link href="/portal" className="text-sm font-semibold text-na-green underline dark:text-emerald-400">Ir para o Portal</Link>
    </main>
  );
  if (!Number.isInteger(cashierId) || cashierId <= 0) return aviso("Leia o QR do caixa", "Aponte a câmera para o QR code da lanchonete para abrir o autoatendimento.");
  if (!member.mercurioAtivo) return aviso("Matrícula inativa", "Fale com a secretaria da escola.");
  if (!member.fortunaClientId) return aviso("Conta ainda não ligada ao Fortuna", "Para pagar com o saldo da lanchonete, sua conta do Portal precisa estar ligada ao Fortuna. Fale com a secretaria.");

  const [catalogo, cliente] = await Promise.all([
    fortunaProdutosDoCaixa(cashierId).catch((e) => (e instanceof FortunaErro ? e : new FortunaErro(String(e), 500))),
    fortunaGetClient(member.fortunaClientId).catch(() => null),
  ]);
  if (catalogo instanceof FortunaErro)
    return catalogo.status === 404 || catalogo.status === 403
      ? aviso("Autoatendimento ainda não liberado", "Este caixa ainda não está no autoatendimento. Pague no caixa da lanchonete.")
      : aviso("Lanchonete fora do ar", "Não deu para carregar os produtos agora. Tente de novo em instantes ou pague no caixa.");
  // Sem resposta do saldo agora: deixa comprar; o Fortuna confere o saldo de qualquer forma.
  const saldo = cliente ? Number(cliente.balance.find((b) => b.branchId === catalogo.cashier.branchId)?.amount ?? 0) : null;

  return (
    <main className="mx-auto max-w-md p-4">
      <CafeAutoatendimento cashierId={cashierId} caixa={catalogo.cashier.title} produtos={catalogo.products} saldo={saldo} nome={member.name.split(" ")[0]} />
    </main>
  );
}
