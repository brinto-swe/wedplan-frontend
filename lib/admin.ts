"use client"

import { z } from "zod"
import { authClient } from "@/lib/auth"

const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
const count = z.number().int().nonnegative()
const overviewSchema = z.object({ data: z.object({
  users: z.object({ total: count, customers: count, vendors: count, admins: count, active: count, blocked: count }),
  services: z.object({ total: count, active: count, inactive: count }),
  bookings: z.object({ total: count, pending: count, accepted: count, rejected: count, cancelled: count }),
  subscriptions: z.object({ premium: count, free: count, cancellationScheduled: count }),
  revenue: z.object({
    amountUnit: z.literal("minor"),
    dateBasis: z.literal("stripe_invoice_event"),
    paidInvoiceCount: count,
    failedInvoiceCount: count,
    paidByCurrency: z.array(z.object({ currency: z.string().regex(/^[a-z]{3}$/i), amount: count })),
  }),
}) })
export type AdminOverview = z.infer<typeof overviewSchema>["data"]

export class AdminApiError extends Error {
  constructor(readonly status: number) { super("Admin API request failed") }
}

async function adminRequest(path: "/api/me" | "/api/admin/overview", signal: AbortSignal) {
  const { data, error } = await authClient.token({ fetchOptions: { signal, timeout: 10_000 } })
  if (!data?.token) throw new AdminApiError(error?.status ?? 401)
  const response = await fetch(new URL(path, origin), {
    credentials: "omit",
    cache: "no-store",
    headers: { Authorization: "Bearer " + data.token },
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  })
  if (!response.ok) throw new AdminApiError(response.status)
  return response.json()
}

export async function getAdminProfile(signal: AbortSignal) {
  const profile = z.object({ id: z.string(), name: z.string(), role: z.string() }).parse(await adminRequest("/api/me", signal))
  if (profile.role !== "admin") throw new AdminApiError(403)
  return profile
}

export async function getAdminOverview(signal: AbortSignal) {
  return overviewSchema.parse(await adminRequest("/api/admin/overview", signal)).data
}
