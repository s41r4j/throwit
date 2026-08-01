import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Throwit — fast peer-to-peer file sharing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "72px 86px",
        color: "#121210",
        background: "#f3f1ec",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", opacity: 0.38, backgroundImage: "linear-gradient(rgba(18,18,16,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(18,18,16,.08) 1px, transparent 1px)", backgroundSize: "46px 46px" }} />
      <div style={{ display: "flex", flexDirection: "column", width: 660, zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 25, fontWeight: 800, letterSpacing: "-1px" }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, marginRight: 12, background: "#ff6268" }} />
          throwit.s41r4j.in
        </div>
        <div style={{ marginTop: 46, fontSize: 82, lineHeight: 0.92, fontWeight: 900, letterSpacing: "-6px" }}>
          Don’t upload it.
          <span style={{ display: "flex", color: "#ff6268" }}>Throw it.</span>
        </div>
        <div style={{ marginTop: 30, fontSize: 24, lineHeight: 1.4, color: "#6f6b64" }}>
          Fast encrypted file and text transfer between nearby devices.
        </div>
      </div>
      <div style={{ width: 360, height: 360, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, border: "2px dashed rgba(18,18,16,.16)", background: "rgba(255,255,255,.68)", boxShadow: "0 26px 70px rgba(35,30,24,.16)", zIndex: 2 }}>
        <img src="https://throwit.s41r4j.in/paper-logo.webp" width="294" height="294" alt="" style={{ objectFit: "contain" }} />
      </div>
    </div>,
    size,
  );
}
