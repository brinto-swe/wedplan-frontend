"use client"

import Link from "next/link"
import { useState } from "react"
import { VendorBanner, VendorStats } from "@/components/vendor/presentation"
import { LoadingLabel } from "@/components/ui/loading-label"
import { CalendarDays, CircleCheck, Clock3, CircleX } from "lucide-react"
import { statuses, type BookingRole } from "@/lib/bookings"
import { BookingBadge, BookingError, eventDay, ServiceTitle, useBookings, useServiceInfo } from "./shared"
import { BookingDetails } from "./details"

const size = 6
export function BookingList({ role, userId }: { role: BookingRole; userId: string }) {
  const query = useBookings(role, userId)
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string>()
  const items = query.data ?? []
  const scoped = items.filter((item) => status === "all" || item.status === status)
  const needle = search.trim().toLowerCase()
  const names = useServiceInfo(needle ? scoped : [])
  const matches = scoped.filter((item) => {
    const service = names.get(item.serviceId)
    return !needle || [service?.title, service?.vendorName, item.eventLocation, item.vendorId,
      role === "vendor" ? item.customerContact.name : undefined].some((value) => value?.toLowerCase().includes(needle))
  })
  const searching = !!needle && scoped.some((item) => names.get(item.serviceId) === undefined)
  const pages = Math.max(1, Math.ceil(matches.length / size))
  const current = Math.min(page, pages)
  const visible = matches.slice((current - 1) * size, current * size)
  const services = useServiceInfo(visible)
  const title = role === "vendor" ? "Booking Requests" : "My Bookings"
  const count = (value: string) => items.filter((item) => item.status === value).length
  return <div className="vendor-stack">
    <VendorBanner title={title} description={role === "vendor" ? "Review and respond to customer requests for your wedding services." : "Track and manage your wedding service bookings."} />
    <VendorStats items={[
      { label: "Total", value: query.data ? items.length : "—", icon: CalendarDays },
      { label: "Pending", value: query.data ? count("pending") : "—", icon: Clock3 },
      { label: "Accepted", value: query.data ? count("accepted") : "—", icon: CircleCheck },
      { label: "Rejected", value: query.data ? count("rejected") : "—", icon: CircleX },
    ]} />
    {query.isPending ? <LoadingLabel>Loading bookings…</LoadingLabel> : query.isError ? <BookingError error={query.error} retry={() => void query.refetch()} /> :
      <div className={selected ? "booking-list-with-detail" : undefined}>
        <section className="vendor-card">
          <div className="booking-filters" aria-label="Booking status">
            {["all", ...statuses].map((value) => <button key={value} type="button" aria-pressed={value === status}
              onClick={() => { setStatus(value); setPage(1) }}>{value === "all" ? "All bookings" : value} ({value === "all" ? items.length : count(value)})</button>)}
          </div>
          <div className="vendor-toolbar"><label className="vendor-search">Search bookings<input type="search" value={search} placeholder="Service, vendor, or location" onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label></div>
          {!matches.length && searching ? <LoadingLabel>Searching service titles…</LoadingLabel> : !matches.length ? <div className="vendor-state"><h2>{items.length ? "No matching bookings" : "No bookings yet"}</h2>
            <p>{items.length ? "Try a different search or status." : role === "vendor" ? "Requests for your services will appear here." : "Wedding service bookings will appear here."}</p>
            {role === "customer" && !items.length && <Link className="wp-button" href="/services">Browse services</Link>}
          </div> : <>
            <ul className="booking-rows">{visible.map((booking) => <li key={booking.id} className={selected === booking.id ? "booking-row-selected" : undefined}>
              <div><ServiceTitle booking={booking} service={services.get(booking.serviceId)} />{role === "vendor" && <p>From {booking.customerContact.name}</p>}
                <p><time dateTime={booking.eventDate}>{eventDay(booking.eventDate)}</time> · {booking.eventLocation}</p></div>
              <BookingBadge status={booking.status} />
              {role === "customer" ? <Link className="wp-button wp-button-outline" href={`/customer/bookings/${booking.id}`}>View Details</Link>
                : <button type="button" className="wp-button wp-button-outline" onClick={() => setSelected(booking.id)}>View Details</button>}
            </li>)}</ul>
            <div className="vendor-pagination"><p>Page {current} of {pages} · {matches.length} results</p><div className="vendor-actions">
              <button className="wp-button wp-button-outline" type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button>
              <button className="wp-button wp-button-outline" type="button" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button>
            </div></div>
          </>}
        </section>
        {selected && <BookingDetails key={selected} role="vendor" userId={userId} id={selected} close={() => setSelected(undefined)} />}
      </div>}
  </div>
}
