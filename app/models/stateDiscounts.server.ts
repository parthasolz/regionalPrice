import prisma from "../db.server";

export interface IndiaStateSeed {
  code: string;
  name: string;
  defaultDiscount: number;
  discountType?: "PERCENTAGE" | "FIXED_AMOUNT";
  adjustmentType?: "DECREASE" | "INCREASE";
  includeCompareAt?: boolean;
  autoIncludeNewProducts?: boolean;
  currency?: string;
  isActive?: boolean;
}

export const INDIA_STATES: IndiaStateSeed[] = [
  { code: "WB", name: "West Bengal", defaultDiscount: 50.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "MH", name: "Maharashtra", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "DL", name: "Delhi", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "KA", name: "Karnataka", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "TN", name: "Tamil Nadu", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "UP", name: "Uttar Pradesh", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "GJ", name: "Gujarat", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "AP", name: "Andhra Pradesh", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "AR", name: "Arunachal Pradesh", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "AS", name: "Assam", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "BR", name: "Bihar", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "CG", name: "Chhattisgarh", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "GA", name: "Goa", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "HR", name: "Haryana", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "HP", name: "Himachal Pradesh", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "JH", name: "Jharkhand", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "KL", name: "Kerala", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "MP", name: "Madhya Pradesh", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "MN", name: "Manipur", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "ML", name: "Meghalaya", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "MZ", name: "Mizoram", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "NL", name: "Nagaland", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "OD", name: "Odisha", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "PB", name: "Punjab", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "RJ", name: "Rajasthan", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "SK", name: "Sikkim", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "TS", name: "Telangana", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "TR", name: "Tripura", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "UK", name: "Uttarakhand", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  // Union Territories
  { code: "AN", name: "Andaman and Nicobar Islands", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "CH", name: "Chandigarh", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "JK", name: "Jammu and Kashmir", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "LA", name: "Ladakh", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "LD", name: "Lakshadweep", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
  { code: "PY", name: "Puducherry", defaultDiscount: 0.0, adjustmentType: "DECREASE", includeCompareAt: true, isActive: true },
];

export const SAMPLE_PRODUCTS = [
  {
    id: "gid://shopify/Product/demo_1",
    title: "Example Perfume",
    subtitle: "Premium",
    variantCount: 1,
    imageUrl: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-collection-3_large.png",
    defaultPrice: 74.99,
    defaultCompareAtPrice: 80.00,
  },
  {
    id: "gid://shopify/Product/demo_2",
    title: 'Physical Product "The Band" T-Shirt',
    subtitle: "12 variants",
    variantCount: 12,
    imageUrl: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-collection-1_large.png",
    defaultPrice: 19.99,
    defaultCompareAtPrice: 24.99,
  },
  {
    id: "gid://shopify/Product/demo_3",
    title: "Product Puma",
    subtitle: "Footwear",
    variantCount: 3,
    imageUrl: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-collection-2_large.png",
    defaultPrice: 100.00,
    defaultCompareAtPrice: null,
  },
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
            adjustmentType: state.adjustmentType || "DECREASE",
            includeCompareAt: state.includeCompareAt !== false,
            autoIncludeNewProducts: state.autoIncludeNewProducts !== false,
            currency: state.currency || "INR ₹",
            isActive: state.isActive !== false,
            customMessage:
              state.defaultDiscount > 0
                ? `${state.name} Regional Price`
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
    adjustmentType?: "DECREASE" | "INCREASE";
    includeCompareAt?: boolean;
    autoIncludeNewProducts?: boolean;
    currency?: string;
    minOrderAmount?: number | null;
    isActive?: boolean;
    customMessage?: string | null;
  }
) {
  const rule = await (prisma.stateDiscountRule as any).update({
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

export async function getProductPriceOverrides(shop: string, stateCode?: string) {
  try {
    const where: any = { shop };
    if (stateCode) {
      where.stateCode = stateCode;
    }
    const overrides = await (prisma as any).productPriceOverride.findMany({
      where,
    });
    return overrides;
  } catch (err) {
    console.error("Error fetching product price overrides:", err);
    return [];
  }
}

export async function saveProductPriceOverrides(
  shop: string,
  stateCode: string,
  overrides: Array<{
    productId: string;
    variantId?: string | null;
    productTitle: string;
    variantTitle?: string | null;
    imageUrl?: string | null;
    customPrice?: number | null;
    customCompareAtPrice?: number | null;
    isIncluded?: boolean;
  }>
) {
  try {
    for (const item of overrides) {
      await (prisma as any).productPriceOverride.upsert({
        where: {
          shop_stateCode_productId: {
            shop,
            stateCode,
            productId: item.productId,
          },
        },
        update: {
          variantId: item.variantId,
          productTitle: item.productTitle,
          variantTitle: item.variantTitle,
          imageUrl: item.imageUrl,
          customPrice: item.customPrice,
          customCompareAtPrice: item.customCompareAtPrice,
          isIncluded: item.isIncluded !== false,
        },
        create: {
          shop,
          stateCode,
          productId: item.productId,
          variantId: item.variantId,
          productTitle: item.productTitle,
          variantTitle: item.variantTitle,
          imageUrl: item.imageUrl,
          customPrice: item.customPrice,
          customCompareAtPrice: item.customCompareAtPrice,
          isIncluded: item.isIncluded !== false,
        },
      });
    }
    return { success: true };
  } catch (err: any) {
    console.error("Error saving product price overrides:", err);
    return { success: false, error: err.message };
  }
}

export async function fetchShopProducts(admin: any) {
  try {
    const response = await admin.graphql(
      `#graphql
      query getProductsList {
        products(first: 20) {
          nodes {
            id
            title
            handle
            featuredImage {
              url
              altText
            }
            variants(first: 10) {
              nodes {
                id
                title
                price
                compareAtPrice
              }
            }
          }
        }
      }`
    );

    const json = await response.json();
    const productNodes = json.data?.products?.nodes || [];

    if (productNodes.length > 0) {
      return productNodes.map((p: any) => {
        const firstVariant = p.variants?.nodes?.[0];
        const variantCount = p.variants?.nodes?.length || 1;
        return {
          id: p.id,
          title: p.title,
          subtitle: variantCount > 1 ? `${variantCount} variants` : firstVariant?.title !== "Default Title" ? firstVariant?.title : "Standard",
          variantCount,
          imageUrl: p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-collection-1_large.png",
          defaultPrice: parseFloat(firstVariant?.price || "0"),
          defaultCompareAtPrice: firstVariant?.compareAtPrice ? parseFloat(firstVariant.compareAtPrice) : null,
        };
      });
    }
  } catch (err) {
    console.warn("Could not query store products via GraphQL admin, falling back to sample products:", err);
  }

  return SAMPLE_PRODUCTS;
}

/**
 * Generates the JSON configuration payload needed by the Shopify Function metafield
 */
export function buildFunctionConfiguration(
  setting: {
    isEnabled: boolean;
    discountTitle: string;
    rules: Array<{
      stateCode: string;
      stateName: string;
      discountType: string;
      discountValue: number;
      adjustmentType?: string;
      includeCompareAt?: boolean;
      minOrderAmount: number | null;
      isActive: boolean;
      customMessage: string | null;
    }>;
  },
  productOverrides: Array<any> = []
) {
  return {
    isEnabled: setting.isEnabled,
    defaultDiscountTitle: setting.discountTitle,
    rules: setting.rules.map((r) => ({
      stateCode: r.stateCode,
      stateName: r.stateName,
      discountType: r.discountType as "PERCENTAGE" | "FIXED_AMOUNT",
      discountValue: r.discountValue,
      adjustmentType: r.adjustmentType || "DECREASE",
      includeCompareAt: r.includeCompareAt !== false,
      minOrderAmount: r.minOrderAmount,
      isActive: r.isActive,
      customMessage: r.customMessage,
    })),
    productOverrides: productOverrides.map((o) => ({
      stateCode: o.stateCode,
      productId: o.productId,
      variantId: o.variantId,
      customPrice: o.customPrice,
      customCompareAtPrice: o.customCompareAtPrice,
      isIncluded: o.isIncluded !== false,
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
    const overrides = await getProductPriceOverrides(shop);
    const configJson = JSON.stringify(buildFunctionConfiguration(settings, overrides));

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

/**
 * Creates/Updates native Shopify PriceList for true contextual catalog pricing (Zero discount appearance)
 */
export async function syncPriceListWithShopify(
  admin: any,
  shop: string,
  stateCode: string,
  options: {
    catalogName: string;
    adjustmentType: "DECREASE" | "INCREASE";
    adjustmentValue: number;
    currency: string;
  }
) {
  try {
    const adjustmentTypeEnum =
      options.adjustmentType === "INCREASE" ? "PERCENTAGE_INCREASE" : "PERCENTAGE_DECREASE";

    const createPriceListMutation = await admin.graphql(
      `#graphql
      mutation createRegionalPriceList($input: PriceListCreateInput!) {
        priceListCreate(input: $input) {
          priceList {
            id
            name
            currency
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: {
            name: `${options.catalogName} Regional Price List`,
            currency: "INR",
            parent: {
              adjustment: {
                type: adjustmentTypeEnum,
                value: options.adjustmentValue,
              },
            },
          },
        },
      }
    );

    const json = await createPriceListMutation.json();
    const userErrors = json.data?.priceListCreate?.userErrors;

    if (userErrors && userErrors.length > 0) {
      console.warn("PriceList notice:", userErrors.map((e: any) => e.message).join(", "));
      return { success: false, error: userErrors[0]?.message };
    }

    const priceListId = json.data?.priceListCreate?.priceList?.id;
    return { success: true, priceListId };
  } catch (err: any) {
    console.warn("Native PriceList API notice:", err.message);
    return { success: false, error: err.message };
  }
}

