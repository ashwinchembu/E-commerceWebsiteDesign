
  # E-commerce Website Design

  This is a code bundle for E-commerce Website Design. The original project is available at https://www.figma.com/design/VGb966HO1uOYxjnHQ6too5/E-commerce-Website-Design.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Private access deployment

  The private-preview gate must run through the included Node access server. Do not publish the `dist` folder as a public static site, because static hosting would bypass server-side access enforcement.

  1. Copy `.env.access.example` to `.env.access.local`.
  2. Replace both secret placeholders with long random values. Keep this file out of source control.
  3. Run `npm run secure` to build the site and serve it behind the private-access gate.
  4. Open `/admin/access`, enter `ACCESS_ADMIN_SECRET`, and issue a unique code for each person.

  In production, configure the same environment variables in the hosting platform and route all traffic through `server/access-server.mjs`. Set `TRUST_PROXY=1` only behind a trusted proxy so IP and approximate provider location headers cannot be spoofed.

  Access logs store the assigned person, allowed/denied result, timestamp, IP address, approximate provider-supplied location, and browser/device user agent for 30 days. The system does not use covert fingerprinting or precise-location collection.

  Private-preview codes only control entry to the site. They do not sign someone into the separate customer or Footballers account system.
