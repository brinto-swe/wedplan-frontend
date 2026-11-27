"use client"

import { useState, useSyncExternalStore } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { LogOut, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { authClient } from "@/lib/auth"
import { UiIcon } from "./icon"
import { Switch } from "./switch"

const subscribe = () => () => {}

export function DashboardAccountControls() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const { resolvedTheme, setTheme } = useTheme()
  const dark = mounted && resolvedTheme === "dark"
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    try {
      const { error } = await authClient.signOut({ fetchOptions: { retry: 0, timeout: 10_000 } })
      if (error) throw error
    } catch {
      toast.error("Unable to sign out. Please try again.")
      setSigningOut(false)
      return
    }
    queryClient.clear()
    // A document navigation also discards the client router and session state.
    window.location.replace("/sign-in")
  }

  return (
    <div className="vendor-account-controls">
      <div className="vendor-theme-toggle">
        <UiIcon icon={dark ? Moon : Sun} size="sm" />
        <span aria-hidden="true">{dark ? "Dark" : "Light"}</span>
        <Switch aria-label="Dark mode" checked={dark} disabled={!mounted}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
      </div>
      <button type="button" className="wp-button wp-button-outline vendor-sign-out"
        disabled={signingOut} aria-busy={signingOut} onClick={() => void signOut()}>
        <UiIcon icon={LogOut} size="sm" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  )
}
