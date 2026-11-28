import { UiIcon } from "@/components/ui/icon"
import Link from "next/link"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

export function VendorBanner({ title, description, children }: { title: ReactNode; description: string; children?: ReactNode }) {
  return <header className="vendor-banner">
    <div><h1>{title}</h1><p>{description}</p></div>{children}
  </header>
}

export function VendorStats({ items }: { items: { label: string; value: string | number; icon: LucideIcon; href?: string }[] }) {
  return <section aria-label="Workspace statistics" className="vendor-stats">
    {items.map(({ label, value, icon: Icon, href }) => <div className="vendor-card vendor-stat" key={label}>
      <span className="vendor-stat-icon"><UiIcon icon={Icon} size="lg" /></span>
      <div><strong className={value === "Unavailable" ? "vendor-stat-status" : undefined}>{value}</strong><p>{href ? <Link className="wp-text-link" href={href}>{label}</Link> : label}</p></div>
    </div>)}
  </section>
}
