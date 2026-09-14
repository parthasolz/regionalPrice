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

const OVERRIDES = [
  {
    productTitle: 'Physical Product "The Band" T-Shirt',
    productHandle: 'physical-product-the-band-t-shirt',
    state: 'West Bengal',
    stateCode: 'WB',
    overridePrice: 9.99,
  },
  {
    productTitle: 'Product Puma',
    productHandle: 'product-puma',
    state: 'West Bengal',
    stateCode: 'WB',
    overridePrice: 50.00,
  }
];

function findProductOverride(title, productId, handle, stateCode, stateName) {
  const cleanTitle = cleanTitleStr(title);
  const cleanHandle = cleanTitleStr(handle);
  const cleanId = (productId || "").replace(/[^0-9]/g, "");

  return OVERRIDES.find((o) => {
    const oState = (o.stateCode || o.state || o.stateName || "").toUpperCase();
    const sCode = (stateCode || "").toUpperCase();
    const sName = (stateName || "").toUpperCase();

    if (oState && oState !== "ALL") {
      const matchesState =
        oState === sCode ||
        oState === sName ||
        oState.includes(sName) ||
        sName.includes(oState) ||
        (sName.includes("WEST BENGAL") && oState.includes("WB")) ||
        (sName.includes("WB") && oState.includes("WEST BENGAL"));
      if (!matchesState) return false;
    }

    if (cleanId && o.productId) {
      const overrideCleanId = o.productId.replace(/[^0-9]/g, "");
      if (overrideCleanId && cleanId === overrideCleanId) return true;
    }

    if (cleanHandle && o.productHandle) {
      const overrideCleanHandle = cleanTitleStr(o.productHandle);
      if (cleanHandle === overrideCleanHandle || cleanHandle.includes(overrideCleanHandle)) return true;
    }

    const oTitle = o.productTitle || o.title || "";
    if (cleanTitle && oTitle) {
      const overrideCleanTitle = cleanTitleStr(oTitle);
      if (
        cleanTitle === overrideCleanTitle ||
        cleanTitle.includes(overrideCleanTitle) ||
        overrideCleanTitle.includes(cleanTitle) ||
        (cleanTitle.includes("theband") && overrideCleanTitle.includes("theband")) ||
        (cleanTitle.includes("perfume") && overrideCleanTitle.includes("perfume")) ||
        (cleanTitle.includes("puma") && overrideCleanTitle.includes("puma"))
      ) {
        return true;
      }
    }

    return false;
  });
}

function transformElementPrice(el, rule, override, isCompareAt, activeState) {
  if (!el) return;

  const currentVisibleText = el.textContent ? el.textContent.trim() : "";
  if (!currentVisibleText) return;

  if (!el.dataRegionalOriginalText) {
    el.dataRegionalOriginalText = currentVisibleText;
  }

  const originalText = el.dataRegionalOriginalText;

  if (isCompareAt) {
    if (el.textContent.trim() !== originalText) {
      el.textContent = originalText;
    }
    delete el.dataRegionalTransformedText;
    delete el.dataRegionalAppliedState;
    return;
  }

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

// TEST T-SHIRT
const tShirtSaleEl = { textContent: "Sale price\nRs. 19.99" };
const tShirtCompareEl = { textContent: "Regular price\nRs. 24.99" };

const o = findProductOverride("Physical Product “The Band” T-Shirt", "", "physical-product-the-band-t-shirt", "WB", "West Bengal");
console.log("Override found:", o);

transformElementPrice(tShirtSaleEl, { adjustmentValue: 50 }, o, false, "West Bengal");
transformElementPrice(tShirtCompareEl, { adjustmentValue: 50 }, o, true, "West Bengal");

console.log("T-Shirt Result:");
console.log("  Sale price:", tShirtSaleEl.textContent);
console.log("  Compare price:", tShirtCompareEl.textContent);

// TEST PUMA
const pumaSaleEl = { textContent: "Sale price\nRs. 100.00" };
const pumaCompareEl = { textContent: "Regular price\nRs. 150.00" };

const oPuma = findProductOverride("Product Puma", "", "product-puma", "WB", "West Bengal");
console.log("\nPuma override found:", oPuma);

transformElementPrice(pumaSaleEl, { adjustmentValue: 50 }, oPuma, false, "West Bengal");
transformElementPrice(pumaCompareEl, { adjustmentValue: 50 }, oPuma, true, "West Bengal");

console.log("Puma Result:");
console.log("  Sale price:", pumaSaleEl.textContent);
console.log("  Compare price:", pumaCompareEl.textContent);
