import type { Metadata } from "next"
import { ManageServices } from "@/components/admin/manage-services"

export const metadata: Metadata = { title: "Manage Services" }

export default function AdminServicesPage() {
  return <ManageServices />
}
