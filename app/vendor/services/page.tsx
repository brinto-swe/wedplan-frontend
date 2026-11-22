import type { Metadata } from "next"
import { MyServices } from "@/components/vendor/my-services"

export const metadata: Metadata = { title: "My Services" }
export default function Page() { return <MyServices /> }
