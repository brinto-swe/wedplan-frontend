import type { Metadata } from "next"
import { PaymentSuccess } from "@/components/billing/payment-result"

export const metadata: Metadata = { title: "Payment Confirmation" }

export default function PaymentSuccessPage() {
  return <PaymentSuccess />
}
