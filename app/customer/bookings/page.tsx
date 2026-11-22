import type { Metadata } from "next"
import { CustomerBookings } from "@/components/bookings/pages"
export const metadata: Metadata = { title: "My Bookings" }
export default function Page() { return <CustomerBookings /> }
