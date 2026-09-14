const rawOverridesFromStore = [
  {
    id: "clx1",
    shop: "itzapptst.myshopify.com",
    productHandle: "physical-product-the-band-t-shirt",
    productTitle: "Physical Product “The Band” T-Shirt",
    state: "West Bengal",
    overridePrice: 9.99
  },
  {
    id: "clx2",
    shop: "itzapptst.myshopify.com",
    productHandle: "product-puma",
    productTitle: "Product Puma",
    state: "West Bengal",
    overridePrice: 50.00
  }
];

function cleanTitleStr(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[\u201C\u201D\u2018\u2019"']/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findProductOverride(title, productId, stateCode, stateName, overrides) {
  if (!overrides || overrides.length === 0) return null;

  const cleanTitle = cleanTitleStr(title);
  const cleanId = (productId || "").replace(/[^0-9]/g, "");

  return overrides.find((o) => {
    const oState = (o.stateCode || o.state || o.stateName || "").toUpperCase();
    const sCode = (stateCode || "").toUpperCase();
    const sName = (stateName || "").toUpperCase();

    if (oState && oState !== "ALL") {
      const matchesState = oState === sCode || oState === sName || oState.includes(sName) || sName.includes(oState);
      if (!matchesState) return false;
    }

    if (cleanId && o.productId) {
      const overrideCleanId = o.productId.replace(/[^0-9]/g, "");
      if (overrideCleanId && cleanId === overrideCleanId) return true;
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

function getOverridePrice(override) {
  if (!override) return null;
  const p = override.overridePrice ?? override.customPrice ?? override.price ?? override.discountedPrice;
  return typeof p === "number" ? p : parseFloat(p);
}

// Test 1: T-Shirt
const o1 = findProductOverride("Physical Product “The Band” T-Shirt", "", "WB", "West Bengal", rawOverridesFromStore);
console.log("T-Shirt match:", o1);
console.log("T-Shirt price:", getOverridePrice(o1));

// Test 2: Puma
const o2 = findProductOverride("Product Puma", "", "WB", "West Bengal", rawOverridesFromStore);
console.log("Puma match:", o2);
console.log("Puma price:", getOverridePrice(o2));
