import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { INDIA_STATES, getProductPriceOverrides } from "../models/stateDiscounts.server";

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

  const setting = shop
    ? await prisma.shopDiscountSetting.findUnique({
        where: { shop },
        include: {
          rules: {
            where: { isActive: true },
            orderBy: { stateName: "asc" },
          },
        },
      })
    : await prisma.shopDiscountSetting.findFirst({
        include: {
          rules: {
            where: { isActive: true },
            orderBy: { stateName: "asc" },
          },
        },
      });

  const targetShop = shop || setting?.shop;
  const overrides = targetShop ? await getProductPriceOverrides(targetShop) : [];

  if (setting) {
    return new Response(
      JSON.stringify({
        isEnabled: setting.isEnabled,
        discountTitle: setting.discountTitle,
        bannerMessage: setting.bannerMessage,
        rules: setting.rules.map((r: any) => ({
          stateCode: r.stateCode,
          stateName: r.stateName,
          discountType: r.discountType,
          discountValue: r.discountValue,
          adjustmentType: r.adjustmentType || "DECREASE",
          includeCompareAt: r.includeCompareAt !== false,
          autoIncludeNewProducts: r.autoIncludeNewProducts !== false,
          currency: r.currency || "INR ₹",
          minOrderAmount: r.minOrderAmount,
          customMessage: r.customMessage,
        })),
        overrides: overrides.map((o: any) => ({
          stateCode: o.stateCode,
          state: o.stateCode === "WB" ? "West Bengal" : o.stateCode,
          stateName: o.stateCode === "WB" ? "West Bengal" : o.stateCode,
          productId: o.productId,
          productTitle: o.productTitle,
          variantId: o.variantId,
          customPrice: o.customPrice,
          overridePrice: o.customPrice,
          price: o.customPrice,
          customCompareAtPrice: o.customCompareAtPrice,
          isIncluded: o.isIncluded,
        })),
      }),
      { headers: CORS_HEADERS }
    );
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
        adjustmentType: s.adjustmentType || "DECREASE",
        includeCompareAt: s.includeCompareAt !== false,
        autoIncludeNewProducts: s.autoIncludeNewProducts !== false,
        currency: s.currency || "INR ₹",
        customMessage:
          s.defaultDiscount > 0 ? `${s.name} Special (${s.defaultDiscount}% OFF)` : null,
      })),
      overrides: [],
    }),
    { headers: CORS_HEADERS }
  );
};
