"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { createContext, useContext, useState, type ReactNode } from "react"
import { CalendarDays, ChevronDown, Crown, HeartHandshake, LayoutDashboard, Layers3, Plus, User } from "lucide-react"

import { ActionLink } from "@/components/public/ui"
import { authClient } from "@/lib/auth"
import { getVendorProfile, listVendorServices, VendorApiError, vendorPlan, type Plan, type VendorProfile } from "@/lib/vendor-services"

const WorkspaceContext = createContext<{ profile: VendorProfile; plan: Plan } | null>(null)

export function useVendor() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error("Vendor workspace context missing")
  return context
}

export function vendorServicesKey(id: string) {
  return ["vendor-services", id]
}

export function useVendorServices() {
  const { profile } = useVendor()
  return useQuery({ queryKey: vendorServicesKey(profile.id), queryFn: ({ signal }) => listVendorServices(signal) })
}

export function WorkspaceState({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <section className="vendor-state">
    <h2>{title}</h2><p>{text}</p>{children}
  </section>
}

export function LoadingState({ text = "Loading your workspace…" }: { text?: string }) {
  return <div role="status" className="vendor-loading">
    <p>{text}</p><div aria-hidden="true" />
  </div>
}

export function RequestError({ error, retry }: { error: unknown; retry?: () => void }) {
  const status = error instanceof VendorApiError ? error.status : 0
  return <div role="alert">
    <WorkspaceState title={status === 401 ? "Sign in required" : status === 403 ? "Vendor access required" : status === 404 ? "Service not found" : "Unable to load this page"}
      text={error instanceof VendorApiError ? error.message : "Check your connection and try again."}>
      {status === 401 ? <ActionLink href="/sign-in">Sign in</ActionLink>
        : status === 403 ? <ActionLink href="/services" secondary>Browse public services</ActionLink>
        : status === 404 ? <ActionLink href="/vendor/services" secondary>Back to My Services</ActionLink>
        : retry && <button className="wp-button wp-button-outline" type="button" onClick={retry}>Try again</button>}
    </WorkspaceState>
  </div>
}

const navigation = [
  { href: "/vendor/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/vendor/services", label: "My Services", icon: Layers3 },
  { href: "/vendor/services/new", label: "Add Service", icon: Plus },
]

function VendorGate({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  const user = session.data?.user
  const profile = useQuery({
    queryKey: ["vendor-profile", user?.id],
    enabled: Boolean(user && !session.error),
    queryFn: ({ signal }) => getVendorProfile(signal),
  })
  const pathname = usePathname()

  if (session.isPending || (user && profile.isPending && !session.error)) return <div className="vendor-gateway"><LoadingState /></div>
  if (session.error) {
    const status = session.error.status
    const error = status === 401 || status === 403 ? new VendorApiError(status, status === 401 ? "Sign in to access the vendor workspace." : "This account cannot access the vendor workspace.") : null
    return <div className="vendor-gateway"><RequestError error={error} retry={() => void session.refetch()} /></div>
  }
  if (!user) return <div className="vendor-gateway"><WorkspaceState title="Sign in to your workspace" text="Use your WedPlan vendor account to manage services."><ActionLink href="/sign-in">Sign in</ActionLink></WorkspaceState></div>
  if (!profile.data || profile.error) return <div className="vendor-gateway"><RequestError error={profile.error} retry={() => void profile.refetch()} /></div>

  const plan = vendorPlan(user)
  return <WorkspaceContext.Provider value={{ profile: profile.data, plan }}>
    <div className="vendor-layout">
      <a className="wp-skip" href="#vendor-main">Skip to content</a>
      <aside className="vendor-sidebar">
        <Link className="wp-brand" href="/"><HeartHandshake size={29} aria-hidden="true" /> WedPlan<span>.</span></Link>
        <div className="vendor-identity"><span className="vendor-avatar" aria-hidden="true">{profile.data.name.trim().charAt(0).toUpperCase()}</span><div><strong>{profile.data.name}</strong><p>Vendor account</p></div></div>
        <nav aria-label="Vendor navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/vendor/services" && pathname.endsWith("/edit"))
            return <Link key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={17} aria-hidden="true" />{label}</Link>
          })}
          {[[CalendarDays,"Booking Requests"],[Crown,"Subscription"],[User,"Profile Settings"]].map(([Icon, label]) => { const ItemIcon = Icon as typeof CalendarDays; return <span className="vendor-nav-disabled" key={String(label)} aria-disabled="true"><ItemIcon size={17} aria-hidden="true" />{String(label)}</span> })}
        </nav>
        <div className="vendor-sidebar-plan"><Crown size={28} aria-hidden="true" /><strong>{plan === "Premium" ? "Premium Plan" : plan === "Free" ? "Free Plan" : "Subscription"}</strong><p>{plan === "Premium" ? "Unlimited active service listings." : plan === "Free" ? "Publish up to three active services." : "Plan information unavailable."}</p></div>
        <Link href="/services" className="vendor-public-link">Public directory</Link>
      </aside>
      <div className="vendor-content">
        <header className="vendor-topbar">
          <div className="vendor-crumb"><Link href="/vendor/dashboard">Vendor Dashboard</Link>{pathname !== "/vendor/dashboard" && <><span aria-hidden="true">›</span><strong>{pathname.endsWith("/edit") ? "Edit Service" : pathname.endsWith("/new") ? "Add New Service" : "My Services"}</strong></>}</div>
          <span>{profile.data.name}</span>
          <span className="vendor-badge">{plan === "Unavailable" ? "Plan unavailable" : `${plan} plan`}</span>
          <details className="vendor-mobile-links">
            <summary>Workspace <ChevronDown size={15} aria-hidden="true" /></summary>
            <nav aria-label="Mobile vendor navigation">
              {navigation.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
              <Link href="/services">Public directory</Link>
            </nav>
          </details>
        </header>
        <main id="vendor-main" className="vendor-main">{children}</main>
      </div>
    </div>
  </WorkspaceContext.Provider>
}

export function VendorWorkspace({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } }))
  return <div className="wp-site vendor-site">
    <QueryClientProvider client={client}><VendorGate>{children}</VendorGate></QueryClientProvider>
  </div>
}
