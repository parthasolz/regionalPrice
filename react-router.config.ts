import type { Config } from "@react-router/dev/config";

export default {
  // Allow Shopify Admin iframe and partner URLs to submit action forms and fetchers to UI routes
  allowedActionOrigins: [
    "admin.shopify.com",
    "*.myshopify.com",
    "*.shopify.com",
    "*.spin.dev",
    "*.trycloudflare.com",
    "localhost:*",
    "127.0.0.1:*",
  ],
} satisfies Config;
