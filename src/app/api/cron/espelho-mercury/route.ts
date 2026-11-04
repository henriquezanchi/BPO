import { espelhoLigado, rodarEspelho } from "@/lib/espelho-mercury/rodar";
import { autorizadoCron, executarRotina } from "@/lib/rotinas";

/**
 * Espelho Mercury → Mercúrio antigo (vercel.json, toda noite às 02:30 UTC = 23:30 de Brasília): compara o Mercúrio
 * novo com o antigo nas escolas ligadas e atualiza a lista de pendências (src/lib/espelho-mercury/rodar.ts). Só lê; o
 * robô grava os itens aprovados na fila de 10 em 10 min (fila-mercurio). Em espera até ESPELHO_MERCURY_LIGADO=1:
 * desligado, a rotina só registra que rodou.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autorizadoCron(req)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
  const r = await executarRotina("espelho-mercury", {
    comparar: async () => {
      if (!espelhoLigado()) return { emEspera: true };
      const resultados = await rodarEspelho();
      const falhas = resultados.filter((x) => "erro" in x);
      if (falhas.length) throw new Error(falhas.map((f) => `${f.schoolId}: ${"erro" in f ? f.erro : ""}`).join("; ").slice(0, 300));
      return { escolas: resultados };
    },
  });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
