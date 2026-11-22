import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

export function VendorBanner({ title, description, children }: { title: ReactNode; description: string; children?: ReactNode }) {
  return <header className="vendor-banner">
    <div><h1>{title}</h1><p>{description}</p></div>{children}
  </header>
}

export function VendorStats({ items }: { items: { label: string; value: string | number; icon: LucideIcon }[] }) {
  return <section aria-label="Workspace statistics" className="vendor-stats">
    {items.map(({ label, value, icon: Icon }) => <div className="vendor-card vendor-stat" key={label}>
      <span className="vendor-stat-icon"><Icon size={24} aria-hidden="true" /></span>
      <div><strong>{value}</strong><p>{label}</p></div>
    </div>)}
  </section>
}
