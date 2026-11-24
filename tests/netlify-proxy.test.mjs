import assert from "node:assert/strict"
import test from "node:test"
import { resolveNetlifyProxy } from "../scripts/netlify-build.mjs"

const production = "https://wedplan-backend-six.vercel.app"
const preview = "https://wedplan-backend-git-preview-st-2e7864-brintos-projects-17ed2514.vercel.app"
const site = "https://wedplan.example"
const previewSite = "https://deploy-preview-17--wedplan.netlify.app"
const productionEnv = {
  CONTEXT: "production",
  URL: site,
  NEXT_PUBLIC_API_URL: site,
  WEDPLAN_API_PROXY_TARGET: production,
}
const previewEnv = {
  ...productionEnv,
  CONTEXT: "deploy-preview",
  DEPLOY_PRIME_URL: previewSite,
  WEDPLAN_API_PROXY_TARGET: preview,
}

test("Production keeps the existing backend and same-origin frontend API base", () => {
  assert.deepEqual(resolveNetlifyProxy(productionEnv), {
    frontendOrigin: site,
    redirects: `/api/* ${production}/api/:splat 200!\n`,
  })
  assert.throws(() => resolveNetlifyProxy({ ...productionEnv, WEDPLAN_API_PROXY_TARGET: preview }), /WEDPLAN_API_PROXY_TARGET/)
  assert.throws(() => resolveNetlifyProxy({ ...productionEnv, NEXT_PUBLIC_API_URL: production }), /frontend origin/)
})

test("Deploy Preview uses only the isolated backend and its own frontend origin", () => {
  assert.deepEqual(resolveNetlifyProxy(previewEnv), {
    frontendOrigin: previewSite,
    redirects: `/api/* ${preview}/api/:splat 200!\n`,
  })
})

test("Deploy Preview fails without an explicit approved backend", () => {
  for (const target of [undefined, "", production, production + "/", preview + "/api", preview + "?x=1", "https://another.example"]) {
    assert.throws(() => resolveNetlifyProxy({ ...previewEnv, WEDPLAN_API_PROXY_TARGET: target }), /WEDPLAN_API_PROXY_TARGET/)
  }
})

test("Unknown contexts and invalid Preview origins cannot inherit Production routing", () => {
  for (const context of [undefined, "branch-deploy", "dev"]) {
    assert.throws(() => resolveNetlifyProxy({ ...productionEnv, CONTEXT: context }), /build context/)
  }
  for (const frontend of [undefined, site, production, "http://preview.example", previewSite + "/api"]) {
    assert.throws(() => resolveNetlifyProxy({ ...previewEnv, DEPLOY_PRIME_URL: frontend }), /frontend origin/)
  }
})

test("Generated forced 200 splat keeps the API prefix, nested path and original query", () => {
  const [source, destination, status] = resolveNetlifyProxy(previewEnv).redirects.trim().split(" ")
  assert.equal(source, "/api/*")
  assert.equal(status, "200!")
  const prefixes = source.slice(0, -1)
  for (const path of [
    "/api/admin/transactions?status=paid&q=in_123",
    "/api/auth/callback/google?code=example&state=a%2Fb",
    "/api/admin/services?category=Wedding+venue&category=Photo",
  ]) {
    const incoming = new URL(path, previewSite)
    assert.ok(incoming.pathname.startsWith(prefixes))
    const forwarded = new URL(destination.replace(":splat", incoming.pathname.slice(prefixes.length)))
    assert.equal(forwarded.search, "")
    // Netlify forwards the original query automatically for a 200 rewrite.
    forwarded.search = incoming.search
    assert.equal(forwarded.href, preview + path)
  }
})
