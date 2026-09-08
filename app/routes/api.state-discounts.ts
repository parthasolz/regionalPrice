import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { INDIA_STATES } from "../models/stateDiscounts.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (shop) {
    const setting = await prisma.shopDiscountSetting.findUnique({
      where: { shop },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: { stateName: "asc" },
        },
      },
    });

    if (setting) {
      return new Response(
        JSON.stringify({
          isEnabled: setting.isEnabled,
          discountTitle: setting.discountTitle,
          bannerMessage: setting.bannerMessage,
          rules: setting.rules.map((r) => ({
            stateCode: r.stateCode,
            stateName: r.stateName,
            discountType: r.discountType,
            discountValue: r.discountValue,
            minOrderAmount: r.minOrderAmount,
            customMessage: r.customMessage,
          })),
        }),
        { headers: CORS_HEADERS }
      );
    }
  }

  // Default fallback rules (West Bengal: 50% discount)
  return new Response(
    JSON.stringify({
      isEnabled: true,
      discountTitle: "Regional State Discount (India)",
      bannerMessage: "🎉 Exclusive regional discounts available! Select your state.",
      rules: INDIA_STATES.map((s) => ({
        stateCode: s.code,
        stateName: s.name,
        discountType: s.discountType || "PERCENTAGE",
        discountValue: s.defaultDiscount,
        customMessage:
          s.defaultDiscount > 0 ? `${s.name} Special (${s.defaultDiscount}% OFF)` : null,
      })),
    }),
    { headers: CORS_HEADERS }
  );
};
