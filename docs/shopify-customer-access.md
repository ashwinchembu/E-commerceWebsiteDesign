# Shopify customer access

The public Manoir Kits storefront has no Render password. Shopify customer
accounts control the Footballers jacket option.

## Grant access

From this project on the configured Mac:

```sh
npm run footballer -- grant customer@example.com
```

The command uses the `Manoir Customer Access CLI` Shopify app. Its client
secret is stored in macOS Keychain and is never committed to Git. It can also
check or revoke access:

```sh
npm run footballer -- status customer@example.com
npm run footballer -- revoke customer@example.com
```

To use the command on another machine, set `SHOPIFY_CLIENT_SECRET` in that
machine's secret manager or environment.

The equivalent manual flow is:

1. In Shopify Admin, open **Customers**.
2. Open the customer who should have Footballers access.
3. Add either the `footballer` or `owner` customer tag.
4. Save the customer.

The customer signs in from **Account** or from the locked Footballers option.
If the account was already open when its tag changed, use **Refresh access** on
the Account page.

## Revoke access

Remove the `footballer` and `owner` tags from that Shopify customer. Their
Footballers access ends the next time the site verifies their account.

## Shopify Headless client

The Customer Account API client is a public browser client. It must allow each
deployed site origin, use `/account` as its callback, and use `/` as its logout
URL. The storefront reads the signed-in customer's ID, display name, tags, and
private saved-jacket metafield. Never add a Shopify Admin API secret to a
`VITE_` environment variable.

## Saved jacket comparisons

Saved comparisons use one private JSON metafield on the signed-in Shopify
customer. The app needs `customer_read_customers` and
`customer_write_customers` in addition to its Admin API `write_customers`
scope. Apply those scopes, then create the app-owned definition once:

```sh
npm run shopify:saved-jackets:setup
```

The storefront caps the list at four compact jacket configurations and uses
Shopify compare-and-set protection so two browser tabs cannot silently
overwrite each other.
