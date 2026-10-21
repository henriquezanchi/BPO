import { ImageResponse } from "next/og";

/**
 * Ícone pequeno da barra de notificações (Android). O sistema usa só o
 * contorno (canal alfa), por isso é branco sobre fundo transparente.
 */
export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontSize: 44, fontWeight: 700 }}>
        NA
      </div>
    ),
    { width: 96, height: 96 },
  );
}
