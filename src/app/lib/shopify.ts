export type ShopifyAttribute = { key: string; value: string };

type CartCreateResponse = {
  data?: {
    cartCreate?: {
      cart?: { checkoutUrl: string };
      userErrors: Array<{ field?: string[]; message: string }>;
      warnings?: Array<{ message: string }>;
    };
  };
  errors?: Array<{ message: string }>;
};

function requiredEnv(name: string, value: string | undefined) {
  if (!value?.trim()) throw new Error(`Shopify checkout is not configured (${name}).`);
  return value.trim();
}

export function shopifyAccountUrl() {
  const store = requiredEnv("VITE_SHOPIFY_STORE_DOMAIN", import.meta.env.VITE_SHOPIFY_STORE_DOMAIN)
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  return `https://${store}/account`;
}

function jacketVariantForSize(size: string, edition: string) {
  const raw = requiredEnv("VITE_SHOPIFY_JACKET_VARIANTS", import.meta.env.VITE_SHOPIFY_JACKET_VARIANTS);
  let variants: Record<string, string | Record<string, string>>;
  try {
    variants = JSON.parse(raw);
  } catch {
    throw new Error("VITE_SHOPIFY_JACKET_VARIANTS must be valid JSON.");
  }
  const editionVariants = variants[edition];
  const variant = typeof editionVariants === "object" ? editionVariants[size] : variants[size];
  return requiredEnv(`${edition} variant for size ${size}`, typeof variant === "string" ? variant : undefined);
}

export async function createJacketCheckout(size: string, edition: string, attributes: ShopifyAttribute[]) {
  const store = requiredEnv("VITE_SHOPIFY_STORE_DOMAIN", import.meta.env.VITE_SHOPIFY_STORE_DOMAIN)
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const token = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN?.trim();
  const apiVersion = import.meta.env.VITE_SHOPIFY_API_VERSION?.trim() || "2026-07";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Shopify-Storefront-Access-Token"] = token;

  const response = await fetch(`https://${store}/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: `
        mutation CreateJacketCart($input: CartInput!) {
          cartCreate(input: $input) {
            cart { checkoutUrl }
            userErrors { field message }
            warnings { message }
          }
        }
      `,
      variables: {
        input: {
          lines: [{ merchandiseId: jacketVariantForSize(size, edition), quantity: 1, attributes }],
          attributes: [{ key: "Builder", value: "Manoir Kits Render configurator" }],
        },
      },
    }),
  });

  const payload = (await response.json()) as CartCreateResponse;
  const errors = [
    ...(payload.errors ?? []).map((error) => error.message),
    ...(payload.data?.cartCreate?.userErrors ?? []).map((error) => error.message),
  ];
  const checkoutUrl = payload.data?.cartCreate?.cart?.checkoutUrl;
  if (!response.ok || errors.length || !checkoutUrl) {
    throw new Error(errors.join(" ") || "Shopify could not create this checkout.");
  }
  return checkoutUrl;
}
