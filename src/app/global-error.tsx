"use client";

/**
 * Fallback pra quando um erro escapa de todo o resto da árvore (crash
 * total, não capturado por nenhum error.tsx de rota) — decisão do usuário
 * 2026-09-22: em vez de mostrar o crash cru (ex: "Minified React error
 * #441"), avisa que o suporte já foi acionado. O aviso de verdade pro
 * suporte já aconteceu sozinho, do lado do servidor, via onRequestError
 * (ver src/instrumentation.ts) — esta tela só tranquiliza quem está vendo.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1f2937" }}>Ocorreu um erro inesperado</h1>
          <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 360 }}>
            Nossa equipe de suporte já foi avisada automaticamente e está verificando. Tente novamente em alguns instantes.
          </p>
          <button
            onClick={() => retry()}
            style={{ marginTop: 8, borderRadius: 12, background: "#0d7a4f", color: "white", padding: "10px 20px", fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
