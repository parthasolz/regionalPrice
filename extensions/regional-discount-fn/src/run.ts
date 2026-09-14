import type {
  RunInput,
  FunctionRunResult,
} from "../generated/api";
import {
  DiscountApplicationStrategy,
} from "../generated/api";

export const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

export interface StateRuleConfig {
  stateCode: string;
  stateName: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  adjustmentType?: "DECREASE" | "INCREASE";
  includeCompareAt?: boolean;
  minOrderAmount?: number | null;
  isActive: boolean;
  customMessage?: string | null;
}

export interface ProductOverrideConfig {
  stateCode: string;
  productId: string;
  variantId?: string | null;
  customPrice?: number | null;
  customCompareAtPrice?: number | null;
  isIncluded?: boolean;
}

export interface FunctionConfiguration {
  isEnabled?: boolean;
  defaultDiscountTitle?: string;
  rules?: StateRuleConfig[];
  productOverrides?: ProductOverrideConfig[];
}

function normalizeStateString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function run(input: RunInput): FunctionRunResult {
  const rawMetafieldValue = input?.discountNode?.metafield?.value;
  if (!rawMetafieldValue) {
    return EMPTY_DISCOUNT;
  }

  let configuration: FunctionConfiguration;
  try {
    configuration = JSON.parse(rawMetafieldValue);
  } catch {
    return EMPTY_DISCOUNT;
  }

  // If the discount is globally disabled in configuration
  if (configuration.isEnabled === false) {
    return EMPTY_DISCOUNT;
  }

  // Get customer's state from cart attribute
  const rawCustomerState = input.cart?.attribute?.value;
  if (!rawCustomerState || typeof rawCustomerState !== "string") {
    return EMPTY_DISCOUNT;
  }

  const normalizedCustomerState = normalizeStateString(rawCustomerState);
  if (!normalizedCustomerState) {
    return EMPTY_DISCOUNT;
  }

  const rules = configuration.rules || [];
  const matchedRule = rules.find((r) => {
    if (!r.isActive || r.discountValue <= 0) return false;
    const matchName = normalizeStateString(r.stateName || "");
    const matchCode = normalizeStateString(r.stateCode || "");
    return (
      (matchName && matchName === normalizedCustomerState) ||
      (matchCode && matchCode === normalizedCustomerState)
    );
  });

  if (!matchedRule) {
    return EMPTY_DISCOUNT;
  }

  // Check subtotal against minOrderAmount if defined
  const subtotalAmount = parseFloat(input.cart?.cost?.subtotalAmount?.amount ?? "0");
  if (
    matchedRule.minOrderAmount != null &&
    matchedRule.minOrderAmount > 0 &&
    subtotalAmount < matchedRule.minOrderAmount
  ) {
    return EMPTY_DISCOUNT;
  }

  const isPercentage = matchedRule.discountType !== "FIXED_AMOUNT";
  const formattedDiscountValue =
    matchedRule.discountValue % 1 === 0
      ? matchedRule.discountValue.toString()
      : matchedRule.discountValue.toFixed(2);
  const discountValueStr = matchedRule.discountValue.toFixed(2);

  const discountMessage =
    matchedRule.customMessage ||
    (isPercentage
      ? `${matchedRule.stateName} Discount (${formattedDiscountValue}% OFF)`
      : `${matchedRule.stateName} Discount (₹${formattedDiscountValue} OFF)`);

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.First,
    discounts: [
      {
        targets: [
          {
            orderSubtotal: {
              excludedVariantIds: [],
            },
          },
        ],
        value: isPercentage
          ? {
              percentage: {
                value: discountValueStr,
              },
            }
          : {
              fixedAmount: {
                amount: discountValueStr,
              },
            },
        message: discountMessage,
      },
    ],
  };
}