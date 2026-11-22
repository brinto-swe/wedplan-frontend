"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { authClient, signInEmail, signUpEmail } from "@/lib/auth"

export type AuthMode = "sign-in" | "sign-up"
type Provider = "google" | "github"

const credentials = z.object({
  email: z.string().trim().max(254, "Email is too long.").pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password.").max(128, "Use no more than 128 characters."),
})
const registration = credentials.extend({
  name: z.string().trim().min(1, "Enter your full name.").max(120, "Use no more than 120 characters."),
  password: credentials.shape.password.min(8, "Use at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your password."),
  role: z.enum(["customer", "vendor"], { error: "Choose Customer or Vendor." }),
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
  path: ["confirmPassword"], message: "Passwords must match.",
})

function errorMessage(error: { code?: string; status?: number }, signup: boolean) {
  if (error.status === 429) return "Too many attempts. Please wait a moment before trying again."
  if (!signup && (error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD")) {
    return "That email or password didn’t match. Please try again."
  }
  if (error.status === 403) return "We couldn’t sign you in with this account."
  if (signup && (error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")) {
    return "An account already exists for this email. Try signing in."
  }
  return signup ? "We couldn’t create your account. Please try again." : "We couldn’t sign you in. Please try again."
}

const fields = {
  name: { label: "Full name", type: "text", autoComplete: "name", maxLength: 120 },
  email: { label: "Email address", type: "email", autoComplete: "email", maxLength: 254 },
  password: { label: "Password", type: "password", autoComplete: "current-password", maxLength: 128 },
  confirmPassword: { label: "Confirm password", type: "password", autoComplete: "new-password", maxLength: 128 },
} as const

export function AuthForm({ mode, oauthReturn, oauthError }: { mode: AuthMode; oauthReturn: boolean; oauthError: boolean }) {
  const signup = mode === "sign-up"
  const router = useRouter()
  const session = authClient.useSession()
  const [pending, setPending] = useState<"email" | Provider | null>(null)
  const [issues, setIssues] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [showCallbackError, setShowCallbackError] = useState(oauthError || oauthReturn)
  const [success, setSuccess] = useState("")
  const [passwordHelp, setPasswordHelp] = useState(false)
  const authenticated = Boolean(session.data?.user)

  useEffect(() => {
    if (pending || (!success && !authenticated)) return
    const timer = window.setTimeout(() => router.replace("/services"), success || oauthReturn ? 1100 : 0)
    return () => window.clearTimeout(timer)
  }, [authenticated, oauthReturn, pending, router, success])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || success || authenticated) return
    setIssues({})
    setError("")
    setShowCallbackError(false)
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const input = signup
      ? { mode: "sign-up" as const, result: registration.safeParse(values) }
      : { mode: "sign-in" as const, result: credentials.safeParse(values) }
    if (!input.result.success) {
      const messages: Record<string, string> = {}
      for (const issue of input.result.error.issues) {
        const field = String(issue.path[0])
        messages[field] ??= issue.message
      }
      setIssues(messages)
      const first = event.currentTarget.elements.namedItem(Object.keys(messages)[0])
      if (first instanceof HTMLElement) first.focus()
      return
    }

    setPending("email")
    try {
      const { email, password } = input.result.data
      const result = input.mode === "sign-up"
        ? await signUpEmail({ name: input.result.data.name, email, password, role: input.result.data.role })
        : await signInEmail(email, password)
      if (result.error) {
        setError(errorMessage(result.error, signup))
        return
      }
      const current = await authClient.getSession()
      if (!current.data?.user) {
        setError(signup
          ? "Your account was created, but we couldn’t start a session. Try signing in."
          : "We couldn’t confirm your session. Please try signing in again.")
        return
      }
      setSuccess(signup ? "Your account is ready. Taking you to the directory…" : "Signed in. Taking you to the directory…")
    } catch {
      setError("We couldn’t reach WedPlan. Check your connection and try again.")
    } finally {
      setPending(null)
    }
  }

  async function startOAuth(provider: Provider) {
    if (pending || success || authenticated) return
    setPending(provider)
    setIssues({})
    setError("")
    setShowCallbackError(false)
    try {
      const origin = window.location.origin
      const { data, error } = await authClient.signIn.social({
        provider,
        callbackURL: new URL(`/${mode}?oauth=return`, origin).href,
        errorCallbackURL: new URL(`/${mode}?oauth=failed`, origin).href,
      })
      // Better Auth follows the provider URL automatically when redirect is true.
      if (!error && data?.redirect && data.url) return
      setError(`We couldn’t connect to ${provider === "google" ? "Google" : "GitHub"}. Please try again.`)
    } catch {
      setError("We couldn’t reach WedPlan. Check your connection and try again.")
    }
    setPending(null)
  }

  if (success || (authenticated && !pending)) {
    return <p className="account-feedback account-success" role="status">
      {success || (oauthReturn ? "Signed in. Taking you to the directory…" : "You’re already signed in. Taking you to the directory…")}
    </p>
  }

  const callbackMessage = showCallbackError && (oauthError || (oauthReturn && !session.isPending))
    ? "We couldn’t complete sign-in with your provider. Please try again."
    : ""
  const checkingCallback = oauthReturn && session.isPending
  const disabled = Boolean(pending) || checkingCallback
  const visibleFields: (keyof typeof fields)[] = signup
    ? ["name", "email", "password", "confirmPassword"]
    : ["email", "password"]

  return (
    <div className="account-actions" aria-busy={disabled}>
      <div className="account-provider-grid">
        {(["google", "github"] as const).map((provider) => (
          <Button key={provider} type="button" variant="outline" disabled={disabled} onClick={() => void startOAuth(provider)}>
            {pending === provider ? "Connecting…" : `Continue with ${provider === "google" ? "Google" : "GitHub"}`}
          </Button>
        ))}
      </div>
      {signup && <p className="account-note">New Google and GitHub accounts start as Customer. Use email to register as a Vendor.</p>}
      <p className="account-divider"><span>or use email</span></p>
      {(error || callbackMessage) && <p className="account-feedback account-error" role="alert">{error || callbackMessage}</p>}
      {checkingCallback && <p role="status" className="account-note">Checking your session…</p>}
      <form method="post" onSubmit={submit} noValidate className="account-form">
        <fieldset disabled={disabled}>
          <div className="account-field-grid">
            {visibleFields.map((field) => {
              const { label, ...attributes } = fields[field]
              return <div className={signup && field.includes("assword") ? "account-field" : "account-field account-field-wide"} key={field}>
                <label htmlFor={field}>{label}</label>
                <input {...attributes} autoComplete={signup && field === "password" ? "new-password" : attributes.autoComplete}
                  id={field} name={field} required aria-invalid={Boolean(issues[field])}
                  aria-describedby={issues[field] ? `${field}-error` : signup && field === "password" ? "password-hint" : undefined} />
                {issues[field] ? <p className="account-field-error" id={`${field}-error`}>{issues[field]}</p>
                  : signup && field === "password" && <p id="password-hint" className="account-note">At least 8 characters</p>}
              </div>
            })}
            {signup && <div className="account-field account-field-wide">
              <label htmlFor="role">Account type</label>
              <select id="role" name="role" defaultValue="customer" aria-invalid={Boolean(issues.role)} aria-describedby={issues.role ? "role-error" : undefined}>
                <option value="customer">Customer</option><option value="vendor">Vendor</option>
              </select>
              {issues.role && <p id="role-error" className="account-field-error">{issues.role}</p>}
            </div>}
          </div>
          {!signup && <>
            <a href="#password-help" className="wp-text-link account-forgot" aria-expanded={passwordHelp} onClick={() => setPasswordHelp(true)}>Forgot password?</a>
            <p className="account-feedback" id="password-help" tabIndex={-1} hidden={!passwordHelp}>Password reset is currently unavailable. If you signed up with Google or GitHub, use that provider to sign in.</p>
          </>}
          <Button className="account-submit" type="submit" disabled={disabled}>
            {pending === "email" ? (signup ? "Creating account…" : "Signing in…") : signup ? "Create account" : "Sign in"}
          </Button>
        </fieldset>
      </form>
    </div>
  )
}
