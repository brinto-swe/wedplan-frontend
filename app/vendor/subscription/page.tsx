import type { Metadata } from "next"
import { VendorSubscription } from "@/components/billing/vendor-subscription"
import "../../billing.css"

export const metadata: Metadata = { title: "Subscription Plans" }

export default function SubscriptionPage() {
  return <VendorSubscription />
}
