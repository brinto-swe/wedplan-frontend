import type { Metadata } from "next"
import { PaymentCancel } from "@/components/billing/payment-result"

export const metadata: Metadata = { title: "Checkout Cancelled" }

export default function PaymentCancelPage() {
  return <PaymentCancel />
}
