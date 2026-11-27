import type { Metadata } from "next"
import { moderationStatus } from "@/lib/service-publication"
import { ManageServices } from "@/components/admin/manage-services"

export const metadata: Metadata = { title: "Manage Services" }

export default async function AdminServicesPage({ searchParams }: { searchParams: Promise<{ moderationStatus?: string }> }) {
  const result = moderationStatus.safeParse((await searchParams).moderationStatus)
  const status = result.success ? result.data : ""
  return <ManageServices key={status} initialStatus={status} />
}
