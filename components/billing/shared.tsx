"use client"

import { useQuery } from "@tanstack/react-query"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { ActionLink } from "@/components/public/ui"
import { WorkspaceState, useVendor } from "@/components/vendor/workspace"
import { getSubscription, type Subscription } from "@/lib/billing"
import { VendorApiError } from "@/lib/vendor-services"

export const subscriptionHref = "/vendor/subscription"

export function useSubscription() {
  const { profile } = useVendor()
  return useQuery({
    queryKey: ["vendor-subscription", profile.id],
    queryFn: ({ signal }) => getSubscription(signal),
  })
}

const labels: Record<string, string> = {
  none: "No paid subscription",
  active: "Active",
  unpaid_or_expired: "Unpaid or expired",
  unpaid: "Unpaid",
  past_due: "Past due",
  trialing: "Trialing",
  incomplete: "Awaiting payment",
  incomplete_expired: "Checkout expired",
  canceled: "Ended",
  paused: "Paused",
}

export function subscriptionStatus(status: string) {
  return labels[status] ?? "Status unavailable"
}

export function canUpgrade({ plan, status }: Subscription) {
  return plan === "free" && ["none", "canceled", "incomplete_expired"].includes(status)
}

export function BillingDate({ value, fallback = "—" }: { value: string | null; fallback?: string }) {
  if (!value) return <>{fallback}</>
  return <time dateTime={value}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))}</time>
}

export function BillingError({ error, retry, children }: { error: unknown; retry?: () => void; children?: ReactNode }) {
  const pathname = usePathname()
  const status = error instanceof VendorApiError ? error.status : 0
  return <div role="alert"><WorkspaceState
    title={status === 401 ? "Sign in again" : status === 403 ? "Vendor access required" : "Billing unavailable"}
    text={error instanceof VendorApiError ? error.message : "We couldn’t complete this request. Please try again."}>
    {status === 401 ? <ActionLink href={`/sign-in?next=${encodeURIComponent(pathname)}`}>Sign in</ActionLink>
      : retry && status !== 403 && <button type="button" className="wp-button wp-button-outline" onClick={retry}>Try again</button>}
    {children}
  </WorkspaceState></div>
}
