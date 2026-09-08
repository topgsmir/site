import { ImageResponse } from "next/og";
import { isLocale } from "@/lib/i18n";
import { getPublicProduct } from "./product.server";

export const alt = "Top GSM product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphProductImage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const product = isLocale(locale) ? await getPublicProduct(slug) : null;
  const title = product?.title ?? "Top GSM";
  const detail = [product?.category, product?.type].filter(Boolean).join(" · ");
  const titleSize = title.length > 70 ? 54 : title.length > 38 ? 68 : 84;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        color: "#142033",
        background: "#f4f7fb",
        fontFamily: "sans-serif"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #9aa8bc", paddingBottom: 24 }}>
        <strong style={{ fontSize: 34, letterSpacing: "0.08em" }}>TOP GSM</strong>
        <span style={{ fontSize: 22, color: "#315ea8" }}>{detail}</span>
      </div>
      <div style={{ display: "flex", maxWidth: 1000, fontSize: titleSize, fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.04em" }}>
        {title}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #9aa8bc", paddingTop: 24, color: "#40516b", fontSize: 22 }}>
        <span>top-gsm.ir</span>
        <span>{product?.slug ?? "product"}</span>
      </div>
    </div>,
    size
  );
}
