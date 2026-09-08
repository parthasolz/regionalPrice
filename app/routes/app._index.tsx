import { useState, useMemo } from "react";
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

  return {
    shop: session.shop,
    settings,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

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

    // Auto sync discount metadata with Shopify
    await syncDiscountWithShopify(admin, session.shop);

    return { success: true, message: `Updated rule for ${stateCode}` };
  }

  if (intent === "update_settings") {
    const isEnabled = formData.get("isEnabled") === "true";
    const discountTitle = (formData.get("discountTitle") as string) || "Regional State Discount (India)";
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
      isActive: true,
      customMessage: "West Bengal Special (50% OFF)",
    });

    await syncDiscountWithShopify(admin, session.shop);

    return { success: true, message: "West Bengal set to 50% OFF!" };
  }

  if (intent === "bulk_apply") {
    const bulkDiscount = parseFloat(formData.get("bulkDiscount") as string) || 0;
    const settings = await getOrCreateShopDiscountSettings(session.shop);

    for (const rule of settings.rules) {
      // Don't overwrite WB if merchant wants to preserve WB 50%
      if (rule.stateCode === "WB" && rule.discountValue === 50) continue;

      await updateStateRule(session.shop, rule.stateCode, {
        discountValue: bulkDiscount,
        isActive: true,
      });
    }

    await syncDiscountWithShopify(admin, session.shop);

    return { success: true, message: `Applied ${bulkDiscount}% discount to other states.` };
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
  const { shop, settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "discounted" | "zero">("all");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editMinOrder, setEditMinOrder] = useState<string>("");
  const [editType, setEditType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");

  // Simulator State
  const [simState, setSimState] = useState("West Bengal");
  const [simSubtotal, setSimSubtotal] = useState("1000");

  const isSubmitting = fetcher.state !== "idle";

  const filteredRules = useMemo(() => {
    return (settings.rules || []).filter((rule) => {
      const matchesSearch =
        rule.stateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.stateCode.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterTab === "discounted") {
        return rule.discountValue > 0 && rule.isActive;
      }
      if (filterTab === "zero") {
        return rule.discountValue === 0 || !rule.isActive;
      }
      return true;
    });
  }, [settings.rules, searchQuery, filterTab]);

  // West Bengal Rule
  const wbRule = useMemo(() => {
    return settings.rules?.find((r) => r.stateCode === "WB");
  }, [settings.rules]);

  // Simulator calculation
  const simResult = useMemo(() => {
    const subtotal = parseFloat(simSubtotal) || 0;
    const rule = settings.rules?.find(
      (r) =>
        r.stateName.toLowerCase() === simState.toLowerCase() ||
        r.stateCode.toLowerCase() === simState.toLowerCase()
    );

    if (!settings.isEnabled) {
      return { discount: 0, final: subtotal, reason: "Discount globally disabled" };
    }
    if (!rule || !rule.isActive || rule.discountValue <= 0) {
      return { discount: 0, final: subtotal, reason: "No active discount for this state" };
    }
    if (rule.minOrderAmount && subtotal < rule.minOrderAmount) {
      return {
        discount: 0,
        final: subtotal,
        reason: `Subtotal ₹${subtotal} is below minimum requirement of ₹${rule.minOrderAmount}`,
      };
    }

    let discountAmount = 0;
    if (rule.discountType === "FIXED_AMOUNT") {
      discountAmount = Math.min(rule.discountValue, subtotal);
    } else {
      discountAmount = (subtotal * rule.discountValue) / 100;
    }

    return {
      discount: discountAmount,
      final: Math.max(0, subtotal - discountAmount),
      percent: rule.discountValue,
      type: rule.discountType,
      message: rule.customMessage || `${rule.stateName} Discount`,
    };
  }, [simState, simSubtotal, settings]);

  const handleStartEdit = (rule: (typeof settings.rules)[0]) => {
    setEditingCode(rule.stateCode);
    setEditValue(rule.discountValue.toString());
    setEditMinOrder(rule.minOrderAmount?.toString() || "");
    setEditType((rule.discountType as "PERCENTAGE" | "FIXED_AMOUNT") || "PERCENTAGE");
  };

  const handleSaveEdit = (rule: (typeof settings.rules)[0]) => {
    fetcher.submit(
      {
        intent: "update_rule",
        stateCode: rule.stateCode,
        discountValue: editValue,
        discountType: editType,
        minOrderAmount: editMinOrder,
        isActive: rule.isActive ? "true" : "false",
        customMessage: `${rule.stateName} Special (${editValue}${editType === "PERCENTAGE" ? "% OFF" : "₹ OFF"})`,
      },
      { method: "POST" }
    );
    setEditingCode(null);
  };

  const handleToggleActive = (rule: (typeof settings.rules)[0]) => {
    fetcher.submit(
      {
        intent: "update_rule",
        stateCode: rule.stateCode,
        discountValue: rule.discountValue.toString(),
        discountType: rule.discountType,
        minOrderAmount: rule.minOrderAmount?.toString() || "",
        isActive: rule.isActive ? "false" : "true",
        customMessage: rule.customMessage || "",
      },
      { method: "POST" }
    );
  };

  const themeEditorUrl = `https://${shop}/admin/themes/current/editor?context=apps`;

  return (
    <s-page heading="Regional State Discounts (India)">
      <s-button
        slot="primary-action"
        onClick={() => fetcher.submit({ intent: "sync_shopify" }, { method: "POST" })}
        {...(isSubmitting ? { loading: true } : {})}
      >
        Sync Discounts with Shopify
      </s-button>

      {/* Top Banner & Status Card */}
      <s-section>
        <s-stack direction="block" gap="base">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background={settings.isEnabled ? "subdued" : "transparent"}
          >
            <s-stack direction="inline" gap="base">
              <span style={{ fontSize: "28px" }}>🇮🇳</span>
              <div style={{ flex: 1 }}>
                <s-heading>India Regional Pricing &amp; Auto-Discounts</s-heading>
                <s-paragraph>
                  Deliver localized discounts based on customer&apos;s state. Automatically evaluated by Shopify Functions at checkout without manual promo codes.
                </s-paragraph>
              </div>
              <s-stack direction="inline" gap="base">
                <s-button
                  onClick={() =>
                    fetcher.submit(
                      {
                        intent: "update_settings",
                        isEnabled: settings.isEnabled ? "false" : "true",
                        discountTitle: settings.discountTitle,
                        widgetPosition: settings.widgetPosition,
                        bannerMessage: settings.bannerMessage,
                        accentColor: settings.accentColor,
                      },
                      { method: "POST" }
                    )
                  }
                  variant={settings.isEnabled ? "primary" : "secondary"}
                >
                  {settings.isEnabled ? "Feature: ENABLED ✅" : "Feature: DISABLED ⏸️"}
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>

          {/* Feedback message */}
          {fetcher.data?.message && (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-paragraph>
                <strong>Notice:</strong> {fetcher.data.message}
              </s-paragraph>
            </s-box>
          )}
        </s-stack>
      </s-section>

      {/* West Bengal Highlight Card */}
      <s-section heading="Featured State: West Bengal (50% OFF)">
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="inline" gap="base">
            <div style={{ fontSize: "32px" }}>🏆</div>
            <div style={{ flex: 1 }}>
              <s-heading>West Bengal Regional Special</s-heading>
              <s-paragraph>
                Current configuration: <strong>{wbRule?.discountValue || 50}% OFF</strong> ({wbRule?.isActive ? "Active" : "Inactive"}).
                Customers selecting West Bengal will have this discount automatically applied on their order subtotal.
              </s-paragraph>
            </div>
            <s-stack direction="inline" gap="base">
              <s-button
                onClick={() => fetcher.submit({ intent: "quick_wb_50" }, { method: "POST" })}
                variant="primary"
              >
                Reset WB to 50% OFF
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>
      </s-section>

      {/* Live Discount Calculator / Simulator */}
      <s-section heading="🧪 Live Checkout Discount Simulator">
        <s-paragraph>
          Test how the Shopify Function calculates discounts for any Indian state and cart value in real time:
        </s-paragraph>
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: "16px", alignItems: "center" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                Select State:
              </label>
              <select
                value={simState}
                onChange={(e) => setSimState(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              >
                {(settings.rules || []).map((r) => (
                  <option key={r.stateCode} value={r.stateName}>
                    {r.stateName} {r.discountValue > 0 ? `(${r.discountValue}% OFF)` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                Cart Subtotal (₹):
              </label>
              <input
                type="number"
                value={simSubtotal}
                onChange={(e) => setSimSubtotal(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>

            <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Calculated Checkout Result:</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600 }}>Discount Applied:</span>
                <span style={{ fontSize: "16px", fontWeight: 700, color: simResult.discount > 0 ? "#16a34a" : "#64748b" }}>
                  {simResult.discount > 0 ? `- ₹${simResult.discount.toFixed(2)}` : "₹0.00"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "2px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600 }}>Final Customer Pays:</span>
                <span style={{ fontSize: "18px", fontWeight: 800, color: "#1e293b" }}>
                  ₹{simResult.final.toFixed(2)}
                </span>
              </div>
              {simResult.reason && (
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                  ℹ️ {simResult.reason}
                </div>
              )}
            </div>
          </div>
        </s-box>
      </s-section>

      {/* State-by-State Rules Management Table */}
      <s-section heading="All Indian States &amp; Union Territories (36)">
        {/* Search & Filter Controls */}
        <s-stack direction="inline" gap="base">
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Search state (e.g. West Bengal, Maharashtra, Delhi...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
              }}
            />
          </div>

          <s-stack direction="inline" gap="base">

            <s-button
              variant={filterTab === "all" ? "primary" : "secondary"}
              onClick={() => setFilterTab("all")}
            >
              All (36)
            </s-button>
            <s-button
              variant={filterTab === "discounted" ? "primary" : "secondary"}
              onClick={() => setFilterTab("discounted")}
            >
              Active Discounts 🔥
            </s-button>
            <s-button
              variant={filterTab === "zero" ? "primary" : "secondary"}
              onClick={() => setFilterTab("zero")}
            >
              Standard (0%)
            </s-button>
          </s-stack>
        </s-stack>

        {/* States Table */}
        <div style={{ marginTop: "16px", overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>State / Territory</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Code</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Discount Type &amp; Value</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Min Order Amount</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => {
                const isEditing = editingCode === rule.stateCode;
                const isWestBengal = rule.stateCode === "WB";

                return (
                  <tr
                    key={rule.stateCode}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: isWestBengal ? "#f0fdf4" : isEditing ? "#eff6ff" : "transparent",
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                      {rule.stateName}
                      {isWestBengal && (
                        <span
                          style={{
                            marginLeft: "8px",
                            fontSize: "11px",
                            background: "#dcfce7",
                            color: "#166534",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 700,
                          }}
                        >
                          50% OFF ⭐
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{rule.stateCode}</td>

                    <td style={{ padding: "12px 16px" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as any)}
                            style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          >
                            <option value="PERCENTAGE">%</option>
                            <option value="FIXED_AMOUNT">₹ Flat</option>
                          </select>
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            style={{ width: "80px", padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                            min="0"
                            max={editType === "PERCENTAGE" ? "100" : "10000"}
                          />
                        </div>
                      ) : (
                        <span
                          style={{
                            fontWeight: rule.discountValue > 0 ? 700 : 400,
                            color: rule.discountValue > 0 ? "#15803d" : "#64748b",
                          }}
                        >
                          {rule.discountValue > 0
                            ? rule.discountType === "FIXED_AMOUNT"
                              ? `₹${rule.discountValue} Flat OFF`
                              : `${rule.discountValue}% OFF`
                            : "0% (No discount)"}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      {isEditing ? (
                        <input
                          type="number"
                          placeholder="None (₹0)"
                          value={editMinOrder}
                          onChange={(e) => setEditMinOrder(e.target.value)}
                          style={{ width: "90px", padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                        />
                      ) : rule.minOrderAmount ? (
                        `₹${rule.minOrderAmount}`
                      ) : (
                        <span style={{ color: "#94a3b8" }}>No min</span>
                      )}
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(rule)}
                        style={{
                          background: rule.isActive ? "#dcfce7" : "#fee2e2",
                          color: rule.isActive ? "#166534" : "#991b1b",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {rule.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {isEditing ? (
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(rule)}
                            style={{
                              background: "#2563eb",
                              color: "#fff",
                              border: "none",
                              padding: "4px 10px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCode(null)}
                            style={{
                              background: "#e2e8f0",
                              color: "#475569",
                              border: "none",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(rule)}
                          style={{
                            background: "transparent",
                            color: "#2563eb",
                            border: "1px solid #bfdbfe",
                            padding: "4px 10px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </s-section>

      {/* Storefront Setup Guide Aside */}
      <s-section slot="aside" heading="Theme Extension Setup">
        <s-paragraph>
          To display the floating state selector on your storefront:
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>
            Open the <strong>Theme Editor</strong>
          </s-list-item>
          <s-list-item>
            Navigate to <strong>App Embeds</strong> (left sidebar)
          </s-list-item>
          <s-list-item>
            Turn on <strong>State Discount Selector</strong>
          </s-list-item>
          <s-list-item>
            Click <strong>Save</strong>
          </s-list-item>
        </s-unordered-list>
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-button
            href={themeEditorUrl}
            target="_blank"
            variant="primary"
          >
            Open Theme Editor ↗
          </s-button>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="How It Works">
        <s-paragraph>
          1. <strong>Storefront:</strong> Customer chooses their state from the interactive widget or banner.
        </s-paragraph>
        <s-paragraph>
          2. <strong>Cart:</strong> Selection is saved to cart attribute <code>_customer_state</code>.
        </s-paragraph>
        <s-paragraph>
          3. <strong>Shopify Function:</strong> Server-side logic automatically applies state discount (e.g. 50% for West Bengal) at checkout.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
