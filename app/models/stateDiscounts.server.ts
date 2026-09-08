import prisma from "../db.server";

export interface IndiaStateSeed {
  code: string;
  name: string;
  defaultDiscount: number;
  discountType?: "PERCENTAGE" | "FIXED_AMOUNT";
  isActive?: boolean;
}

export const INDIA_STATES: IndiaStateSeed[] = [
  { code: "WB", name: "West Bengal", defaultDiscount: 50.0, isActive: true },
  { code: "MH", name: "Maharashtra", defaultDiscount: 0.0, isActive: true },
  { code: "DL", name: "Delhi", defaultDiscount: 0.0, isActive: true },
  { code: "KA", name: "Karnataka", defaultDiscount: 0.0, isActive: true },
  { code: "TN", name: "Tamil Nadu", defaultDiscount: 0.0, isActive: true },
  { code: "UP", name: "Uttar Pradesh", defaultDiscount: 0.0, isActive: true },
  { code: "GJ", name: "Gujarat", defaultDiscount: 0.0, isActive: true },
  { code: "AP", name: "Andhra Pradesh", defaultDiscount: 0.0, isActive: true },
  { code: "AR", name: "Arunachal Pradesh", defaultDiscount: 0.0, isActive: true },
  { code: "AS", name: "Assam", defaultDiscount: 0.0, isActive: true },
  { code: "BR", name: "Bihar", defaultDiscount: 0.0, isActive: true },
  { code: "CG", name: "Chhattisgarh", defaultDiscount: 0.0, isActive: true },
  { code: "GA", name: "Goa", defaultDiscount: 0.0, isActive: true },
  { code: "HR", name: "Haryana", defaultDiscount: 0.0, isActive: true },
  { code: "HP", name: "Himachal Pradesh", defaultDiscount: 0.0, isActive: true },
  { code: "JH", name: "Jharkhand", defaultDiscount: 0.0, isActive: true },
  { code: "KL", name: "Kerala", defaultDiscount: 0.0, isActive: true },
  { code: "MP", name: "Madhya Pradesh", defaultDiscount: 0.0, isActive: true },
  { code: "MN", name: "Manipur", defaultDiscount: 0.0, isActive: true },
  { code: "ML", name: "Meghalaya", defaultDiscount: 0.0, isActive: true },
  { code: "MZ", name: "Mizoram", defaultDiscount: 0.0, isActive: true },
  { code: "NL", name: "Nagaland", defaultDiscount: 0.0, isActive: true },
  { code: "OD", name: "Odisha", defaultDiscount: 0.0, isActive: true },
  { code: "PB", name: "Punjab", defaultDiscount: 0.0, isActive: true },
  { code: "RJ", name: "Rajasthan", defaultDiscount: 0.0, isActive: true },
  { code: "SK", name: "Sikkim", defaultDiscount: 0.0, isActive: true },
  { code: "TS", name: "Telangana", defaultDiscount: 0.0, isActive: true },
  { code: "TR", name: "Tripura", defaultDiscount: 0.0, isActive: true },
  { code: "UK", name: "Uttarakhand", defaultDiscount: 0.0, isActive: true },
  // Union Territories
  { code: "AN", name: "Andaman and Nicobar Islands", defaultDiscount: 0.0, isActive: true },
  { code: "CH", name: "Chandigarh", defaultDiscount: 0.0, isActive: true },
  { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu", defaultDiscount: 0.0, isActive: true },
  { code: "JK", name: "Jammu and Kashmir", defaultDiscount: 0.0, isActive: true },
  { code: "LA", name: "Ladakh", defaultDiscount: 0.0, isActive: true },
  { code: "LD", name: "Lakshadweep", defaultDiscount: 0.0, isActive: true },
  { code: "PY", name: "Puducherry", defaultDiscount: 0.0, isActive: true },
];

export async function getOrCreateShopDiscountSettings(shop: string) {
  let setting = await prisma.shopDiscountSetting.findUnique({
    where: { shop },
    include: {
      rules: {
        orderBy: { stateName: "asc" },
      },
    },
  });

  if (!setting) {
    setting = await prisma.shopDiscountSetting.create({
      data: {
        shop,
        isEnabled: true,
        discountTitle: "Regional State Discount (India)",
        widgetPosition: "bottom-right",
        bannerMessage: "🎉 Exclusive regional discounts available! Select your state.",
        accentColor: "#2563eb",
        rules: {
          create: INDIA_STATES.map((state) => ({
            shop,
            stateCode: state.code,
            stateName: state.name,
            discountType: state.discountType || "PERCENTAGE",
            discountValue: state.defaultDiscount,
            isActive: state.isActive !== false,
            customMessage:
              state.defaultDiscount > 0
                ? `${state.name} Special (${state.defaultDiscount}% OFF)`
                : null,
          })),
        },
      },
      include: {
        rules: {
          orderBy: { stateName: "asc" },
        },
      },
    });
  }

  return setting;
}

export async function updateStateRule(
  shop: string,
  stateCode: string,
  data: {
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue?: number;
    minOrderAmount?: number | null;
    isActive?: boolean;
    customMessage?: string | null;
  }
) {
  const rule = await prisma.stateDiscountRule.update({
    where: {
      shop_stateCode: {
        shop,
        stateCode,
      },
    },
    data,
  });

  return rule;
}

export async function updateShopSettings(
  shop: string,
  data: {
    isEnabled?: boolean;
    discountTitle?: string;
    widgetPosition?: string;
    bannerMessage?: string;
    accentColor?: string;
  }
) {
  return prisma.shopDiscountSetting.update({
    where: { shop },
    data,
    include: {
      rules: {
        orderBy: { stateName: "asc" },
      },
    },
  });
}

/**
 * Generates the JSON configuration payload needed by the Shopify Function metafield
 */
export function buildFunctionConfiguration(setting: {
  isEnabled: boolean;
  discountTitle: string;
  rules: Array<{
    stateCode: string;
    stateName: string;
    discountType: string;
    discountValue: number;
    minOrderAmount: number | null;
    isActive: boolean;
    customMessage: string | null;
  }>;
}) {
  return {
    isEnabled: setting.isEnabled,
    defaultDiscountTitle: setting.discountTitle,
    rules: setting.rules.map((r) => ({
      stateCode: r.stateCode,
      stateName: r.stateName,
      discountType: r.discountType as "PERCENTAGE" | "FIXED_AMOUNT",
      discountValue: r.discountValue,
      minOrderAmount: r.minOrderAmount,
      isActive: r.isActive,
      customMessage: r.customMessage,
    })),
  };
}

/**
 * Syncs the Discount and Metafield configuration to Shopify via GraphQL Admin API
 */
export async function syncDiscountWithShopify(
  admin: any,
  shop: string
): Promise<{ success: boolean; discountId?: string; error?: string }> {
  try {
    const settings = await getOrCreateShopDiscountSettings(shop);
    const configJson = JSON.stringify(buildFunctionConfiguration(settings));

    // 1. Fetch available shopify functions to find regional-discount-fn functionId
    const functionsQuery = await admin.graphql(
      `#graphql
      query getShopifyFunctions {
        shopifyFunctions(first: 25) {
          nodes {
            id
            title
            apiType
          }
        }
      }`
    );
    const functionsJson = await functionsQuery.json();
    const functionNodes = functionsJson.data?.shopifyFunctions?.nodes || [];
    const discountFunction =
      functionNodes.find((fn: any) => fn.title?.includes("regional-discount") || fn.apiType === "order_discounts") ||
      functionNodes[0];

    const functionId = discountFunction?.id;

    if (!functionId) {
      return {
        success: false,
        error: "Shopify Function 'regional-discount-fn' not found on the store. Please deploy your app extensions first with 'shopify app deploy'.",
      };
    }

    // 2. Check if we already have an existing discount registered or need to create one
    if (settings.discountId) {
      // Update existing discount automatic app
      const updateMutation = await admin.graphql(
        `#graphql
        mutation discountAutomaticAppUpdate($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
          discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
            automaticAppDiscount {
              discountId
              title
              status
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            id: settings.discountId,
            automaticAppDiscount: {
              title: settings.discountTitle,
              startsAt: new Date().toISOString(),
              metafields: [
                {
                  namespace: "$app:regional-discount-fn",
                  key: "function-configuration",
                  type: "json",
                  value: configJson,
                },
              ],
            },
          },
        }
      );

      const updateJson = await updateMutation.json();
      const userErrors = updateJson.data?.discountAutomaticAppUpdate?.userErrors;

      if (!userErrors || userErrors.length === 0) {
        return { success: true, discountId: settings.discountId };
      }
      // If error (e.g. ID not found anymore), we will fall through to create a new one
    }

    // 3. Create a new Automatic App Discount
    const createMutation = await admin.graphql(
      `#graphql
      mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
          automaticAppDiscount {
            discountId
            title
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          automaticAppDiscount: {
            title: settings.discountTitle,
            functionId,
            startsAt: new Date().toISOString(),
            metafields: [
              {
                namespace: "$app:regional-discount-fn",
                key: "function-configuration",
                type: "json",
                value: configJson,
              },
            ],
          },
        },
      }
    );

    const createJson = await createMutation.json();
    const createErrors = createJson.data?.discountAutomaticAppCreate?.userErrors;

    if (createErrors && createErrors.length > 0) {
      return {
        success: false,
        error: createErrors.map((e: any) => e.message).join(", "),
      };
    }

    const createdDiscountId =
      createJson.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;

    if (createdDiscountId) {
      await prisma.shopDiscountSetting.update({
        where: { shop },
        data: { discountId: createdDiscountId },
      });
      return { success: true, discountId: createdDiscountId };
    }

    return { success: false, error: "Unable to create discount automatic app." };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to sync discount with Shopify." };
  }
}
