import { describe, it, expect } from "vitest";
import { run, EMPTY_DISCOUNT, type FunctionConfiguration } from "./run";
import { CurrencyCode, DiscountApplicationStrategy } from "../generated/api";

describe("Regional Discount Function (run.ts)", () => {
  const sampleConfig: FunctionConfiguration = {
    isEnabled: true,
    rules: [
      {
        stateCode: "WB",
        stateName: "West Bengal",
        discountType: "PERCENTAGE",
        discountValue: 50.0,
        isActive: true,
      },
      {
        stateCode: "MH",
        stateName: "Maharashtra",
        discountType: "PERCENTAGE",
        discountValue: 20.0,
        minOrderAmount: 500.0,
        isActive: true,
      },
      {
        stateCode: "DL",
        stateName: "Delhi",
        discountType: "FIXED_AMOUNT",
        discountValue: 150.0,
        isActive: true,
      },
      {
        stateCode: "KA",
        stateName: "Karnataka",
        discountType: "PERCENTAGE",
        discountValue: 15.0,
        isActive: false, // Inactive
      },
    ],
  };

  const createInput = (stateValue: string | null, subtotalAmount = "1000.00", config = sampleConfig) => ({
    cart: {
      attribute: stateValue ? { value: stateValue } : null,
      cost: {
        subtotalAmount: {
          amount: subtotalAmount,
          currencyCode: CurrencyCode.Inr,
        },
      },
    },
    discountNode: {
      metafield: {
        value: JSON.stringify(config),
      },
    },
  });

  it("applies 50% discount for West Bengal by state name", () => {
    const input = createInput("West Bengal");
    const result = run(input);

    expect(result.discountApplicationStrategy).toBe(DiscountApplicationStrategy.First);
    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].value.percentage?.value).toBe("50.00");
    expect(result.discounts[0].message).toContain("West Bengal Discount (50% OFF)");
    expect(result.discounts[0].targets[0].orderSubtotal).toBeDefined();
  });

  it("applies 50% discount for West Bengal by state code (WB)", () => {
    const input = createInput("WB");
    const result = run(input);

    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].value.percentage?.value).toBe("50.00");
  });

  it("handles case-insensitivity and formatting differences (e.g. 'west bengal ' or 'w-b')", () => {
    const input = createInput("  west bengal  ");
    const result = run(input);

    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].value.percentage?.value).toBe("50.00");
  });

  it("applies fixed amount discount for Delhi (₹150 OFF)", () => {
    const input = createInput("Delhi");
    const result = run(input);

    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0].value.fixedAmount?.amount).toBe("150.00");
    expect(result.discounts[0].message).toContain("Delhi Discount (₹150 OFF)");
  });

  it("respects minimum order amount condition for Maharashtra (min ₹500)", () => {
    // When subtotal < 500 -> no discount
    const inputUnder = createInput("Maharashtra", "400.00");
    const resultUnder = run(inputUnder);
    expect(resultUnder).toEqual(EMPTY_DISCOUNT);

    // When subtotal >= 500 -> 20% discount
    const inputOver = createInput("Maharashtra", "600.00");
    const resultOver = run(inputOver);
    expect(resultOver.discounts).toHaveLength(1);
    expect(resultOver.discounts[0].value.percentage?.value).toBe("20.00");
  });

  it("does not apply discount for inactive states (Karnataka)", () => {
    const input = createInput("Karnataka");
    const result = run(input);

    expect(result).toEqual(EMPTY_DISCOUNT);
  });

  it("does not apply discount when customer has no state selected", () => {
    const input = createInput(null);
    const result = run(input);

    expect(result).toEqual(EMPTY_DISCOUNT);
  });

  it("does not apply discount when configuration is globally disabled", () => {
    const disabledConfig = { ...sampleConfig, isEnabled: false };
    const input = createInput("West Bengal", "1000.00", disabledConfig);
    const result = run(input);

    expect(result).toEqual(EMPTY_DISCOUNT);
  });
});
