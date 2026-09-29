import { ImageResponse } from "next/og";

/** Ícone 512x512 do manifest.ts (PWA) — gerado por código (ImageResponse), sem precisar de um arquivo de imagem/lib de processamento de imagem. */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 256,
          fontWeight: 700,
          background: "#005a4b",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#c5a059",
        }}
      >
        NA
      </div>
    ),
    { width: 512, height: 512 },
  );
}
