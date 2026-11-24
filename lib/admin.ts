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
export const adminUserRoles = ["customer", "vendor", "admin"] as const
export const adminUserStatuses = ["active", "blocked"] as const
const adminUser = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i), name: z.string(), email: z.string(),
  role: z.enum(adminUserRoles), status: z.enum(adminUserStatuses), emailVerified: z.boolean(),
  createdAt: z.iso.datetime().optional(), updatedAt: z.iso.datetime().optional(),
})
const userDetail = z.object({ data: adminUser })
const userList = z.object({
  data: z.array(adminUser),
  pagination: z.object({ page: count.positive(), limit: count.positive(), total: count, totalPages: count }),
})
export type AdminUser = z.infer<typeof adminUser>
export type AdminUserFilters = { q: string; role: AdminUser["role"] | ""; status: AdminUser["status"] | ""; page: number }

export class AdminApiError extends Error {
  constructor(readonly status: number) { super("Admin API request failed") }
}

async function adminRequest(path: string, signal?: AbortSignal, body?: { status: AdminUser["status"] }) {
  const { data, error } = await authClient.token({ fetchOptions: { signal, timeout: 10_000 } })
  if (!data?.token) throw new AdminApiError(error?.status ?? 401)
  const response = await fetch(new URL(path, origin), {
    method: body ? "PATCH" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    credentials: "omit",
    cache: "no-store",
    headers: { Authorization: "Bearer " + data.token, ...(body && { "Content-Type": "application/json" }) },
    signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(signal ? [signal] : [])]),
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

export async function listAdminUsers(filters: AdminUserFilters, signal: AbortSignal) {
  const params = new URLSearchParams({ page: String(filters.page), limit: "8" })
  for (const [field, value] of Object.entries({ q: filters.q.trim(), role: filters.role, status: filters.status })) {
    if (value) params.set(field, value)
  }
  return userList.parse(await adminRequest("/api/admin/users?" + params, signal))
}

export async function getAdminUser(id: string, signal: AbortSignal) {
  return userDetail.parse(await adminRequest("/api/admin/users/" + encodeURIComponent(id), signal)).data
}

export async function updateAdminUserStatus(id: string, status: AdminUser["status"]) {
  return userDetail.parse(await adminRequest("/api/admin/users/" + encodeURIComponent(id) + "/status", undefined, { status })).data
}
