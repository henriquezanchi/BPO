import { db } from "@/lib/db";
import { SECRETARIA_DIFUSAO } from "@/lib/redes-filial";
import { contasDoPerfil } from "@/lib/zernio/client";

/**
 * Volta da autorização do Instagram (Zernio). Não confia em nada da URL além da filial: confere na Zernio a conta
 * de Instagram do perfil dela e grava. O webhook account.connected faz o mesmo; o que chegar primeiro vale.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const schoolId = url.searchParams.get("filial") ?? "";
  const destino = new URL(`/secretarias/${encodeURIComponent(SECRETARIA_DIFUSAO)}`, url.origin);
  const rede = schoolId ? await db.redeSocialFilial.findUnique({ where: { schoolId_rede: { schoolId, rede: "instagram" } } }) : null;
  if (!rede?.zernioProfileId || rede.status === "cancelada") return Response.redirect(destino, 303);
  const conta = (await contasDoPerfil(rede.zernioProfileId).catch(() => [])).find((c) => c.platform === "instagram");
  if (conta) {
    await db.redeSocialFilial.update({
      where: { id: rede.id },
      data: { status: "conectada", zernioAccountId: conta._id, usuario: conta.username ?? conta.displayName ?? null, conectadaEm: rede.conectadaEm ?? new Date() },
    });
    destino.searchParams.set("instagram", "conectado");
  } else destino.searchParams.set("instagram", "nao-conectado");
  return Response.redirect(destino, 303);
}
