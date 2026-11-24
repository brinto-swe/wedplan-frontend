# WedPlan Frontend

WedPlan is a Next.js App Router application. The production API runs at
`https://wedplan-backend-six.vercel.app`.

## Deploy to Netlify

1. Import the `wedplan-frontend` repository. Use the repository root as the base directory and leave the package directory unset. Keep Netlify’s automatic Next.js/OpenNext adapter enabled. The version-controlled `netlify.toml` sets Node.js 24, `npm run build`, and the `.next` publish directory. Deploy with the adapter, since the catalogue and detail pages require server rendering.
2. Reserve the canonical HTTPS Netlify hostname, for example `https://your-site.netlify.app`. In Netlify’s production environment, set **`NEXT_PUBLIC_API_URL` to that exact origin**, without `/api`. Scope it to Builds (or all scopes) and redeploy whenever it changes. The same-origin `/api/*` rewrite forwards requests to the production Vercel API. No additional application environment variables are required on Netlify. Keep MongoDB, Better Auth, and OAuth credentials on Vercel.
3. In the Vercel backend’s production environment, set both **`CLIENT_URL` and `BETTER_AUTH_URL`** to the exact canonical Netlify origin. Preserve existing secret values. Redeploy the backend to apply the origin settings. Register the frontend-facing callbacks in the Google and GitHub provider consoles:

   - `https://your-site.netlify.app/api/auth/callback/google`
   - `https://your-site.netlify.app/api/auth/callback/github`

   Use the hostname visitors will actually use. The callback paths are proxied to Express. Preview aliases require separate environment and provider configuration if they need authenticated access.
4. Deploy the frontend manually from the Netlify dashboard. Verify `/api/auth/ok` and `/api/services` through the Netlify hostname, and check that anonymous `/api/bookings/my` returns 401. Check the live catalogue, a service detail page, and a wedding image. Test email and both OAuth sign-ins, reload, JWT-backed dashboard access, and sign-out in Chrome and Safari. In browser tools, confirm the auth cookie is set on the Netlify hostname and that session responses are not cached.

### Direct API alternative

`NEXT_PUBLIC_API_URL=https://wedplan-backend-six.vercel.app` is also supported. For reliable browser sessions, use HTTPS sibling custom domains for frontend and backend and use the Vercel API’s custom origin instead of the default URL. Set the backend’s `CLIENT_URL` to the frontend origin and its `BETTER_AUTH_URL` to the API origin. Register OAuth callbacks on that API origin. Better Auth sends cookies with `credentials: "include"`; the protected application requests send bearer tokens. Default Netlify and Vercel hostnames are cross-site, so direct API sign-in on that pair can fail when browsers block third-party cookies.

Wedding images are local WebP files under `public/weddings`. Keep the existing `next/image` setup and the adapter’s Image CDN integration.

## Local development

Use Node.js 24 and run `npm ci` then `npm run dev`. Without `NEXT_PUBLIC_API_URL`, the application uses the local API at `http://localhost:5000`. Netlify builds require an explicit public HTTPS origin so a missing setting cannot ship that local fallback. Run `npm run lint`, `npm run typecheck`, and `npm run build` before publishing changes.

### Vendor billing

Billing uses the existing `NEXT_PUBLIC_API_URL` and bearer authentication. Enable Stripe Test Mode in the backend before testing with a real session. Stripe credentials stay on the backend. Once Checkout returns to `/payment/success`, check the page with both pending and confirmed subscription states. Stripe Checkout displays the actual price and billing interval.

Run `npx playwright install chromium` once, then `npm run test:billing`. The suite builds and serves the frontend locally with mocked authentication, billing, and Stripe Checkout responses. To use an installed Chrome browser instead, set `WEDPLAN_TEST_BROWSER=chrome` before running the tests.
