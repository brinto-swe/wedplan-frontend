import type { Metadata } from "next"
import type { ReactNode } from "react"
import { VendorWorkspace } from "@/components/vendor/workspace"
import "./vendor.css"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function VendorLayout({ children }: { children: ReactNode }) {
  return <VendorWorkspace>{children}</VendorWorkspace>
}
