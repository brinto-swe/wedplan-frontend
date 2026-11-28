"use client"

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { ChevronDown, HeartHandshake, Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { AccountAvatar } from "@/components/ui/account-avatar"
import { UiIcon } from "@/components/ui/icon"
import { authClient, fetchProtectedProfile, ProtectedProfileError } from "@/lib/auth"
import { accountProfile, type AccountProfile } from "@/lib/profile"

function Wordmark() {
  return <Link href="/" className="wp-brand"><UiIcon icon={HeartHandshake} size="lg" /> WedPlan</Link>
}

const accountDestinations = {
  customer: { dashboard: "/customer/dashboard", profile: "/customer/profile" },
  vendor: { dashboard: "/vendor/dashboard", profile: "/vendor/profile" },
  admin: { dashboard: "/admin/dashboard", profile: null },
} as const

function AccountIdentity({ account }: { account: AccountProfile }) {
  return <span className="wp-account-identity">
    <AccountAvatar name={account.name} image={account.image} />
    <span>{account.name}</span>
  </span>
}

function AccountActions({ account, close, logout, signingOut }: {
  account: AccountProfile; close: () => void; logout: () => void; signingOut: boolean
}) {
  const { dashboard, profile } = accountDestinations[account.role]
  return <>
    <Link href={dashboard} onClick={close}>Dashboard</Link>
    {profile && <Link href={profile} onClick={close}>Profile Settings</Link>}
    <button type="button" onClick={logout} disabled={signingOut}>{signingOut ? "Signing out…" : "Logout"}</button>
  </>
}

function GuestLinks({ close }: { close?: () => void }) {
  return <>
    <Link href="/sign-in" onClick={close} className={close ? undefined : "wp-button wp-button-outline"}>Sign in</Link>
    <Link href="/sign-up" onClick={close} className={close ? undefined : "wp-button"}>Sign up</Link>
  </>
}

export function PublicHeader() {
  const [client] = useState(() => new QueryClient())
  return <QueryClientProvider client={client}><Header /></QueryClientProvider>
}

function Header() {
  const mobile = useRef<HTMLDetailsElement>(null)
  const dropdown = useRef<HTMLDetailsElement>(null)
  const pathname = usePathname()
  const session = authClient.useSession()
  const user = session.data?.user
  const [signingOut, setSigningOut] = useState(false)
  const profile = useQuery({
    queryKey: ["public-account", session.data?.session.id, user?.id, user?.name, user?.image],
    enabled: Boolean(user && !session.error),
    queryFn: async ({ signal }) => {
      const account = accountProfile.parse(await fetchProtectedProfile(signal))
      if (account.id !== user?.id) throw new ProtectedProfileError(403, "Account unavailable")
      return account
    },
    retry: false,
    gcTime: 0,
  })
  const closeMobile = () => { if (mobile.current) mobile.current.open = false }
  const closeAccount = () => { if (dropdown.current) dropdown.current.open = false }
  const sessionFailed = Boolean(session.error && session.error.status !== 401)
  const expired = profile.error instanceof ProtectedProfileError && profile.error.status === 401
  const checking = session.isPending || Boolean(user && !session.error && profile.isPending)
  const failed = sessionFailed || Boolean(user && profile.isError && !expired)
  const account = !checking && !failed && !session.error && user ? profile.data : undefined

  async function logout() {
    setSigningOut(true)
    try {
      const { error } = await authClient.signOut({ fetchOptions: { retry: 0, timeout: 10_000 } })
      if (error) throw error
      closeAccount()
      closeMobile()
    } catch {
      toast.error("Unable to sign out. Please try again.")
    } finally {
      setSigningOut(false)
    }
  }

  const accountState = checking ? <span className="wp-account-message" role="status">Checking account…</span>
    : failed ? <div className="wp-account-message">
      <span role="status">Account unavailable</span>
      <button type="button" onClick={() => void (sessionFailed ? session.refetch() : profile.refetch())}>Retry</button>
    </div> : null
  return (
    <header className="wp-header">
      <div className="wp-wrap wp-nav">
        <Wordmark />
        <nav className="wp-desktop-nav" aria-label="Main navigation">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Home</Link>
          <Link href="/services" aria-current={pathname === "/services" ? "page" : undefined}>Browse services</Link>
          <Link href="/#categories">Categories</Link>
        </nav>
        <div className="wp-desktop-signin wp-auth-links">
          {account ? <details className="wp-account-dropdown" ref={dropdown}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeAccount() }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && event.currentTarget.open) {
                closeAccount()
                event.currentTarget.querySelector("summary")?.focus()
              }
            }}>
            <summary aria-label={account.name + " account"}><AccountIdentity account={account} /><UiIcon icon={ChevronDown} size="sm" /></summary>
            <nav aria-label="Account navigation"><AccountActions account={account} signingOut={signingOut} logout={logout} close={closeAccount} /></nav>
          </details> : accountState ?? <GuestLinks />}
        </div>
        <details className="wp-mobile-nav" ref={mobile}>
          <summary aria-label="Navigation menu"><UiIcon icon={Menu} size="lg" /></summary>
          <nav aria-label="Mobile navigation">
            <Link href="/" onClick={closeMobile}>Home</Link><Link href="/services" onClick={closeMobile}>Browse services</Link>
            <Link href="/#categories" onClick={closeMobile}>Categories</Link>
            {account ? <div className="wp-mobile-account">
              <AccountIdentity account={account} />
              <AccountActions account={account} signingOut={signingOut} logout={logout} close={closeMobile} />
            </div> : accountState ?? <GuestLinks close={closeMobile} />}
          </nav>
        </details>
      </div>
    </header>
  )
}
