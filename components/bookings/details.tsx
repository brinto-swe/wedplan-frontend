"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LoadingLabel } from "@/components/ui/loading-label"
import { BookingApiError, canCancel, getBooking, updateBooking, type BookingAction, type BookingRole } from "@/lib/bookings"
import { BookingBadge, BookingError, bookingKey, detailKey, eventDay, ServiceTitle, useServiceInfo } from "./shared"

const labels = { cancel: "Cancel booking", accept: "Accept request", reject: "Reject request" }

export function BookingDetails({ role, userId, id, close }: { role: BookingRole; userId: string; id: string; close?: () => void }) {
  const key = detailKey(role, userId, id)
  const client = useQueryClient()
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getBooking(role, id, signal), retry: false })
  const booking = query.data
  const info = useServiceInfo(booking ? [booking] : [])
  const [action, setAction] = useState<BookingAction>()
  const [notice, setNotice] = useState("")
  const dialog = useRef<HTMLDialogElement>(null)
  const mutation = useMutation({ mutationFn: (value: BookingAction) => updateBooking(role, id, value),
    onSuccess: (updated) => {
      client.setQueryData(key, updated)
      void client.invalidateQueries({ queryKey: bookingKey(role, userId) })
      setAction(undefined)
      setNotice(`Booking ${updated.status}.`)
    },
    onError: (error) => { if (error instanceof BookingApiError && error.status === 409) void client.invalidateQueries({ queryKey: bookingKey(role, userId) }) },
  })
  useEffect(() => {
    if (action && !dialog.current?.open) dialog.current?.showModal()
    if (!action && dialog.current?.open) dialog.current.close()
  }, [action])
  const actions: BookingAction[] = !booking ? [] : role === "customer" ? canCancel(booking) ? ["cancel"] : []
    : booking.status === "pending" ? ["accept", "reject"] : []
  return <section className="vendor-card booking-detail">
    <div className="vendor-section-head"><h2>Booking Details</h2>{close ? <button className="wp-button wp-button-outline" type="button" onClick={close}>Close</button> : <Link className="wp-text-link" href="/customer/bookings">My Bookings</Link>}</div>
    {query.isPending ? <LoadingLabel>Loading booking details…</LoadingLabel> : query.isError ? <BookingError error={query.error} retry={() => void query.refetch()} /> : booking && <>
      <div className="booking-summary"><ServiceTitle booking={booking} service={info.get(booking.serviceId)} showImage={role === "customer"} /><BookingBadge status={booking.status} /></div>
      <h3>Event Information</h3>
      <dl><dt>Event date</dt><dd>{eventDay(booking.eventDate)}</dd><dt>Location</dt><dd>{booking.eventLocation}</dd><dt>Created</dt><dd>{eventDay(booking.createdAt)}</dd></dl>
      <h3>Customer Contact</h3><p>{booking.customerContact.name}</p><p>{booking.customerContact.email}</p><p>{booking.customerContact.phone}</p>
      <h3>Customer Notes</h3><p className="booking-notes">{booking.notes || "No notes provided."}</p>
      {notice && <p className="booking-success" role="status">{notice}</p>}
      {role === "customer" && !actions.length && <p className="vendor-muted">{booking.status === "pending" ? "The event date has passed." : "This booking can no longer be cancelled."}</p>}
      <div className="vendor-actions">{actions.map((value) => <button key={value} type="button" className={value === "accept" ? "wp-button" : "wp-button wp-button-outline"} onClick={() => { mutation.reset(); setAction(value) }}>{labels[value]}</button>)}</div>
    </>}
    <dialog ref={dialog} className="vendor-confirm booking-dialog" aria-labelledby="booking-confirm-title" onCancel={(event) => { event.preventDefault(); if (!mutation.isPending) setAction(undefined) }}>
      {action && <><h2 id="booking-confirm-title">{labels[action]}?</h2><p>This will update the booking status.</p>
        {mutation.isError && <BookingError error={mutation.error} />}
        <div className="vendor-actions"><button type="button" className="wp-button wp-button-outline" disabled={mutation.isPending} onClick={() => setAction(undefined)}>Go back</button>
          <button type="button" className="wp-button" disabled={mutation.isPending || !actions.includes(action)} onClick={() => mutation.mutate(action)}>{mutation.isPending ? "Saving…" : labels[action]}</button></div></>}
    </dialog>
  </section>
}
