"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { authClient } from "@/lib/auth"
import { BookingApiError, bookingInput, createBooking, utcToday, type Booking } from "@/lib/bookings"
import { LoadingLabel } from "@/components/ui/loading-label"

export function BookingRequest({ serviceId, autoOpen }: { serviceId: string; autoOpen: boolean }) {
  const session = authClient.useSession()
  const user = session.data?.user
  const [pending, setPending] = useState(false)
  const [issues, setIssues] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>()
  const [created, setCreated] = useState<Booking>()
  const panel = useRef<HTMLElement>(null)
  const signIn = `/sign-in?next=${encodeURIComponent(`/services/${serviceId}?book=1`)}`
  useEffect(() => {
    if (autoOpen && !session.isPending) panel.current?.focus()
  }, [autoOpen, session.isPending])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || created) return
    setError(undefined)
    const data = new FormData(event.currentTarget)
    const parsed = bookingInput.safeParse({
      serviceId, eventDate: data.get("eventDate"), eventLocation: data.get("eventLocation"),
      customerContact: { name: data.get("name"), email: String(data.get("email") ?? "").trim(), phone: data.get("phone") },
      notes: data.get("notes"),
    })
    if (!parsed.success) {
      setIssues(Object.fromEntries(parsed.error.issues.map(({ path, message }) => [path.join("."), message])))
      return
    }
    setIssues({})
    setPending(true)
    try { setCreated(await createBooking(parsed.data)) }
    catch (failure) {
      setError(failure)
      if (failure instanceof BookingApiError) setIssues(failure.issues)
    } finally { setPending(false) }
  }

  const invalid = (key: string) => ({ "aria-invalid": !!issues[key], "aria-describedby": issues[key] ? `booking-error-${key}` : undefined })
  const issue = (key: string) => issues[key] && <span className="booking-field-error" id={`booking-error-${key}`}>{issues[key]}</span>
  if (!/^[a-f0-9]{24}$/i.test(serviceId)) return <p>Bookings are available for live service listings.</p>
  return <section ref={panel} tabIndex={-1} aria-label="Booking request" className="booking-request">
    {session.isPending ? <LoadingLabel>Checking your session…</LoadingLabel> : session.error && session.error.status !== 401 ?
      <div className="booking-feedback" role="alert"><p>{session.error.status === 403 ? "This account cannot request bookings." : "Your session could not be checked."}</p>
        {session.error.status !== 403 && <button type="button" className="wp-button wp-button-outline" onClick={() => void session.refetch()}>Try again</button>}</div>
      : !user ? <Link href={signIn} className="wp-button">Sign in to request booking</Link>
      : "role" in user && user.role !== "customer" ? <p>Only customer accounts can request bookings.</p>
      : created ? <div className="booking-success" role="status"><strong>Booking request sent</strong><p>The vendor can now review your request.</p><Link className="wp-text-link" href={`/customer/bookings/${created.id}`}>View your booking</Link></div>
      : <form method="post" onSubmit={submit} noValidate>
        <fieldset disabled={pending}>
          <label>Event date<input name="eventDate" type="date" min={utcToday()} required {...invalid("eventDate")} />{issue("eventDate")}</label>
          <label>Event location<input name="eventLocation" maxLength={200} required {...invalid("eventLocation")} />{issue("eventLocation")}</label>
          <label>Contact name<input name="name" defaultValue={user.name} autoComplete="name" maxLength={120} required {...invalid("customerContact.name")} />{issue("customerContact.name")}</label>
          <label>Email<input name="email" type="email" defaultValue={user.email} autoComplete="email" required {...invalid("customerContact.email")} />{issue("customerContact.email")}</label>
          <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={32} required {...invalid("customerContact.phone")} />{issue("customerContact.phone")}</label>
          <label>Message (optional)<textarea name="notes" rows={3} maxLength={2000} {...invalid("notes")} />{issue("notes")}</label>
          <button className="wp-button" type="submit">{pending ? "Sending…" : "Send Booking Request"}</button>
        </fieldset>
        {Object.keys(issues).length > 0 && !error && <p className="booking-field-error" role="alert">Check the highlighted fields.</p>}
        {!!error && <div className="booking-feedback" role="alert">
          <p>{error instanceof BookingApiError ? error.message : "The request could not be confirmed. Check My Bookings before retrying."}</p>
          {error instanceof BookingApiError && error.status === 401 && <Link href={signIn}>Sign in</Link>}
        </div>}
      </form>}
  </section>
}
