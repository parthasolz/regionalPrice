const PRICE_REGEX = /(₹|Rs\.?|INR|\$|€|£|¥|C\$|A\$)?\s*([\d,]+(?:\.\d+)?)\s*(INR|USD|EUR|GBP)?/i;

function cleanTitleStr(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[\u201C\u201D\u2018\u2019"']/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function formatAdjustedNumber(amount, originalNumberStr, prefix, suffix) {
  const isINR = !prefix || prefix.includes("₹") || prefix.includes("Rs") || prefix.includes("INR") || (suffix && suffix.includes("INR"));
  const locale = isINR ? "en-IN" : "en-US";

  const hasDecimals = originalNumberStr.includes(".");
  const decimalDigits = hasDecimals ? (originalNumberStr.split(".")[1] || "").length : 0;

  const formattedNum = amount.toLocaleString(locale, {
    minimumFractionDigits: hasDecimals ? Math.min(2, decimalDigits || 2) : 0,
    maximumFractionDigits: 2,
  });

  const pref = prefix || "Rs.";
  const space = pref.endsWith(" ") || pref.endsWith(".") ? (pref.endsWith(".") ? " " : "") : " ";
  const suf = suffix ? ` ${suffix.trim()}` : "";

  return `${pref}${space}${formattedNum}${suf}`.trim();
}

function transformElementPrice(el, rule, override, isCompareAt, activeState) {
  if (!el) return;

  const currentVisibleText = el.textContent ? el.textContent.trim() : "";
  if (!currentVisibleText) return;

  // Store original unmutated text ONCE
  if (!el.dataRegionalOriginalText) {
    el.dataRegionalOriginalText = currentVisibleText;
  }

  const originalText = el.dataRegionalOriginalText;

  // Never modify compare-at prices: always keep or restore original
  if (isCompareAt) {
    if (el.textContent.trim() !== originalText) {
      el.textContent = originalText;
    }
    delete el.dataRegionalTransformedText;
    delete el.dataRegionalAppliedState;
    return;
  }

  // If 0 adjustment and no override, restore original
  if ((!rule || !rule.adjustmentValue || rule.adjustmentValue === 0) && !override) {
    if (el.textContent.trim() !== originalText) {
      el.textContent = originalText;
    }
    delete el.dataRegionalTransformedText;
    delete el.dataRegionalAppliedState;
    return;
  }

  const match = originalText.match(PRICE_REGEX);
  if (!match || !match[2]) return;

  const rawPriceStr = match[2];
  const numericVal = parseFloat(rawPriceStr.replace(/,/g, ""));
  if (isNaN(numericVal) || numericVal <= 0) return;

  let adjustedPrice = numericVal;

  const overridePriceVal = override ? (override.overridePrice ?? override.customPrice ?? override.price ?? override.discountedPrice) : null;

  if (overridePriceVal != null) {
    adjustedPrice = typeof overridePriceVal === "number" ? overridePriceVal : parseFloat(overridePriceVal);
  } else {
    const isDecrease = rule.adjustmentType !== "INCREASE";
    if (rule.discountType === "FIXED_AMOUNT") {
      adjustedPrice = isDecrease
        ? Math.max(0, numericVal - rule.adjustmentValue)
        : numericVal + rule.adjustmentValue;
    } else {
      adjustedPrice = isDecrease
        ? Math.max(0, numericVal * (1 - rule.adjustmentValue / 100))
        : numericVal * (1 + rule.adjustmentValue / 100);
    }
  }

  const prefix = match[1] || "";
  const suffix = match[3] || "";
  const formattedAdjusted = formatAdjustedNumber(adjustedPrice, rawPriceStr, prefix, suffix);

  const targetFullText = originalText.replace(match[0], formattedAdjusted);

  if (el.textContent.trim() !== targetFullText.trim()) {
    el.textContent = targetFullText;
  }

  el.dataRegionalTransformedText = targetFullText;
  el.dataRegionalAppliedState = activeState;
}

// TEST SIMULATION
const saleSpan = { textContent: "Sale price\nRs. 19.99" };
const compareSpan = { textContent: "Regular price\nRs. 24.99" };

const wbRule = { adjustmentValue: 50, adjustmentType: "DECREASE", discountType: "PERCENTAGE", stateCode: "WB" };
const wbOverride = { overridePrice: 9.99 };

const mhRule = { adjustmentValue: 0, adjustmentType: "DECREASE", discountType: "PERCENTAGE", stateCode: "MH" };

console.log("--- 1. First run in WB ---");
transformElementPrice(saleSpan, wbRule, wbOverride, false, "West Bengal");
transformElementPrice(compareSpan, wbRule, wbOverride, true, "West Bengal");
console.log("Sale span:", JSON.stringify(saleSpan.textContent));
console.log("Compare span:", JSON.stringify(compareSpan.textContent));

console.log("\n--- 2. Repeated run in WB (idempotence) ---");
transformElementPrice(saleSpan, wbRule, wbOverride, false, "West Bengal");
transformElementPrice(compareSpan, wbRule, wbOverride, true, "West Bengal");
console.log("Sale span:", JSON.stringify(saleSpan.textContent));
console.log("Compare span:", JSON.stringify(compareSpan.textContent));

console.log("\n--- 3. Switch to Maharashtra (0%) ---");
transformElementPrice(saleSpan, mhRule, null, false, "Maharashtra");
transformElementPrice(compareSpan, mhRule, null, true, "Maharashtra");
console.log("Sale span:", JSON.stringify(saleSpan.textContent));
console.log("Compare span:", JSON.stringify(compareSpan.textContent));

console.log("\n--- 4. Switch back to West Bengal ---");
transformElementPrice(saleSpan, wbRule, wbOverride, false, "West Bengal");
transformElementPrice(compareSpan, wbRule, wbOverride, true, "West Bengal");
console.log("Sale span:", JSON.stringify(saleSpan.textContent));
console.log("Compare span:", JSON.stringify(compareSpan.textContent));
