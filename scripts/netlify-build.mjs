import { spawnSync } from "node:child_process"
import { writeFileSync } from "node:fs"

const production = "https://wedplan-backend-six.vercel.app"
const preview = "https://wedplan-backend-git-preview-st-2e7864-brintos-projects-17ed2514.vercel.app"

function httpsOrigin(value) {
  const url = URL.parse(value ?? "")
  if (
    url?.protocol === "https:" && !url.username && !url.password &&
    url.pathname === "/" && !url.search && !url.hash
  ) return url.origin
}

export function resolveNetlifyProxy(env) {
  const context = env.CONTEXT
  if (context !== "production" && context !== "deploy-preview") {
    throw new Error("Netlify API routing requires a Production or Deploy Preview build context.")
  }

  const expected = context === "production" ? production : preview
  const target = env.WEDPLAN_API_PROXY_TARGET?.trim()
  if (target !== expected && target !== expected + "/") {
    throw new Error(`Set WEDPLAN_API_PROXY_TARGET to the approved WedPlan backend origin for the Netlify ${context} context.`)
  }

  // Use Netlify's URL for this specific preview so inherited Production settings
  // cannot send browser API requests around the preview's same-origin proxy.
  const canonical = httpsOrigin(env.URL)
  const frontendOrigin = context === "production" ? canonical : httpsOrigin(env.DEPLOY_PRIME_URL)
  if (
    !canonical || !frontendOrigin ||
    (context === "production" && httpsOrigin(env.NEXT_PUBLIC_API_URL) !== canonical) ||
    (context === "deploy-preview" && frontendOrigin === canonical) ||
    frontendOrigin === production || frontendOrigin === preview
  ) {
    throw new Error(`Configure the canonical HTTPS Netlify frontend origin for the ${context} context. Production NEXT_PUBLIC_API_URL must match it.`)
  }

  return {
    frontendOrigin,
    redirects: `/api/* ${expected}/api/:splat 200!\n`,
  }
}

if (import.meta.main) {
  try {
    const { frontendOrigin, redirects } = resolveNetlifyProxy(process.env)
    const build = spawnSync(process.execPath, [process.env.npm_execpath, "run", "build"], {
      env: { ...process.env, NEXT_PUBLIC_API_URL: frontendOrigin },
      stdio: "inherit",
    })
    if (build.error) throw new Error("Could not start the Next.js build.")
    if (build.status !== 0) process.exit(build.status ?? 1)

    // OpenNext copies public/ into the final Netlify publish directory after the build.
    writeFileSync(new URL("../public/_redirects", import.meta.url), redirects)
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Netlify API routing configuration failed.")
    process.exitCode = 1
  }
}
