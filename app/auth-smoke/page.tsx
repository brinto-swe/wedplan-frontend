"use client"

import { useState, type FormEvent } from "react"

import { ThemeSelect } from "@/components/ui/theme-select"
import { Button } from "@/components/ui/button"
import {
  authClient,
  fetchProtectedProfile,
  signInEmail,
  signInWithProvider,
  signUpEmail,
} from "@/lib/auth"

export default function AuthSmokePage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setStatus("")
    try {
      setStatus(await action())
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed.")
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email"))
    const password = String(form.get("password"))
    void run(async () => {
      const result = mode === "signup"
        ? await signUpEmail({
            name: String(form.get("name")),
            email,
            password,
            role: form.get("role") === "vendor" ? "vendor" : "customer",
          })
        : await signInEmail(email, password)
      return result.error ? "Authentication failed." : "Signed in."
    })
  }

  return (
    <main className="mx-auto max-w-md space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">Authentication smoke test</h1><ThemeSelect /></div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          Mode
          <select className="ml-2 rounded border bg-background p-1" value={mode}
            onChange={(event) => setMode(event.target.value === "signup" ? "signup" : "signin")}>
            <option value="signin">Sign in</option>
            <option value="signup">Sign up</option>
          </select>
        </label>
        {mode === "signup" && (
          <>
            <label className="block">Name
              <input name="name" autoComplete="name" className="ml-2 rounded border p-1" required />
            </label>
            <label className="block">Role
              <select name="role" className="ml-2 rounded border bg-background p-1">
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
              </select>
            </label>
          </>
        )}
        <label className="block">Email
          <input name="email" type="email" autoComplete="email" className="ml-2 rounded border p-1" required />
        </label>
        <label className="block">Password
          <input key={mode} name="password" type="password" minLength={8} maxLength={128}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="ml-2 rounded border p-1" required />
        </label>
        <Button type="submit" disabled={busy}>{mode === "signup" ? "Sign up" : "Sign in"}</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {(["google", "github"] as const).map((provider) => (
          <Button key={provider} disabled={busy} onClick={() => void run(async () => {
            const { error } = await signInWithProvider(provider)
            return error ? "Provider sign-in failed." : "Redirecting to provider."
          })}>Continue with {provider === "google" ? "Google" : "GitHub"}</Button>
        ))}
        <Button disabled={busy} onClick={() => void run(async () => {
          const { data, error } = await authClient.getSession({ fetchOptions: { throw: false } })
          return error ? "Session lookup failed." : data ? `Session active for ${data.user.email}.` : "No active session."
        })}>Check session</Button>
        <Button disabled={busy} onClick={() => void run(async () => {
          const profile = await fetchProtectedProfile()
          return `Protected profile verified for ${profile.email} (${profile.role}).`
        })}>Check bearer access</Button>
        <Button disabled={busy} onClick={() => void run(async () => {
          const { error } = await authClient.signOut()
          return error ? "Sign-out failed." : "Signed out."
        })}>Sign out</Button>
      </div>
      <p role="status">{status}</p>
    </main>
  )
}
