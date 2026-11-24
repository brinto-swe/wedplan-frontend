# WedPlan Frontend

WedPlan is a Next.js App Router application. The production API runs at
`https://wedplan-backend-six.vercel.app`.

## Deploy to Netlify

Use the repository root as the base directory and leave the package directory unset. Keep Netlify’s automatic Next.js/OpenNext adapter enabled. The checked-in configuration uses Node.js 24, `npm run build:netlify`, and the `.next` publish directory.

### Netlify environment variables

In **Project configuration → Environment variables**, scope these values to **Builds** and choose different values for each deploy context.

| Variable | Production | Deploy Previews |
| --- | --- | --- |
| `WEDPLAN_API_PROXY_TARGET` | `https://wedplan-backend-six.vercel.app` | `https://wedplan-backend-git-preview-st-2e7864-brintos-projects-17ed2514.vercel.app` |
| `NEXT_PUBLIC_API_URL` | Exact canonical HTTPS Netlify site origin, without `/api` | Derived by the build from Netlify’s `DEPLOY_PRIME_URL`. No manual value required. |

Each successful build writes one forced `200` proxy rule to `public/_redirects`. OpenNext copies the file to the final publish directory. The rule forwards `/api/*` with its path and query intact. Both clients use the frontend origin, so Better Auth can set its session cookie on the Netlify hostname and Admin requests can carry their bearer header through the same proxy. Missing or unexpected backend targets fail the build. Branch deploys and other contexts require a separate routing decision before use. Remove any legacy `/api/*` proxy rules configured outside the repository before accepting a deployment.

### Better Auth and OAuth

On the matching Vercel backend, configure both `CLIENT_URL` and `BETTER_AUTH_URL` to the exact public frontend origin used by that deployment. For Production, use the canonical Netlify site origin. For Preview, use the specific `DEPLOY_PRIME_URL` of the Netlify Deploy Preview being tested. The isolated backend has one configured frontend origin, so coordinate which Deploy Preview uses it for authenticated testing.

| Environment | Google callback | GitHub callback |
| --- | --- | --- |
| Production | `<production-frontend-origin>/api/auth/callback/google` | `<production-frontend-origin>/api/auth/callback/github` |
| Preview | `<preview-frontend-origin>/api/auth/callback/google` | `<preview-frontend-origin>/api/auth/callback/github` |

Register those complete callback URLs in the corresponding provider apps. Keep the Preview `BETTER_AUTH_SECRET` consistent with the secret that encrypted its stored JWT signing keys. The Preview backend must use the dedicated test MongoDB credential and `MONGODB_DATABASE=wedplan_stripe_test`. Keep production credentials and data out of Preview. MongoDB, Better Auth, and OAuth secrets belong on Vercel.

Before authenticated Preview testing, confirm the selected Vercel deployment uses the isolated database and that its deployment protection permits Netlify’s proxy requests. After a manually approved deployment, test `/api/auth/ok` and a query-bearing `/api/services` through Netlify, then verify sign-in, reload, JWT-backed Admin reads, and sign-out on that hostname. Verify a disposable authenticated mutation through Preview to check request-body forwarding. Confirm the auth cookie belongs to the Netlify origin and session responses are uncached.

### Hosted Preview Smoke Test Checklist

- [ ] Verify the Preview frontend’s same-origin `/api/*` proxy targets the isolated Vercel Preview backend.
- [ ] Confirm that backend connects to `wedplan_stripe_test` with the dedicated test credential before signing in or performing mutations.
- [ ] Sign in as the disposable Admin and verify the session persists after a reload.
- [ ] Open Dashboard, Users, Services, and Transactions and confirm each page loads live test data.
- [ ] Test block/unblock and service edit, visibility change, and deletion using only disposable test records. Clean up any records created for the smoke test.
- [ ] Verify anonymous, Customer, Vendor, and blocked Admin requests are denied access to Admin pages and APIs as appropriate.
- [ ] Confirm the smoke test left Production data and accounts untouched.

Wedding images are local WebP files under `public/weddings`. Keep the existing `next/image` setup and the adapter’s Image CDN integration.

## Local development

Use Node.js 24 and run `npm ci` then `npm run dev`. Without `NEXT_PUBLIC_API_URL`, the application uses the local API at `http://localhost:5000`. Netlify builds require an explicit public HTTPS origin so a missing setting cannot ship that local fallback. Run `npm run lint`, `npm run typecheck`, and `npm run build` before publishing changes.

### Vendor billing

Billing uses the existing `NEXT_PUBLIC_API_URL` and bearer authentication. Enable Stripe Test Mode in the backend before testing with a real session. Stripe credentials stay on the backend. Once Checkout returns to `/payment/success`, check the page with both pending and confirmed subscription states. Stripe Checkout displays the actual price and billing interval.

Run `npx playwright install chromium` once, then `npm run test:billing`. The suite builds and serves the frontend locally with mocked authentication, billing, and Stripe Checkout responses. To use an installed Chrome browser instead, set `WEDPLAN_TEST_BROWSER=chrome` before running the tests.
