import type { Metadata } from "next"
import type { ReactNode } from "react"
import { CustomerWorkspace } from "@/components/bookings/workspace"
import "../vendor/vendor.css"

export const metadata: Metadata = { robots: { index: false, follow: false } }
export default function Layout({ children }: { children: ReactNode }) {
  return <CustomerWorkspace>{children}</CustomerWorkspace>
}
