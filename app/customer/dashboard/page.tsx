import type { Metadata } from "next"
import { CustomerDashboard } from "@/components/bookings/dashboard"
export const metadata: Metadata = { title: "Customer Overview" }
export default function Page() { return <CustomerDashboard /> }
