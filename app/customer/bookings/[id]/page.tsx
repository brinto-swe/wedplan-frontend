import type { Metadata } from "next"
import { CustomerBooking } from "@/components/bookings/pages"
export const metadata: Metadata = { title: "Booking Details" }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CustomerBooking id={(await params).id} />
}
