import { sincronizarPendenciasMercurio } from "@/lib/mercurio/pendencias-mercurio";
import { autorizadoCron, executarRotina } from "@/lib/rotinas";

/**
 * Pendências da Tesouraria do Mercúrio (vercel.json, toda noite às 03:40 UTC = 00:40 de Brasília): o robô lê
 * "Cadastro → Pendentes" de cada filial com rótulo configurado e guarda em ResumoNacional (lib/mercurio/pendencias-
 * mercurio.ts). Só leitura. O Portal do Aluno mostra o que bate com o nome da pessoa.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autorizadoCron(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const r = await executarRotina("pendencias-mercurio", { ler: () => sincronizarPendenciasMercurio() });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
