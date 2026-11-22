import type { Metadata } from "next"
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import "./public.css"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--wp-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--wp-mono" })
const heading = Cormorant_Garamond({
  subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--wp-serif",
})

export const metadata: Metadata = {
  title: { default: "WedPlan | Your wedding, your way", template: "%s | WedPlan" },
  description: "Find wedding venues, photographers, florists, and other wedding services in the WedPlan directory.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("antialiased font-sans", geist.variable, fontMono.variable, heading.variable)}>
      <body><ThemeProvider>{children}<Toaster /></ThemeProvider></body>
    </html>
  )
}
