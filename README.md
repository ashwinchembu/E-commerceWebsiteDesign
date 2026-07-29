
  # E-commerce Website Design

  This is a code bundle for E-commerce Website Design. The original project is available at https://www.figma.com/design/VGb966HO1uOYxjnHQ6too5/E-commerce-Website-Design.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Private access deployment

  The private-preview gate is preserved in `server/` and in the `manoir-kits-private` Render service, but it is disconnected from the public storefront. The `ecommerce-website-design` Render static service publishes `dist`, so visitors do not need a password and the Node access server is not in the request path.

  1. Copy `.env.access.example` to `.env.access.local`.
  2. Replace both secret placeholders with long random values. Keep this file out of source control.
  3. Run `npm run secure` to build the site and serve it behind the private-access gate.
  4. Open `/admin/access`, enter `ACCESS_ADMIN_SECRET`, and issue a unique code for each person.

  For a future private production deployment, configure the same environment variables in the hosting platform, provide `MONGODB_URI`, and route all traffic through `server/access-server.mjs`. Set `TRUST_PROXY=1` only behind a trusted proxy so IP and approximate provider location headers cannot be spoofed.

  `render.yaml` preserves the private Node service definition with automatic deploys disabled. The preserved access server stores private-access data in MongoDB Atlas when it is enabled.

  Access logs store the assigned person, allowed/denied result, timestamp, IP address, approximate provider-supplied location, and browser/device user agent for 30 days. The system does not use covert fingerprinting or precise-location collection.

  Private-preview codes only control entry to the site. They do not sign someone into the separate customer or Footballers account system.
