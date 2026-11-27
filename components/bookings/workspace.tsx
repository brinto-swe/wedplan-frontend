"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { createContext, useContext, useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { CalendarDays, ChevronDown, HeartHandshake, LayoutDashboard, UserRound } from "lucide-react"
import { authClient } from "@/lib/auth"
import { bookingAccess } from "@/lib/bookings"
import { profileKey, type AccountProfile } from "@/lib/profile"
import { UiIcon } from "@/components/ui/icon"
import { DashboardAccountControls } from "@/components/ui/dashboard-account-controls"
import { AccountAvatar } from "@/components/ui/account-avatar"
import { LoadingLabel } from "@/components/ui/loading-label"
import { BookingError } from "./shared"

const links = [
  { href: "/customer/dashboard", title: "Overview", icon: LayoutDashboard },
  { href: "/customer/bookings", title: "My Bookings", icon: CalendarDays },
  { href: "/customer/profile", title: "My Profile", icon: UserRound },
]

const CustomerProfileContext = createContext<AccountProfile | null>(null)

export function useCustomerProfile() {
  const profile = useContext(CustomerProfileContext)
  if (!profile) throw new Error("Customer workspace profile missing")
  return profile
}

function Gate({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  const user = session.data?.user
  const pathname = usePathname()
  const access = useQuery({ queryKey: profileKey("customer", user?.id), enabled: !!user && !session.error,
    queryFn: ({ signal }) => bookingAccess("customer", signal).then(({ profile }) => profile) })
  if (session.isPending || (user && !session.error && access.isPending)) return <div className="vendor-gateway"><LoadingLabel>Checking your account…</LoadingLabel></div>
  if (session.error) return <div className="vendor-gateway"><BookingError error={new Error()} retry={() => void session.refetch()} /></div>
  if (!user) return <div className="vendor-gateway vendor-card"><h2>Sign in to your workspace</h2><Link href="/sign-in" className="wp-button">Sign in</Link></div>
  if (access.isError) return <div className="vendor-gateway"><BookingError error={access.error} retry={() => void access.refetch()} /></div>
  const profile = access.data!
  const nav = links.map(({ href, title, icon }) => <Link key={href} href={href} aria-current={(pathname === href || pathname.startsWith(href + "/")) ? "page" : undefined}><UiIcon icon={icon} size="sm" />{title}</Link>)
  const section = links.find(({ href }) => pathname === href || pathname.startsWith(href + "/"))?.title
  return <CustomerProfileContext.Provider value={profile}><div className="vendor-layout">
    <a className="wp-skip" href="#customer-main">Skip to content</a>
    <aside className="vendor-sidebar">
      <Link href="/" className="wp-brand"><UiIcon icon={HeartHandshake} size="xl" />WedPlan</Link>
      <div className="vendor-identity"><AccountAvatar name={profile.name} image={profile.image} /><div><strong>{profile.name}</strong><p>Customer account</p></div></div>
      <nav aria-label="Customer navigation">{nav}</nav>
      <div className="vendor-sidebar-plan"><UiIcon icon={HeartHandshake} size="lg" /><strong>Discover wedding services</strong><p>Find the right team for your day.</p><Link className="wp-button" href="/services">Browse services</Link></div>
    </aside>
    <div className="vendor-content">
      <header className="vendor-topbar">
        <div className="vendor-crumb"><Link href="/customer/dashboard">Customer Dashboard</Link>{section && <strong>{section}</strong>}</div>
        <span>{profile.name}</span><DashboardAccountControls />
        <details className="vendor-mobile-links"><summary>Workspace <UiIcon icon={ChevronDown} size="sm" /></summary><nav aria-label="Mobile customer navigation">{nav}<Link href="/services">Browse services</Link></nav></details>
      </header>
      <main id="customer-main" className="vendor-main">{children}</main>
    </div>
  </div></CustomerProfileContext.Provider>
}

export function CustomerWorkspace({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <div className="wp-site vendor-site"><QueryClientProvider client={client}><Gate>{children}</Gate></QueryClientProvider></div>
}
