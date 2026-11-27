"use client"

import { z } from "zod"
import type { ModerationStatus } from "@/lib/service-publication"
import { authClient } from "@/lib/auth"
import { managedService, type ServiceInput } from "@/lib/vendor-services"

const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
const count = z.number().int().nonnegative()
const overviewSchema = z.object({ data: z.object({
  users: z.object({ total: count, customers: count, vendors: count, admins: count, active: count, blocked: count }),
  services: z.object({ total: count, active: count, inactive: count, pending: count }),
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
const adminPagination = z.object({ page: count.positive(), limit: count.positive(), total: count, totalPages: count })
const userList = z.object({
  data: z.array(adminUser),
  pagination: adminPagination,
})
export type AdminUser = z.infer<typeof adminUser>
export type AdminUserFilters = { q: string; role: AdminUser["role"] | ""; status: AdminUser["status"] | ""; page: number }

export class AdminApiError extends Error {
  constructor(readonly status: number) { super("Admin API request failed") }
}

async function adminRequest(path: string, signal?: AbortSignal, body?: object, method = body ? "PATCH" : "GET") {
  const { data, error } = await authClient.token({ fetchOptions: { signal, timeout: 10_000 } })
  if (!data?.token) throw new AdminApiError(error?.status ?? 401)
  const response = await fetch(new URL(path, origin), {
    method,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "omit",
    cache: "no-store",
    headers: { Authorization: "Bearer " + data.token, ...(body && { "Content-Type": "application/json" }) },
    signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(signal ? [signal] : [])]),
  })
  if (!response.ok) throw new AdminApiError(response.status)
  return response.status === 204 ? undefined : response.json()
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

const adminService = managedService.extend({ id: z.string().regex(/^[a-f0-9]{24}$/i) })
const vendorDisplay = z.object({ id: z.string(), name: z.string().optional(), businessName: z.string().optional() })
const adminServiceDetail = z.object({ data: adminService })
const adminServiceList = z.object({
  data: z.array(adminService.extend({ vendor: vendorDisplay.nullable() })),
  pagination: adminPagination,
})
export type AdminService = z.infer<typeof adminService>
export type AdminServiceRow = z.infer<typeof adminServiceList>["data"][number]
export type AdminServiceFilters = { q: string; category: string; vendorId: string; visibility: "" | "active" | "inactive"; moderationStatus: "" | ModerationStatus; page: number }

export async function listAdminServices(filters: AdminServiceFilters, signal: AbortSignal) {
  const { page, ...values } = filters
  const params = new URLSearchParams({ page: String(page), limit: "8" })
  for (const [name, value] of Object.entries(values)) if (value.trim()) params.set(name, value.trim())
  return adminServiceList.parse(await adminRequest("/api/admin/services?" + params, signal))
}

const adminServicePath = (id: string) => "/api/admin/services/" + encodeURIComponent(id)

export async function getAdminService(id: string, signal: AbortSignal) {
  return adminServiceDetail.parse(await adminRequest(adminServicePath(id), signal)).data
}

export async function updateAdminService(id: string, patch: Partial<ServiceInput>) {
  return adminServiceDetail.parse(await adminRequest(adminServicePath(id), undefined, patch)).data
}

export async function moderateAdminService(id: string, status: Exclude<ModerationStatus, "pending">) {
  return adminServiceDetail.parse(await adminRequest(adminServicePath(id) + "/moderation", undefined, { status })).data
}

export async function deleteAdminService(id: string) {
  await adminRequest(adminServicePath(id), undefined, undefined, "DELETE")
}

const adminTransaction = z.object({
  id: z.string(),
  vendorId: z.string(),
  vendor: vendorDisplay.nullable(),
  amount: count,
  amountUnit: z.literal("minor"),
  currency: z.string().regex(/^[a-z]{3}$/i),
  status: z.enum(["paid", "failed"]),
  type: z.literal("subscription"),
  createdAt: z.iso.datetime(),
  dateBasis: z.literal("stripe_invoice_event"),
})
const transactionList = z.object({ data: z.array(adminTransaction), pagination: adminPagination })
const transactionDetail = z.object({
  data: adminTransaction.extend({ invoiceCreatedAt: z.null(), billingPeriod: z.null() }),
})

export type AdminTransaction = z.infer<typeof adminTransaction>
export type AdminTransactionFilters = {
  q: string
  status: AdminTransaction["status"] | ""
  vendorId: string
  currency: string
  from: string
  to: string
}

const adminTransactionsEndpoint = "/api/admin/transactions"

export async function listAdminTransactions(filters: AdminTransactionFilters, page: number, signal: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), limit: "8" })
  for (const [name, value] of Object.entries(filters)) {
    if (value) params.set(name, value)
  }
  return transactionList.parse(await adminRequest(adminTransactionsEndpoint + "?" + params, signal))
}

export async function getAdminTransaction(id: string, signal: AbortSignal) {
  return transactionDetail.parse(await adminRequest(adminTransactionsEndpoint + "/" + encodeURIComponent(id), signal)).data
}
