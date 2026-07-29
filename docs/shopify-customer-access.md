# Shopify customer access

The public Manoir Kits storefront has no Render password. Shopify customer
accounts control the Footballers jacket option.

## Grant access

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
URL. The storefront only reads the signed-in customer's ID, display name, and
tags. Never add a Shopify Admin API secret to a `VITE_` environment variable.
