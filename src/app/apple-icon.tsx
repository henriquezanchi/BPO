import { ImageResponse } from "next/og";

/** Ícone da tela de início no iPhone/iPad (o iOS não usa os ícones do manifest). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 88,
          fontWeight: 700,
          background: "#086357",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffca00",
        }}
      >
        NA
      </div>
    ),
    { ...size },
  );
}
