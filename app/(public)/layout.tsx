import type { ReactNode } from "react"
import { PublicFooter, PublicHeader } from "@/components/public/site-shell"

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="wp-site">
    <a className="wp-skip" href="#main-content">Skip to content</a>
    <PublicHeader />
    <main id="main-content">{children}</main>
    <PublicFooter />
  </div>
}
