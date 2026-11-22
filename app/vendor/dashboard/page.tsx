import type { Metadata } from "next"
import { Dashboard } from "@/components/vendor/dashboard"

export const metadata: Metadata = { title: "Vendor dashboard" }
export default function Page() { return <Dashboard /> }
