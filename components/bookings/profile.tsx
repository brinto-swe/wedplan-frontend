"use client"

import { useState, type FormEvent } from "react"
import { z } from "zod"
import { authClient } from "@/lib/auth"
import { VendorBanner } from "@/components/vendor/presentation"
import { eventDay } from "./shared"

export function CustomerProfile() {
  const session = authClient.useSession()
  const user = session.data!.user
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError("")
    setNotice("")
    const result = z.string().trim().min(1).max(120).safeParse(new FormData(event.currentTarget).get("name"))
    if (!result.success) { setError("Enter a name between 1 and 120 characters."); return }
    setPending(true)
    try {
      const updated = await authClient.updateUser({ name: result.data })
      if (updated.error) setError(updated.error.status === 401 ? "Sign in again to update your profile." : "We couldn’t update your profile.")
      else { void session.refetch(); setNotice("Profile updated.") }
    } catch { setError("We couldn’t reach WedPlan. Please try again.") }
    finally { setPending(false) }
  }
  return <div className="vendor-stack">
    <VendorBanner title="Profile Settings" description="Manage your personal information and view your account details." />
    <div className="booking-dashboard-grid">
      <form method="post" className="vendor-card vendor-form" onSubmit={save}>
        <h2>Personal Information</h2>
        <fieldset disabled={pending}>
          <label>Full name<input name="name" defaultValue={user.name} autoComplete="name" maxLength={120} required /></label>
          <label>Email address<input type="email" value={user.email} readOnly /></label>
          <div className="vendor-actions"><button className="wp-button wp-button-outline" type="reset" onClick={() => { setNotice(""); setError("") }}>Reset Changes</button><button className="wp-button" type="submit">{pending ? "Saving…" : "Save Changes"}</button></div>
        </fieldset>
        {error && <p className="booking-feedback" role="alert">{error}</p>}
        {notice && <p className="booking-success" role="status">{notice}</p>}
      </form>
      <div className="vendor-stack">
        <section className="vendor-card"><h2>Profile Preview</h2><div className="vendor-identity"><span className="vendor-avatar" aria-hidden>{user.name.trim()[0]?.toUpperCase()}</span><strong>{user.name}</strong></div></section>
        <section className="vendor-card booking-detail"><h2>Account Information</h2><dl><dt>Account type</dt><dd>Customer</dd><dt>Member since</dt><dd>{eventDay(new Date(user.createdAt).toISOString())}</dd></dl></section>
      </div>
    </div>
  </div>
}
