import type { Metadata } from "next"
import { VendorBookings } from "@/components/bookings/pages"
export const metadata: Metadata = { title: "Vendor Booking Requests" }
export default function Page() { return <VendorBookings /> }
