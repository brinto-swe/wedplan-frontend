"use client"

import { UiIcon } from "@/components/ui/icon"
import { LoadingLabel } from "@/components/ui/loading-label"
import { DashboardAccountControls } from "@/components/ui/dashboard-account-controls"
import { AccountAvatar } from "@/components/ui/account-avatar"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { CalendarDays, ChevronDown, ChevronRight, Crown, HeartHandshake, LayoutDashboard, Layers3, Plus, User } from "lucide-react"

import { ActionLink } from "@/components/public/ui"
import { authClient } from "@/lib/auth"
import { signInFor } from "@/lib/auth-navigation"
import { profileKey } from "@/lib/profile"
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
  return <div className="vendor-loading">
    <LoadingLabel>{text}</LoadingLabel><div aria-hidden="true" />
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
  { href: "/vendor/bookings", label: "Booking Requests", icon: CalendarDays },
  { href: "/vendor/subscription", label: "Subscription", icon: Crown },
  { href: "/vendor/profile", label: "Profile Settings", icon: User },
]

function VendorGate({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  const user = session.data?.user
  const profile = useQuery({
    queryKey: profileKey("vendor", user?.id),
    enabled: Boolean(user && !session.error),
    queryFn: ({ signal }) => getVendorProfile(signal),
  })
  const pathname = usePathname()
  const router = useRouter()
  const signIn = !user && (!session.error || session.error.status === 401)
  useEffect(() => {
    if (signIn && !session.isPending) router.replace(signInFor(pathname))
  }, [pathname, router, session.isPending, signIn])

  if (session.isPending || signIn || (user && profile.isPending && !session.error)) return <div className="vendor-gateway"><LoadingState /></div>
  if (session.error) {
    const status = session.error.status
    const error = status === 401 || status === 403 ? new VendorApiError(status, status === 401 ? "Sign in to access the vendor workspace." : "This account cannot access the vendor workspace.") : null
    return <div className="vendor-gateway"><RequestError error={error} retry={() => void session.refetch()} /></div>
  }
  if (!user) return <div className="vendor-gateway"><WorkspaceState title="Sign in to your workspace" text="Use your WedPlan vendor account to manage services."><ActionLink href="/sign-in">Sign in</ActionLink></WorkspaceState></div>
  if (!profile.data || profile.error) return <div className="vendor-gateway"><RequestError error={profile.error} retry={() => void profile.refetch()} /></div>

  return <WorkspaceContext.Provider value={{ profile: profile.data, plan: vendorPlan(user) }}>{children}</WorkspaceContext.Provider>
}

function VendorShell({ children }: { children: ReactNode }) {
  const { profile, plan } = useVendor()
  const pathname = usePathname()
  return (
    <div className="vendor-layout">
      <a className="wp-skip" href="#vendor-main">Skip to content</a>
      <aside className="vendor-sidebar">
        <Link className="wp-brand" href="/"><UiIcon icon={HeartHandshake} size="xl" /> WedPlan<span>.</span></Link>
        <div className="vendor-identity"><AccountAvatar name={profile.name} image={profile.image} /><div><strong>{profile.name}</strong><p>{profile.businessName || "Vendor account"}</p></div></div>
        <nav aria-label="Vendor navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/vendor/services" && pathname.endsWith("/edit"))
            return <Link key={href} href={href} aria-current={active ? "page" : undefined}><UiIcon icon={Icon} size="sm" />{label}</Link>
          })}
        </nav>
        <div className="vendor-sidebar-plan"><UiIcon icon={Crown} size="xl" /><strong>{plan === "Premium" ? "Premium Plan" : plan === "Free" ? "Free Plan" : "Subscription"}</strong><p>{plan === "Premium" ? "Unlimited active service listings." : plan === "Free" ? "Publish up to three active services." : "Plan information unavailable."}</p></div>
        <Link href="/services" className="vendor-public-link">Public directory</Link>
      </aside>
      <div className="vendor-content">
        <header className="vendor-topbar">
          <div className="vendor-crumb"><Link href="/vendor/dashboard">Vendor Dashboard</Link>{pathname !== "/vendor/dashboard" && <><UiIcon icon={ChevronRight} size="sm" /><strong>{pathname.endsWith("/edit") ? "Edit Service" : pathname.endsWith("/new") ? "Add New Service" : navigation.find((item) => item.href === pathname)?.label}</strong></>}</div>
          <span>{profile.name}</span>
          <span className="vendor-badge">{plan === "Unavailable" ? "Plan unavailable" : `${plan} plan`}</span>
          <DashboardAccountControls />
          <details className="vendor-mobile-links">
            <summary>Workspace <UiIcon icon={ChevronDown} size="sm" /></summary>
            <nav aria-label="Mobile vendor navigation">
              {navigation.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
              <Link href="/services">Public directory</Link>
            </nav>
          </details>
        </header>
        <main id="vendor-main" className="vendor-main">{children}</main>
      </div>
    </div>
  )
}

export function VendorAccess({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } }))
  return <QueryClientProvider client={client}><VendorGate>{children}</VendorGate></QueryClientProvider>
}

export function VendorWorkspace({ children }: { children: ReactNode }) {
  return <div className="wp-site vendor-site">
    <VendorAccess><VendorShell>{children}</VendorShell></VendorAccess>
  </div>
}
