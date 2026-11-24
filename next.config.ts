import type { NextConfig } from "next"

if (process.env.NETLIFY === "true") {
  const value = process.env.NEXT_PUBLIC_API_URL
  const url = value ? URL.parse(value) : null
  if (
    !url || url.protocol !== "https:" || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash ||
    /^(?:localhost\.?|127\.|\[::1\]$|0\.0\.0\.0$)/i.test(url.hostname)
  ) {
    throw new Error("Set NEXT_PUBLIC_API_URL to a public HTTPS origin before building on Netlify.")
  }
}

const nextConfig: NextConfig = {}

export default nextConfig
