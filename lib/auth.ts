"use client"

import { jwtClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"

export const authClient = createAuthClient({
  baseURL: apiOrigin,
  basePath: "/api/auth",
  fetchOptions: { credentials: "include" },
  plugins: [jwtClient()],
})

export function signUpEmail(input: {
  name: string
  email: string
  password: string
  role?: "customer" | "vendor"
  businessName?: string
}) {
  return authClient.signUp.email(input)
}

export function signInEmail(email: string, password: string) {
  return authClient.signIn.email({ email, password })
}

export function signInWithProvider(provider: "google" | "github") {
  return authClient.signIn.social({
    provider,
    callbackURL: new URL("/auth-smoke", window.location.origin).href,
  })
}

export class ProtectedProfileError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export async function fetchProtectedProfile(signal?: AbortSignal) {
  const { data, error } = await authClient.token({ fetchOptions: { signal, timeout: 10_000 } })
  if (error || !data?.token) throw new ProtectedProfileError(error?.status ?? 401, "Sign in to request a bearer token.")

  const response = await fetch(new URL("/api/me", apiOrigin), {
    credentials: "omit",
    cache: "no-store",
    headers: { Authorization: `Bearer ${data.token}` },
    signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(signal ? [signal] : [])]),
  })
  if (!response.ok) throw new ProtectedProfileError(response.status, `Protected profile returned HTTP ${response.status}.`)

  return response.json() as Promise<{
    id: string
    name: string
    email: string
    role: "customer" | "vendor" | "admin"
  }>
}
