import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

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
          background: "#101311",
          color: "#fbfbf8",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path
              d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 2.5-6 5 0"
              stroke="#16c47f"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -2 }}>Wavelink</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02, maxWidth: 980 }}>
            Your WhatsApp, inside ChatGPT and Claude.
          </div>
          <div style={{ fontSize: 28, color: "#9aa39c" }}>
            Self-hosted MCP server + dashboard. Open source, MIT.
          </div>
        </div>
        <svg width="1056" height="14" viewBox="0 0 1056 14" fill="none">
          <path
            d={Array.from({ length: 26 })
              .map((_, i) => `M${i * 40} 7 C${i * 40 + 10} 0 ${i * 40 + 10} 0 ${i * 40 + 20} 7 S${i * 40 + 30} 14 ${i * 40 + 40} 7`)
              .join(" ")}
            stroke="#16c47f"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
