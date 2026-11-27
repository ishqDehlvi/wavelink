import { ImageResponse } from "next/og";
import { site } from "@/lib/site";
import { BRAND_GREEN, LOCKUP } from "@/lib/brand";

export const alt = `${site.name} · ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          color: "#0d1310",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <svg width={Math.round((52 * Number(LOCKUP.viewBox.split(" ")[2])) / Number(LOCKUP.viewBox.split(" ")[3]))} height={52} viewBox={LOCKUP.viewBox}>
          <path transform={LOCKUP.symbolTransform} d={LOCKUP.symbol} fill={BRAND_GREEN} />
          <path transform={LOCKUP.wordTransform} d={LOCKUP.word} fill="#0d1310" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.04, maxWidth: 1000 }}>
            Your WhatsApp and Notion, inside ChatGPT and Claude.
          </div>
          <div style={{ fontSize: 28, color: "#5b655f" }}>
            Self-hosted MCP server + dashboard. Open source, MIT.
          </div>
        </div>
        <svg width="1056" height="14" viewBox="0 0 1056 14" fill="none">
          <path
            d={Array.from({ length: 26 })
              .map((_, i) => `M${i * 40} 7 C${i * 40 + 10} 0 ${i * 40 + 10} 0 ${i * 40 + 20} 7 S${i * 40 + 30} 14 ${i * 40 + 40} 7`)
              .join(" ")}
            stroke={BRAND_GREEN}
            strokeWidth="1.5"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
