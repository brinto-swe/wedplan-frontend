import type { LucideIcon } from "lucide-react"

const sizes = { sm: 16, md: 20, lg: 24, xl: 28 } as const

export function UiIcon({ icon: Icon, size = "md", className }: {
  icon: LucideIcon
  size?: keyof typeof sizes
  className?: string
}) {
  return <Icon size={sizes[size]} strokeWidth={1.75} className={className} aria-hidden="true" focusable="false" />
}
