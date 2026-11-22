import type { Metadata } from "next"
import { ServiceEditor } from "@/components/vendor/service-editor"

export const metadata: Metadata = { title: "Add Service" }
export default function Page() { return <ServiceEditor /> }
