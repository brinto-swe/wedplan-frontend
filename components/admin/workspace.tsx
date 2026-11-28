"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { CalendarDays, ChevronDown, ChevronRight, Crown, HeartHandshake, House, Layers3, ReceiptText, Users } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { LoadingLabel } from "@/components/ui/loading-label"
import { UiIcon } from "@/components/ui/icon"
import { DashboardAccountControls } from "@/components/ui/dashboard-account-controls"
import { authClient } from "@/lib/auth"
import { AdminApiError, getAdminProfile } from "@/lib/admin"
import { adminDashboardPath, adminReturn, adminServicesPath, adminTransactionsPath, adminUsersPath } from "@/lib/admin-navigation"
import { WorkspaceState } from "@/components/vendor/workspace"

const signInFor = (pathname: string) => "/sign-in?next=" + encodeURIComponent(adminReturn(pathname) ?? adminDashboardPath)
const sections = [
  { label: "Dashboard", href: adminDashboardPath, icon: House },
  { label: "Users", href: adminUsersPath, icon: Users },
  { label: "Services", href: adminServicesPath, icon: Layers3 },
  { label: "Bookings", href: adminDashboardPath + "#admin-bookings", icon: CalendarDays },
  { label: "Subscriptions", href: adminDashboardPath + "#admin-platform", icon: Crown },
  { label: "Transactions", href: adminTransactionsPath, icon: ReceiptText },
]

export function AdminRequestError({ error, retry, title = "Unable to load the dashboard" }: { error: unknown; retry: () => void; title?: string }) {
  const pathname = usePathname()
  const status = error instanceof AdminApiError ? error.status : 0
  return <div role="alert"><WorkspaceState
    title={status === 403 ? "Admin access required" : status === 401 ? "Sign in required" : status === 404 ? "Record not found" : title}
    text={status === 403 ? "This workspace is available to authorized Administrators." : status === 401 ? "Sign in to access this workspace." : "Check your connection and try again."}>
    {status === 401 ? <Link href={signInFor(pathname)} className="wp-button">Sign in</Link>
      : status !== 403 && <button type="button" className="wp-button wp-button-outline" onClick={retry}>Try again</button>}
  </WorkspaceState></div>
}

function Gate({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  const user = session.data?.user
  const router = useRouter()
  const pathname = usePathname()
  const profile = useQuery({
    queryKey: ["admin-profile", user?.id],
    enabled: Boolean(user && !session.error),
    queryFn: ({ signal }) => getAdminProfile(signal),
  })

  const redirect = !session.isPending && !user && (!session.error || session.error.status === 401)
  useEffect(() => { if (redirect) router.replace(signInFor(pathname)) }, [pathname, redirect, router])

  if (session.isPending || redirect || (user && profile.isPending && !session.error)) {
    return <main className="vendor-gateway">
      <LoadingLabel>Checking your account…</LoadingLabel>
      <div className="admin-gate-skeleton" aria-hidden="true" />
    </main>
  }
  if (session.error) return <main className="vendor-gateway"><AdminRequestError error={new AdminApiError(session.error.status)} retry={() => void session.refetch()} /></main>
  if (!user || !profile.data || profile.isError) {
    return <main className="vendor-gateway"><AdminRequestError error={profile.error} retry={() => void profile.refetch()} /></main>
  }

  const { name } = profile.data
  const pageTitle = {
    [adminUsersPath]: "Users Management",
    [adminServicesPath]: "Manage Services",
    [adminTransactionsPath]: "Transactions",
  }[pathname] ?? "Overview"
  const nav = sections.map(({ label, href, icon }) => <Link key={label} href={href} aria-current={href === pathname ? "page" : undefined}>
    <UiIcon icon={icon} size="sm" />{label}
  </Link>)
  return <div className="vendor-layout admin-layout">
    <a className="wp-skip" href="#admin-main">Skip to content</a>
    <aside className="vendor-sidebar">
      <Link href="/" className="wp-brand"><UiIcon icon={HeartHandshake} size="xl" />WedPlan<span>.</span></Link>
      <div className="vendor-identity">
        <span className="vendor-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
        <div><strong>{name}</strong><p>System Administrator</p></div>
      </div>
      <nav aria-label="Admin navigation">{nav}</nav>
      <div className="vendor-sidebar-plan admin-aside-card">
        <UiIcon icon={Crown} size="xl" /><strong>WedPlan Admin</strong>
        <p>Manage and monitor the wedding platform.</p>
      </div>
    </aside>
    <div className="vendor-content">
      <header className="vendor-topbar">
        <div className="vendor-crumb"><Link href={adminDashboardPath}>Admin Dashboard</Link><UiIcon icon={ChevronRight} size="sm" /><strong>{pageTitle}</strong></div>
        <span className="admin-topbar-name">{name}</span><DashboardAccountControls />
        <details className="vendor-mobile-links">
          <summary>Workspace <UiIcon icon={ChevronDown} size="sm" /></summary>
          <nav aria-label="Mobile Admin navigation">{nav}</nav>
        </details>
      </header>
      <main id="admin-main" className="vendor-main">{children}</main>
    </div>
  </div>
}

export function AdminWorkspace({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <div className="wp-site vendor-site"><QueryClientProvider client={client}><Gate>{children}</Gate></QueryClientProvider></div>
}
