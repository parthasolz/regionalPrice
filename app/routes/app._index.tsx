import { useState, useMemo, useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  getOrCreateShopDiscountSettings,
  updateStateRule,
  updateShopSettings,
  syncDiscountWithShopify,
  syncPriceListWithShopify,
  getProductPriceOverrides,
  saveProductPriceOverrides,
  fetchShopProducts,
} from "../models/stateDiscounts.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  let settings = await getOrCreateShopDiscountSettings(session.shop);

  if (!settings.discountId) {
    try {
      const syncResult = await syncDiscountWithShopify(admin, session.shop);
      if (syncResult.success) {
        settings = await getOrCreateShopDiscountSettings(session.shop);
      }
    } catch (e) {
      console.error("Auto-sync discount on load notice:", e);
    }
  }

  const products = await fetchShopProducts(admin);
  const overrides = await getProductPriceOverrides(session.shop);

  return {
    shop: session.shop,
    settings,
    products,
    overrides,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "save_catalog_pricing") {
    const stateCode = (formData.get("stateCode") as string) || "WB";
    const catalogTitle = (formData.get("catalogTitle") as string) || "India";
    const adjustmentType = (formData.get("adjustmentType") as "DECREASE" | "INCREASE") || "DECREASE";
    const adjustmentValue = parseFloat(formData.get("adjustmentValue") as string) || 0;
    const includeCompareAt = formData.get("includeCompareAt") === "true";
    const autoIncludeNewProducts = formData.get("autoIncludeNewProducts") === "true";
    const currency = (formData.get("currency") as string) || "INR ₹";
    const status = (formData.get("status") as string) || "ACTIVE";
    const rawOverrides = formData.get("productOverrides") as string;

    // Update state rule
    await updateStateRule(session.shop, stateCode, {
      discountType: "PERCENTAGE",
      discountValue: adjustmentValue,
      adjustmentType,
      includeCompareAt,
      autoIncludeNewProducts,
      currency,
      isActive: status === "ACTIVE",
      customMessage:
        adjustmentValue > 0
          ? `${stateCode === "WB" ? "West Bengal" : stateCode} Regional Price`
          : null,
    });

    // Save product price overrides
    if (rawOverrides) {
      try {
        const overridesList = JSON.parse(rawOverrides);
        if (Array.isArray(overridesList)) {
          await saveProductPriceOverrides(session.shop, stateCode, overridesList);
        }
      } catch (err) {
        console.error("Error parsing product overrides:", err);
      }
    }

    // Auto-sync with Shopify Function & native PriceList
    await syncDiscountWithShopify(admin, session.shop);
    await syncPriceListWithShopify(admin, session.shop, stateCode, {
      catalogName: catalogTitle,
      adjustmentType,
      adjustmentValue,
      currency,
    });

    return {
      success: true,
      message: `Successfully saved pricing adjustments & product overrides for ${catalogTitle}!`,
    };
  }

  if (intent === "update_rule") {
    const stateCode = formData.get("stateCode") as string;
    const discountType = formData.get("discountType") as "PERCENTAGE" | "FIXED_AMOUNT";
    const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
    const minOrderAmountStr = formData.get("minOrderAmount") as string;
    const minOrderAmount = minOrderAmountStr ? parseFloat(minOrderAmountStr) : null;
    const isActive = formData.get("isActive") === "true";
    const customMessage = (formData.get("customMessage") as string) || null;

    await updateStateRule(session.shop, stateCode, {
      discountType,
      discountValue,
      minOrderAmount,
      isActive,
      customMessage,
    });

    await syncDiscountWithShopify(admin, session.shop);

    return { success: true, message: `Updated rule for ${stateCode}` };
  }

  if (intent === "update_settings") {
    const isEnabled = formData.get("isEnabled") === "true";
    const discountTitle = (formData.get("discountTitle") as string) || "Regional State Pricing (India)";
    const widgetPosition = (formData.get("widgetPosition") as string) || "bottom-right";
    const bannerMessage = (formData.get("bannerMessage") as string) || "";
    const accentColor = (formData.get("accentColor") as string) || "#2563eb";

    await updateShopSettings(session.shop, {
      isEnabled,
      discountTitle,
      widgetPosition,
      bannerMessage,
      accentColor,
    });

    await syncDiscountWithShopify(admin, session.shop);

    return { success: true, message: "Shop settings updated and synced." };
  }

  if (intent === "quick_wb_50") {
    await updateStateRule(session.shop, "WB", {
      discountType: "PERCENTAGE",
      discountValue: 50.0,
      adjustmentType: "DECREASE",
      includeCompareAt: true,
      isActive: true,
      customMessage: "West Bengal Regional Price",
    });

    await syncDiscountWithShopify(admin, session.shop);

    return { success: true, message: "West Bengal base price set to 50% decrease!" };
  }

  if (intent === "sync_shopify") {
    const result = await syncDiscountWithShopify(admin, session.shop);
    return {
      success: result.success,
      message: result.success
        ? "Successfully synced discount with Shopify Functions!"
        : `Sync notice: ${result.error}`,
      error: result.error,
    };
  }

  return { success: false, message: "Unknown action" };
};

export default function RegionalDiscountsPage() {
  const { shop, settings, products, overrides } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  // Selected State / Catalog
  const [selectedStateCode, setSelectedStateCode] = useState<string>("WB");
  const selectedRule = useMemo(() => {
    return (
      settings.rules?.find((r: any) => r.stateCode === selectedStateCode) ||
      settings.rules?.[0] || {
        stateCode: "WB",
        stateName: "West Bengal",
        discountValue: 50,
        adjustmentType: "DECREASE",
        includeCompareAt: true,
        autoIncludeNewProducts: true,
        currency: "INR ₹",
        isActive: true,
      }
    );
  }, [settings.rules, selectedStateCode]);

  // Catalog Header State
  const [catalogTitle, setCatalogTitle] = useState<string>("India");
  const [catalogStatus, setCatalogStatus] = useState<"ACTIVE" | "DRAFT">("ACTIVE");

  // Pricing Adjustment State (The exact fields from Attachment)
  const [currency, setCurrency] = useState<string>("INR ₹");
  const [adjustmentValue, setAdjustmentValue] = useState<number>(50);
  const [adjustmentType, setAdjustmentType] = useState<"DECREASE" | "INCREASE">("DECREASE");
  const [includeCompareAt, setIncludeCompareAt] = useState<boolean>(true);

  // Products Section State
  const [autoIncludeNewProducts, setAutoIncludeNewProducts] = useState<boolean>(true);
  const [productTab, setProductTab] = useState<"included" | "excluded" | "all">("included");
  const [productSearch, setProductSearch] = useState<string>("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Product price overrides map: productId -> { customPrice, customCompareAtPrice, isIncluded }
  const [productPrices, setProductPrices] = useState<
    Record<string, { customPrice: string; customCompareAtPrice: string; isIncluded: boolean }>
  >({});

  // Sync state when selected state changes
  useEffect(() => {
    if (selectedRule) {
      setAdjustmentValue(selectedRule.discountValue ?? (selectedStateCode === "WB" ? 50 : 0));
      setAdjustmentType((selectedRule.adjustmentType as "DECREASE" | "INCREASE") || "DECREASE");
      setIncludeCompareAt(selectedRule.includeCompareAt !== false);
      setAutoIncludeNewProducts(selectedRule.autoIncludeNewProducts !== false);
      setCurrency(selectedRule.currency || "INR ₹");
      setCatalogStatus(selectedRule.isActive ? "ACTIVE" : "DRAFT");
      setCatalogTitle(selectedRule.stateName || "India");

      // Initialize product prices for this state
      const initialPrices: Record<
        string,
        { customPrice: string; customCompareAtPrice: string; isIncluded: boolean }
      > = {};

      products.forEach((p: any) => {
        const existingOverride = overrides?.find(
          (o: any) => o.stateCode === selectedStateCode && o.productId === p.id
        );

        if (existingOverride) {
          initialPrices[p.id] = {
            customPrice: existingOverride.customPrice != null ? existingOverride.customPrice.toString() : "",
            customCompareAtPrice:
              existingOverride.customCompareAtPrice != null
                ? existingOverride.customCompareAtPrice.toString()
                : "",
            isIncluded: existingOverride.isIncluded !== false,
          };
        } else {
          // Compute default dynamic adjusted price
          const disc = selectedRule.discountValue || (selectedStateCode === "WB" ? 50 : 0);
          const adjType = selectedRule.adjustmentType || "DECREASE";
          let computedPrice = p.defaultPrice;
          if (disc > 0) {
            computedPrice =
              adjType === "DECREASE"
                ? p.defaultPrice * (1 - disc / 100)
                : p.defaultPrice * (1 + disc / 100);
          }

          initialPrices[p.id] = {
            customPrice: computedPrice.toFixed(2),
            customCompareAtPrice: p.defaultCompareAtPrice ? p.defaultCompareAtPrice.toFixed(2) : "",
            isIncluded: true,
          };
        }
      });

      setProductPrices(initialPrices);
    }
  }, [selectedRule, selectedStateCode, products, overrides]);

  // Recalculate default prices if merchant changes base adjustment value
  const handleAdjustmentChange = (newVal: number, newType: "DECREASE" | "INCREASE") => {
    setAdjustmentValue(newVal);
    setAdjustmentType(newType);

    setProductPrices((prev) => {
      const updated = { ...prev };
      products.forEach((p: any) => {
        let computedPrice = p.defaultPrice;
        if (newVal > 0) {
          computedPrice =
            newType === "DECREASE"
              ? p.defaultPrice * (1 - newVal / 100)
              : p.defaultPrice * (1 + newVal / 100);
        }
        updated[p.id] = {
          ...updated[p.id],
          customPrice: computedPrice.toFixed(2),
        };
      });
      return updated;
    });
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const matchesSearch = p.title.toLowerCase().includes(productSearch.toLowerCase());
      if (!matchesSearch) return false;

      const stateInfo = productPrices[p.id];
      const isInc = stateInfo ? stateInfo.isIncluded !== false : true;

      if (productTab === "included") return isInc;
      if (productTab === "excluded") return !isInc;
      return true;
    });
  }, [products, productSearch, productTab, productPrices]);

  // Handle Save
  const handleSaveCatalog = () => {
    const overridesList = Object.entries(productPrices).map(([prodId, val]) => {
      const prod = products.find((p: any) => p.id === prodId);
      return {
        productId: prodId,
        productTitle: prod?.title || "Product",
        imageUrl: prod?.imageUrl || null,
        customPrice: val.customPrice ? parseFloat(val.customPrice) : null,
        customCompareAtPrice: val.customCompareAtPrice ? parseFloat(val.customCompareAtPrice) : null,
        isIncluded: val.isIncluded,
      };
    });

    fetcher.submit(
      {
        intent: "save_catalog_pricing",
        stateCode: selectedStateCode,
        catalogTitle,
        adjustmentType,
        adjustmentValue: adjustmentValue.toString(),
        includeCompareAt: includeCompareAt ? "true" : "false",
        autoIncludeNewProducts: autoIncludeNewProducts ? "true" : "false",
        currency,
        status: catalogStatus,
        productOverrides: JSON.stringify(overridesList),
      },
      { method: "POST" }
    );
  };

  const isSubmitting = fetcher.state !== "idle";

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "20px 16px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: "#202223" }}>
      
      {/* Top Banner Notice */}
      {fetcher.data?.message && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "14px", color: "#166534", fontWeight: 500 }}>
            ✅ {fetcher.data.message}
          </span>
        </div>
      )}

      {/* State Catalog Picker Bar */}
      <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>🇮🇳</span>
          <span style={{ fontWeight: 600, fontSize: "14px" }}>Select Regional Catalog:</span>
          <select
            value={selectedStateCode}
            onChange={(e) => setSelectedStateCode(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #c9cccf", background: "#f6f6f7", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
          >
            {(settings.rules || []).map((r: any) => (
              <option key={r.stateCode} value={r.stateCode}>
                {r.stateName} {r.discountValue > 0 ? `(${r.discountValue}% ${r.adjustmentType === 'INCREASE' ? 'Increase' : 'OFF'})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => fetcher.submit({ intent: "sync_shopify" }, { method: "POST" })}
            style={{ background: "#f6f6f7", border: "1px solid #c9cccf", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
          >
            🔄 Sync Shopify Function
          </button>
          <button
            type="button"
            onClick={handleSaveCatalog}
            disabled={isSubmitting}
            style={{ background: "#008060", color: "#ffffff", border: "none", padding: "6px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 0 rgba(0,0,0,0.08)" }}
          >
            {isSubmitting ? "Saving..." : "Save Catalog"}
          </button>
        </div>
      </div>

      {/* 1. Header Card: Breadcrumb, Title & Markets (Exactly like Attachment) */}
      <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "10px", padding: "20px", marginBottom: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#6d7175", marginBottom: "16px", fontWeight: 500 }}>
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span style={{ color: "#202223", fontWeight: 600 }}>New catalog</span>
        </div>

        {/* Title Input Row */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#6d7175", marginBottom: "6px" }}>
            Title
          </label>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="text"
                value={catalogTitle}
                onChange={(e) => setCatalogTitle(e.target.value)}
                maxLength={255}
                style={{
                  width: "100%",
                  padding: "10px 60px 10px 14px",
                  borderRadius: "8px",
                  border: "1.5px solid #7c3aed",
                  boxShadow: "0 0 0 1px #7c3aed",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "#7c3aed", fontWeight: 500 }}>
                {catalogTitle.length}/255
              </span>
            </div>

            {/* Active / Draft Dropdown */}
            <select
              value={catalogStatus}
              onChange={(e) => setCatalogStatus(e.target.value as any)}
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #c9cccf",
                background: "#ffffff",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
        </div>

        {/* Markets Tag Row */}
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#6d7175", marginBottom: "6px" }}>
            Markets ⇅
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "10px 14px", border: "1px solid #e1e3e5", borderRadius: "8px", background: "#fcfdfd" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#f1f2f4", border: "1px solid #d2d5d8", padding: "4px 10px", borderRadius: "20px", fontSize: "13px", color: "#202223" }}>
              <span>🌐</span>
              <span>{selectedRule.stateName || "India"}</span>
              <span style={{ cursor: "pointer", fontSize: "14px", marginLeft: "2px", color: "#6d7175" }}>✕</span>
            </span>
            <button
              type="button"
              style={{ border: "1px dashed #c9cccf", background: "transparent", borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#6d7175", cursor: "pointer" }}
              title="Add Market / State"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 2. PRICING ADJUSTMENT CARD (The Exact Red-Boxed section from Attachment) */}
      <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "10px", padding: "20px", marginBottom: "16px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 16px 0", color: "#202223" }}>
          Pricing
        </h3>

        <div style={{ border: "1px solid #e1e3e5", borderRadius: "8px", overflow: "hidden" }}>
          {/* Row 1: Set prices in */}
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f2f4" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#202223" }}>Set prices in</span>
              <span
                style={{ cursor: "help", color: "#6d7175", fontSize: "14px", display: "inline-flex", alignItems: "center" }}
                title="Store currency used for pricing adjustments and product overrides"
              >
                ⓘ
              </span>
            </div>

            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{
                minWidth: "220px",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #c9cccf",
                background: "#ffffff",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <option value="INR ₹">Store currency (INR ₹)</option>
              <option value="USD $">US Dollar (USD $)</option>
              <option value="EUR €">Euro (EUR €)</option>
              <option value="GBP £">British Pound (GBP £)</option>
            </select>
          </div>

          {/* Row 2: Price adjustment */}
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#202223" }}>
              Price adjustment
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
              {/* Adjustment Input Group: [-] [ 0 % ] [ Decrease v ] */}
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #c9cccf", borderRadius: "6px", overflow: "hidden" }}>
                <span style={{ background: "#f6f6f7", padding: "8px 12px", fontSize: "14px", fontWeight: 600, color: "#6d7175", borderRight: "1px solid #e1e3e5" }}>
                  {adjustmentType === "DECREASE" ? "–" : "+"}
                </span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={adjustmentValue}
                  onChange={(e) => handleAdjustmentChange(parseFloat(e.target.value) || 0, adjustmentType)}
                  style={{
                    width: "60px",
                    border: "none",
                    padding: "8px 8px",
                    textAlign: "right",
                    fontSize: "14px",
                    outline: "none",
                    fontWeight: 600,
                  }}
                />
                <span style={{ background: "#ffffff", padding: "8px 6px 8px 0", fontSize: "13px", color: "#6d7175" }}>
                  %
                </span>
                <select
                  value={adjustmentType}
                  onChange={(e) => handleAdjustmentChange(adjustmentValue, e.target.value as any)}
                  style={{
                    border: "none",
                    borderLeft: "1px solid #e1e3e5",
                    background: "#f6f6f7",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="DECREASE">Decrease</option>
                  <option value="INCREASE">Increase</option>
                </select>
              </div>

              {/* Include compare-at price Toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", color: "#202223", userSelect: "none" }}>
                <div
                  onClick={() => setIncludeCompareAt(!includeCompareAt)}
                  style={{
                    width: "38px",
                    height: "22px",
                    background: includeCompareAt ? "#202223" : "#c9cccf",
                    borderRadius: "12px",
                    position: "relative",
                    transition: "background 0.2s",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      background: "#ffffff",
                      borderRadius: "50%",
                      position: "absolute",
                      top: "3px",
                      left: includeCompareAt ? "19px" : "3px",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    }}
                  />
                </div>
                <span>Include compare-at price</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PRODUCTS CATALOG TABLE (Exactly matching Attachment) */}
      <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "10px", padding: "20px", marginBottom: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        
        {/* Products Header Row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#202223" }}>
            Products
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Auto include new products toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#202223", userSelect: "none" }}>
              <div
                onClick={() => setAutoIncludeNewProducts(!autoIncludeNewProducts)}
                style={{
                  width: "36px",
                  height: "20px",
                  background: autoIncludeNewProducts ? "#202223" : "#c9cccf",
                  borderRadius: "10px",
                  position: "relative",
                  transition: "background 0.2s",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    background: "#ffffff",
                    borderRadius: "50%",
                    position: "absolute",
                    top: "3px",
                    left: autoIncludeNewProducts ? "19px" : "3px",
                    transition: "left 0.2s",
                  }}
                />
              </div>
              <span>Automatically include new products</span>
            </label>

            {/* Action Buttons: Export & Import */}
            <button
              type="button"
              style={{ background: "#f6f6f7", border: "1px solid #c9cccf", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", color: "#202223", cursor: "pointer" }}
            >
              Export
            </button>
            <button
              type="button"
              style={{ background: "#f6f6f7", border: "1px solid #c9cccf", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", color: "#202223", cursor: "pointer" }}
            >
              Import
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e1e3e5", paddingBottom: "10px", marginBottom: "14px", flexWrap: "wrap", gap: "12px" }}>
          {/* Tabs: Included | Excluded | All */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setProductTab("included")}
              style={{
                background: productTab === "included" ? "#f1f2f4" : "transparent",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: productTab === "included" ? 600 : 400,
                color: "#202223",
                cursor: "pointer",
              }}
            >
              Included
            </button>
            <button
              type="button"
              onClick={() => setProductTab("excluded")}
              style={{
                background: productTab === "excluded" ? "#f1f2f4" : "transparent",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: productTab === "excluded" ? 600 : 400,
                color: "#202223",
                cursor: "pointer",
              }}
            >
              Excluded
            </button>
            <button
              type="button"
              onClick={() => setProductTab("all")}
              style={{
                background: productTab === "all" ? "#f1f2f4" : "transparent",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: productTab === "all" ? 600 : 400,
                color: "#202223",
                cursor: "pointer",
              }}
            >
              All
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{
                  padding: "6px 12px 6px 28px",
                  borderRadius: "6px",
                  border: "1px solid #c9cccf",
                  fontSize: "13px",
                  width: "180px",
                }}
              />
              <span style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#8c9196", fontSize: "12px" }}>
                🔍
              </span>
            </div>
            <button
              type="button"
              style={{ background: "#ffffff", border: "1px solid #c9cccf", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
              title="Filter & Sort"
            >
              ⇅
            </button>
          </div>
        </div>

        {/* Product Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e1e3e5", color: "#6d7175" }}>
                <th style={{ padding: "10px 12px", width: "36px" }}>
                  <input
                    type="checkbox"
                    checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProductIds(filteredProducts.map((p: any) => p.id));
                      } else {
                        setSelectedProductIds([]);
                      }
                    }}
                  />
                </th>
                <th style={{ padding: "10px 12px", fontWeight: 600 }}>Product ⇅</th>
                <th style={{ padding: "10px 12px", fontWeight: 600, width: "180px" }}>Price in INR</th>
                <th style={{ padding: "10px 12px", fontWeight: 600, width: "180px" }}>Compare at price</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product: any) => {
                const isSelected = selectedProductIds.includes(product.id);
                const priceInfo = productPrices[product.id] || {
                  customPrice: (product.defaultPrice * (1 - adjustmentValue / 100)).toFixed(2),
                  customCompareAtPrice: product.defaultCompareAtPrice ? product.defaultCompareAtPrice.toFixed(2) : "",
                  isIncluded: true,
                };

                return (
                  <tr
                    key={product.id}
                    style={{
                      borderBottom: "1px solid #f1f2f4",
                      background: isSelected ? "#f9fafb" : "transparent",
                    }}
                  >
                    {/* Selection Checkbox */}
                    <td style={{ padding: "12px 12px" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductIds([...selectedProductIds, product.id]);
                          } else {
                            setSelectedProductIds(selectedProductIds.filter((id) => id !== product.id));
                          }
                        }}
                      />
                    </td>

                    {/* Product Image & Details */}
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          style={{
                            width: "44px",
                            height: "44px",
                            objectFit: "cover",
                            borderRadius: "6px",
                            border: "1px solid #e1e3e5",
                            background: "#f6f6f7",
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: "#202223" }}>{product.title}</div>
                          <div style={{ fontSize: "12px", color: "#6d7175", marginTop: "2px" }}>
                            {product.subtitle || (product.variantCount > 1 ? `${product.variantCount} variants` : "Standard")}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Price in INR */}
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #c9cccf", borderRadius: "6px", overflow: "hidden", background: "#ffffff", maxWidth: "140px" }}>
                        <span style={{ padding: "6px 8px", background: "#f6f6f7", color: "#6d7175", fontSize: "13px", borderRight: "1px solid #e1e3e5" }}>
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={priceInfo.customPrice}
                          onChange={(e) => {
                            const val = e.target.value;
                            setProductPrices((prev) => ({
                              ...prev,
                              [product.id]: {
                                ...prev[product.id],
                                customPrice: val,
                              },
                            }));
                          }}
                          style={{
                            border: "none",
                            padding: "6px 8px",
                            width: "100%",
                            fontSize: "13px",
                            outline: "none",
                          }}
                        />
                      </div>
                    </td>

                    {/* Compare at price */}
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #c9cccf", borderRadius: "6px", overflow: "hidden", background: "#ffffff", maxWidth: "140px" }}>
                        <span style={{ padding: "6px 8px", background: "#f6f6f7", color: "#6d7175", fontSize: "13px", borderRight: "1px solid #e1e3e5" }}>
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder=""
                          value={priceInfo.customCompareAtPrice}
                          onChange={(e) => {
                            const val = e.target.value;
                            setProductPrices((prev) => ({
                              ...prev,
                              [product.id]: {
                                ...prev[product.id],
                                customCompareAtPrice: val,
                              },
                            }));
                          }}
                          style={{
                            border: "none",
                            padding: "6px 8px",
                            width: "100%",
                            fontSize: "13px",
                            outline: "none",
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Bar */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #e1e3e5" }}>
          <button
            type="button"
            onClick={() => fetcher.submit({ intent: "quick_wb_50" }, { method: "POST" })}
            style={{ background: "#f6f6f7", border: "1px solid #c9cccf", padding: "8px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
          >
            Reset WB to 50%
          </button>
          <button
            type="button"
            onClick={handleSaveCatalog}
            disabled={isSubmitting}
            style={{
              background: "#008060",
              color: "#ffffff",
              border: "none",
              padding: "8px 20px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 0 rgba(0,0,0,0.1)",
            }}
          >
            {isSubmitting ? "Saving..." : "Save Catalog Changes"}
          </button>
        </div>
      </div>

      {/* 4. Live Base Regional Price Simulator */}
      <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "10px", padding: "20px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px 0", color: "#202223" }}>
          🧪 Live Base Regional Price Engine Preview
        </h3>
        <p style={{ fontSize: "13px", color: "#6d7175", margin: "0 0 16px 0" }}>
          Live verification of how product base prices are modified natively across Indian states:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", background: "#f6f6f7", padding: "16px", borderRadius: "8px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6d7175", marginBottom: "4px" }}>
              Active Catalog State:
            </label>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#202223" }}>
              {selectedRule.stateName} ({selectedStateCode})
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6d7175", marginBottom: "4px" }}>
              Base Price Change:
            </label>
            <div style={{ fontSize: "14px", fontWeight: 700, color: adjustmentValue > 0 ? (adjustmentType === "DECREASE" ? "#008060" : "#b45309") : "#6d7175" }}>
              {adjustmentValue > 0 ? `${adjustmentType === "DECREASE" ? "–" : "+"}${adjustmentValue}% (Base Price Modified)` : "Standard Price (No Change)"}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6d7175", marginBottom: "4px" }}>
              Storefront Display Mode:
            </label>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#202223" }}>
              Native Original Price (No Discount Badges) ✅
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6d7175", marginBottom: "4px" }}>
              Shopify Function Status:
            </label>
            <div style={{ fontSize: "14px", fontWeight: 600, color: settings.discountId ? "#008060" : "#b45309" }}>
              {settings.discountId ? "Active & Synced ✅" : "Pending Auto-Sync ⚠️"}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
