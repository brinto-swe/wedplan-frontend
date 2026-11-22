import type { Metadata } from "next"
import { ServiceEditor } from "@/components/vendor/service-editor"

export const metadata: Metadata = { title: "Edit Service" }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ServiceEditor id={(await params).id} />
}
