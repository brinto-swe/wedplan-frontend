import type { Metadata } from "next"
import { CustomerProfile } from "@/components/bookings/profile"
export const metadata: Metadata = { title: "Customer Profile" }
export default function Page() { return <CustomerProfile /> }
