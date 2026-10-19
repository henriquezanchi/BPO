import { db } from "@/lib/db";
import { lerCredencialMercurio } from "@/lib/mercurio/scraper-credentials";
import { ehDirecaoDaFilial } from "@/lib/recursos-filial";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
// Código da Tesouraria trazido do projeto mercurio-tesouraria (JS, mesma lógica já testada no Mercúrio).
import { comEscopo } from "@/tesouraria/lib/armazenamento.js";
import { tratarRequisicao } from "@/tesouraria/web/rotas.js";

/**
 * Tesouraria dentro do Portal (pedido do usuário 2026-10-19): importar o
 * extrato bancário, conferir o que já está no Mercúrio e lançar só o que
 * falta. Acessível em /economia/tesouraria (rewrite em next.config.ts).
 *
 * Camadas de acesso:
 *  1. login no Portal + ser Secretaria de Economia ou Direção da filial;
 *  2. login no Mercúrio com a PRÓPRIA matrícula e senha (módulo Tesouraria
 *     liberado) — o que a ferramenta já fazia (web/autenticacao.js). A
 *     senha do Mercúrio nunca fica guardada no servidor.
 *
 * Pages Router (req/res do Node) porque a ferramenta usa a API do Node
 * diretamente, inclusive o acompanhamento ao vivo (Server-Sent Events).
 */
export const config = {
  api: { bodyParser: false, responseLimit: false, externalResolver: true },
  maxDuration: 800,
};

const PREFIXOS = ["/api/tesouraria", "/economia/tesouraria"];

async function membroLogado(req: NextApiRequest) {
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => Object.entries(req.cookies).map(([name, value]) => ({ name, value: value ?? "" })),
      setAll: () => {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return db.member.findUnique({ where: { authUserId: user.id } });
}

let credencialHttpCarregada = false;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const membro = await membroLogado(req);
  const pedeHtml = req.method === "GET" && !String(req.url ?? "").includes("/api/");
  if (!membro || !membro.mercurioAtivo) {
    if (pedeHtml) return res.redirect(303, "/login?next=/economia/tesouraria");
    return res.status(401).json({ erro: "Entre no Portal para usar a Tesouraria." });
  }
  const permitido = membro.isSecretarioEconomia || (await ehDirecaoDaFilial(membro, membro.schoolId));
  if (!permitido) {
    if (pedeHtml) return res.redirect(303, "/portal");
    return res.status(403).json({ erro: "A Tesouraria é da Secretaria de Economia e da Direção da filial." });
  }

  // Credencial universal do Mercúrio (popup HTTP) vem do mesmo cofre já usado
  // pelo Portal — não duplica o segredo em outra variável.
  if (!credencialHttpCarregada && !process.env.MERCURIO_HTTP_USER) {
    const http = await lerCredencialMercurio("mercurio_http");
    process.env.MERCURIO_HTTP_USER = http.usuario;
    process.env.MERCURIO_HTTP_PASS = http.senha;
    credencialHttpCarregada = true;
  }
  // Segredo do cookie de sessão da ferramenta: derivado de um segredo de
  // servidor que já existe (nunca vai ao navegador).
  if (!process.env.SEGREDO_SESSAO) {
    process.env.SEGREDO_SESSAO = crypto.createHash("sha256").update(`tesouraria:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest("hex");
  }

  // A ferramenta trabalha com caminhos a partir da raiz ("/", "/api/plano"...).
  let caminho = req.url ?? "/";
  for (const p of PREFIXOS) if (caminho.startsWith(p)) caminho = caminho.slice(p.length);
  req.url = caminho.startsWith("/") ? caminho : `/${caminho}`;

  await comEscopo(membro.schoolId, () => tratarRequisicao(req, res));
}
