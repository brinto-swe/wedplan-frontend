import type { ReactNode } from "react"
import { Toaster } from "@/components/ui/toaster"
import "@/app/public.css"

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}<Toaster /></body></html>
}
