import type { Metadata } from "next"
import { ServiceDetails } from "@/components/public/service-details"

export const metadata: Metadata = { title: "Service details" }

export default async function ServicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ book?: string }> }) {
  const [{ id }, { book }] = await Promise.all([params, searchParams])
  return <ServiceDetails key={id} id={id} autoOpen={book === "1"} />
}
