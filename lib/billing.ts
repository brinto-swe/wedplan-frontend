"use client"

import { z } from "zod"
import { VendorApiError, vendorAccess } from "@/lib/vendor-services"

const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
const date = z.iso.datetime().nullable()
const subscription = z.object({
  plan: z.enum(["free", "premium"]),
  status: z.string(),
  expiresAt: date,
  renewsAt: date,
  cancelAtPeriodEnd: z.boolean(),
  cancelAt: date,
})
const transactions = z.object({
  data: z.array(z.object({
    id: z.string(),
    amount: z.number().int().nonnegative(),
    currency: z.string().regex(/^[a-z]{3}$/i),
    status: z.enum(["paid", "failed"]),
    type: z.literal("subscription"),
    createdAt: z.iso.datetime(),
  })),
  pagination: z.object({ page: z.number().int().positive(), totalPages: z.number().int().nonnegative() }),
})
const checkout = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value)
    return url.origin === "https://checkout.stripe.com" && !url.username && !url.password
  }),
})
const cancellation = z.object({ cancelAtPeriodEnd: z.literal(true), cancelAt: date })
export type Subscription = z.infer<typeof subscription>
export type TransactionPage = z.infer<typeof transactions>

async function billingRequest(path: string, method: "GET" | "POST", signal?: AbortSignal) {
  const { token } = await vendorAccess(signal)
  const response = await fetch(new URL("/api/payments/" + path, origin), {
    method, credentials: "omit", cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.any([AbortSignal.timeout(20_000), ...(signal ? [signal] : [])]),
  })
  if (response.ok) return response.json()

  const messages: Record<number, string> = {
    401: "Sign in again to continue.",
    403: "Billing is available to vendor accounts only.",
    404: path === "cancel-subscription" ? "No subscription was found to cancel." : "Billing is unavailable in this environment.",
    409: path === "create-checkout-session" ? "Checkout is unavailable while another subscription is open. Check your subscription status and try again."
      : "This subscription is no longer eligible for cancellation. Check its current status.",
    429: "Too many requests. Wait a moment and try again.",
  }
  throw new VendorApiError(response.status, messages[response.status] ?? "The billing service is unavailable. Please try again.")
}

export async function getSubscription(signal?: AbortSignal) {
  return subscription.parse(await billingRequest("subscription", "GET", signal))
}

export async function getTransactions(page: number, signal?: AbortSignal) {
  return transactions.parse(await billingRequest(`transactions?page=${page}&limit=5`, "GET", signal))
}

export async function startCheckout() {
  return checkout.parse(await billingRequest("create-checkout-session", "POST"))
}

export async function scheduleCancellation() {
  return cancellation.parse(await billingRequest("cancel-subscription", "POST"))
}
