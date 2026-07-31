# Manoir Kits storefront

React/Vite storefront for Manoir Kits. The browser storefront is deployed as a
static site on Render. Shopify owns customers, passwordless customer sign-in,
orders, and checkout. Firebase provides the trusted application backend.

## Local storefront

```sh
npm ci
npm run dev
```

`npm run build` always creates the public production storefront. An intentional
private-preview build can be created with `npm run build:private`, but a static
host cannot make compiled assets secret from someone who knows their URLs.

## Firebase backend

Firebase replaces the former long-running Render Node service:

- Firebase Authentication gives every operator an individual admin account.
- Cloud Functions validates access codes, issues Firebase sessions, enforces
  limits, serves owner guides, and performs all privileged operations.
- Cloud Firestore stores access grants, 30-day security events, rate limits, and
  the protected Shopify customer mirror.
- Shopify remains authoritative. The mirror contains customer IDs, names, email
  addresses, and tags; it does not copy passwords, sessions, orders, or payment
  details.

The old code under `server/` is retained only as migration history. It is not
referenced by the build, package scripts, or Render deployment.

### 1. Create or select the Firebase project

Cloud Functions requires a billing-enabled Blaze project even when traffic stays
inside the no-cost allowance.

```sh
cp .firebaserc.example .firebaserc
```

Replace the placeholder in `.firebaserc` with the real Firebase project ID. In
Firebase Console:

1. Create a Firestore database.
2. Enable Authentication.
3. Enable Google and/or Email/Password as an Authentication provider.
4. Register a Web app and copy its public configuration values.

Add these public build settings to Render:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_APP_ID
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_FUNCTIONS_REGION=us-west1
```

Never put a service-account key or Shopify secret in a `VITE_` variable.

### 2. Configure the Shopify secret

The existing Manoir Customer Access app uses Shopify client-credentials
authentication. Store its client secret in Google Secret Manager through the
Firebase CLI:

```sh
firebase functions:secrets:set SHOPIFY_CLIENT_SECRET
```

The Functions defaults match the current shop and app. They can be overridden
with Firebase parameter values:

```text
SHOPIFY_SHOP=8e48d6-30
SHOPIFY_CLIENT_ID=079422065aab48eb65be83b6158971be
SHOPIFY_API_VERSION=2026-07
ACCESS_EVENT_RETENTION_DAYS=30
NEWSLETTER_DISCOUNT_CODE=
```

The Shopify app needs `read_customers` and `write_customers` access plus
approval for the protected customer fields that it mirrors. Newsletter signups
create or update Shopify customers and record their email marketing consent.
Set `NEWSLETTER_DISCOUNT_CODE` only after the matching discount is active in
Shopify; the storefront never promises or displays an unconfigured code.

### 3. Configure customer messages and feedback

Feedback submissions pass through a replay-protected callable Function and are
stored as private Shopify metaobjects. Contact messages use the same private
owner inbox with a `contact` category. Firestore is not used for either type of
customer submission.

In the Shopify app configuration, add these Admin API scopes:

```text
write_metaobject_definitions
read_metaobjects
write_metaobjects
```

Apply the app configuration, then create the app-owned feedback definition:

```sh
npm run shopify:feedback:setup
```

After setup succeeds, remove `write_metaobject_definitions` from the Shopify
app and apply the configuration again. The production Functions keep
`read_metaobjects` and `write_metaobjects`.

In Google Cloud Console, create a reCAPTCHA Enterprise website key for the
storefront domains. Register it for the Firebase Web app under **App Check** and
add its public site key to Render:

```text
VITE_FIREBASE_APPCHECK_SITE_KEY
```

The `submitFeedback`, `submitContact`, and `subscribeNewsletter` Functions
reject missing or replayed App Check tokens. Customer message forms also use a
honeypot and a one-submission-per-network, five-minute Shopify metaobject
handle. The handle contains only a keyed digest, never the raw network address.

### 4. Deploy and authorize the first administrator

```sh
npm ci --prefix functions
npm run firebase:test
npm run firebase:deploy
```

Create or sign in with the intended administrator once so the Firebase Auth user
exists. Then use a service-account credential locally to assign the custom admin
claim:

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
npm --prefix functions run set-admin -- owner@example.com
```

Keep the service-account JSON outside this repository and remove it from the
machine when it is no longer needed. The administrator signs in at
`/admin/access`, which includes the private Shopify-backed feedback inbox.

The same owner dashboard contains the support ledger for the final project
terms: a $3,000 future-work bank (24 hours at $125/hour) and a separate 30-day
post-launch bug-fix window capped at 20 hours. Set the official launch date in
the dashboard when the site launches. Every push to `main` is logged as an
unreviewed deployment with its commit, changed files, line totals, and an
initial engineering-effort estimate. An administrator must review and allocate
the entry before either balance changes.

The `.github/workflows/support-tracker.yml` workflow authenticates to the
`logDeployment` Function with the `DEPLOYMENT_TRACKER_SECRET` GitHub Actions
secret. Store the same value in Firebase Secret Manager before deploying the
Function; never commit it to this repository.

The owner-only guide library also includes the fillable five-page Manoir Kits
Development & Support Agreement. It records the $8,000 project fee ($4,000 in
August 2026 and $4,000 in September 2026), the $3,000 bank for 24 future-work
hours at $125/hour, and a separate 30-day post-launch bug-fix window capped at
20 hours. Party names, payment dates, launch date, governing state, electronic
signature consent, signatures, and signing dates are interactive PDF fields.

### 5. Keep Shopify customers synchronized

After the first admin signs in, select **Sync all customers** in the admin
dashboard to create the initial Firestore mirror.

Configure the Shopify app to deliver these HTTPS webhook topics to the deployed
`shopifyCustomerWebhook` Function:

```text
customers/create
customers/update
customers/delete
customers/redact
shop/redact
```

The endpoint has this form:

```text
https://us-west1-PROJECT_ID.cloudfunctions.net/shopifyCustomerWebhook
```

The Function verifies Shopify's HMAC signature, rejects other shops, ignores
duplicate deliveries, and removes mirrored customer records for deletion and
redaction events. Mandatory compliance subscriptions should be configured in
the Shopify app's Dev Dashboard or app configuration.

## Firebase emulators

Use a demo project locally so tests cannot reach production resources:

```sh
npm run firebase:emulators
```

In a second terminal:

```sh
VITE_FIREBASE_API_KEY=demo-api-key \
VITE_FIREBASE_APP_ID=demo-app-id \
VITE_FIREBASE_AUTH_DOMAIN=demo-manoir-kits.firebaseapp.com \
VITE_FIREBASE_PROJECT_ID=demo-manoir-kits \
npm run dev:private
```

The Emulator UI is available at `http://127.0.0.1:4500`.

## Production deployment

Before pushing the storefront, run the same command Render runs:

```sh
npm ci && npm run build
```

Commit and push `main` to `origin`, then verify the Render static build.
Firebase Functions, rules, and indexes deploy separately with:

```sh
npm run firebase:deploy
```
