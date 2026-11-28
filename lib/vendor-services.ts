"use client"

import { z } from "zod"
import { authClient } from "@/lib/auth"
import { publicationFields } from "@/lib/service-publication"
import { serviceImageUrls } from "@/lib/service-image-urls"
import { accountProfile, type AccountProfile } from "@/lib/profile"

const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
const requiredText = (label: string, max: number) => z.string().trim()
  .min(1, `${label} is required.`).max(max, `Use ${max} characters or fewer.`)

export const serviceInput = z.object({
  title: requiredText("Title", 120),
  category: requiredText("Category", 80),
  description: requiredText("Description", 5000),
  price: z.number({ error: "Enter a valid price." }).min(0, "Price must be zero or more.").max(1_000_000_000, "Price is too high."),
  location: requiredText("Location", 120),
  isActive: z.boolean().optional(),
  images: serviceImageUrls.optional(),
})
export const createServiceInput = serviceInput.extend({ images: serviceImageUrls.min(1, "Upload at least one service image.") })
export const managedService = serviceInput.extend({
  ...publicationFields,
  id: z.string(), vendorId: z.string(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
})
const detailResponse = z.object({ data: managedService })
const pageResponse = z.object({
  data: z.array(managedService),
  pagination: z.object({ totalPages: z.number().int().nonnegative().max(10_000) }),
})
const errorResponse = z.object({
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
})

export type VendorService = z.infer<typeof managedService>
export type ServiceInput = z.infer<typeof serviceInput>
export type VendorProfile = AccountProfile
export type Plan = "Free" | "Premium" | "Unavailable"
export const activeLimit = 3
export const serviceIdPattern = /^[a-f0-9]{24}$/i

export function vendorPlan(user: object): Plan {
  if (!("subscriptionPlan" in user)) return "Unavailable"
  if (user.subscriptionPlan !== "premium") return "Free"
  const expiresAt = "subscriptionExpiresAt" in user ? user.subscriptionExpiresAt : undefined
  const expiry = typeof expiresAt === "string" || expiresAt instanceof Date ? new Date(expiresAt).getTime() : NaN
  return Number.isFinite(expiry) && expiry > Date.now() ? "Premium" : "Free"
}

export class VendorApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) {
    super(message)
  }
}

async function request(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set("Authorization", `Bearer ${token}`)
  if (options.body) headers.set("Content-Type", "application/json")
  const response = await fetch(new URL(path, origin), {
    ...options, headers, credentials: "omit", cache: "no-store",
    signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(options.signal ? [options.signal] : [])]),
  })
  if (response.ok) return response

  const parsed = errorResponse.safeParse(await response.json().catch(() => null))
  const fields = Object.fromEntries(parsed.success ? (parsed.data.issues ?? []).map(({ path, message }) => [path, message]) : [])
  const messages: Record<number, string> = {
    400: "Check the information and try again.",
    401: "Your session has expired. Sign in again.",
    403: "This action is unavailable for your account.",
    404: "This service could not be found in your workspace.",
    409: "Service availability can only change after approval. Reload the service to check its current status.",
    429: "Too many requests. Please wait a moment and try again.",
  }
  throw new VendorApiError(response.status, messages[response.status] ?? "The service API is unavailable. Please try again.", fields)
}

export async function vendorAccess(signal?: AbortSignal) {
  const { data, error } = await authClient.token({ fetchOptions: { signal, timeout: 10_000 } })
  if (!data?.token) {
    const status = error?.status ?? 401
    throw new VendorApiError(status, status === 403 ? "This account cannot access the vendor workspace."
      : status === 401 ? "Sign in to access the vendor workspace." : "Could not verify your session. Please try again.")
  }

  const profile = accountProfile.parse(await (await request("/api/me", data.token, { signal })).json())
  if (profile.role !== "vendor") throw new VendorApiError(403, "This workspace is for vendor accounts.")
  return { profile, token: data.token }
}

export async function getVendorProfile(signal?: AbortSignal) {
  return (await vendorAccess(signal)).profile
}

export async function listVendorServices(signal?: AbortSignal) {
  const { profile, token } = await vendorAccess(signal)
  const items = new Map<string, VendorService>()
  let page = 1
  let totalPages = 1
  do {
    const response = await request(`/api/services/manage?page=${page}&limit=100`, token, { signal })
    const result = pageResponse.parse(await response.json())
    for (const item of result.data) {
      if (item.vendorId === profile.id) items.set(item.id, item)
    }
    totalPages = result.pagination.totalPages
    page += 1
  } while (page <= totalPages)

  return [...items.values()]
}

export async function getVendorService(id: string, signal?: AbortSignal) {
  if (!serviceIdPattern.test(id)) throw new VendorApiError(404, "This service could not be found in your workspace.")
  const { profile, token } = await vendorAccess(signal)
  const response = await request(`/api/services/manage/${id}`, token, { signal })
  const result = detailResponse.parse(await response.json()).data
  if (result.vendorId !== profile.id) throw new VendorApiError(404, "This service could not be found in your workspace.")
  return result
}

export async function saveVendorService(values: ServiceInput, id?: string) {
  const { token } = await vendorAccess()
  const response = await request(id ? `/api/services/${encodeURIComponent(id)}` : "/api/services", token, {
    method: id ? "PATCH" : "POST", body: JSON.stringify((id ? serviceInput : createServiceInput).parse(values)),
  })
  return detailResponse.parse(await response.json()).data
}

export async function deleteVendorService(id: string) {
  const { token } = await vendorAccess()
  await request(`/api/services/${encodeURIComponent(id)}`, token, { method: "DELETE" })
}
