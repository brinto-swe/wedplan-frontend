import type { Metadata } from "next"
import { VendorProfileSettings } from "@/components/vendor/profile"

export const metadata: Metadata = { title: "Vendor Profile" }

export default function Page() {
  return <VendorProfileSettings />
}
