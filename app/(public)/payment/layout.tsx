import type { Metadata } from "next"
import type { ReactNode } from "react"
import { VendorAccess } from "@/components/vendor/workspace"
import "../../vendor/vendor.css"
import "../../billing.css"

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" }

export default function PaymentLayout({ children }: { children: ReactNode }) {
  return <VendorAccess>{children}</VendorAccess>
}
