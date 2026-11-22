"use client"

import { BookingBadge, BookingError, eventDay, useBookings } from "@/components/bookings/shared"
import Link from "next/link"
import { VendorBanner, VendorStats } from "./presentation"
import { CalendarDays, Clock3, Layers3, CircleCheck, CircleMinus } from "lucide-react"
import { ActionLink } from "@/components/public/ui"
import { activeLimit } from "@/lib/vendor-services"
import { LoadingState, RequestError, useVendor, useVendorServices } from "./workspace"

const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" })

export function Dashboard() {
  const { profile, plan } = useVendor()
  const services = useVendorServices()
  const bookings = useBookings("vendor", profile.id)
  const requests = bookings.data ?? []
  const pending = requests.filter((item) => item.status === "pending").length
  const items = services.data ?? []
  const active = items.filter(({ isActive }) => isActive).length
  const recent = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const stats = [
    { label: "Total services", value: services.data ? items.length : "—", icon: Layers3 },
    { label: "Active services", value: services.data ? active : "—", icon: CircleCheck },
    { label: "Inactive services", value: services.data ? items.length - active : "—", icon: CircleMinus },
    { label: "Total bookings", value: bookings.data ? requests.length : "—", icon: CalendarDays },
    { label: "Pending requests", value: bookings.data ? pending : "—", icon: Clock3 },
  ]

  return <div className="vendor-stack">
    <VendorBanner title={<>Welcome back,<br />{profile.name}</>} description="Manage your services and grow your wedding business with WedPlan." />
    <VendorStats items={stats} />
    {services.isPending && <LoadingState text="Loading service statistics…" />}
    {services.isError && <RequestError error={services.error} retry={() => void services.refetch()} />}
    <div className="vendor-dashboard-grid">
      <section className="vendor-card"><h2>Booking Overview</h2>{bookings.isPending ? <LoadingState text="Loading booking requests…" /> : bookings.isError ? <BookingError error={bookings.error} retry={() => void bookings.refetch()} /> : <p className="vendor-muted">{pending} pending · {requests.filter((item) => item.status === "accepted").length} accepted</p>}</section>

      <section className="vendor-card vendor-plan">
        <h2>Subscription</h2>
        <p><span className="vendor-badge">{plan === "Unavailable" ? "Status unavailable" : `${plan} plan`}</span></p>
        <p className="vendor-muted">{plan === "Premium" ? "Unlimited active services."
          : plan === "Free" ? services.data ? `${active} of ${activeLimit} active services in use.` : `Up to ${activeLimit} active services.`
            : "The current subscription is unavailable."}</p>
        <ActionLink href="/vendor/services" secondary>Manage my services</ActionLink>
      </section>
      <section className="vendor-card"><h2>Recent Booking Requests</h2>{bookings.isSuccess && (requests.length ? <ul className="vendor-activity">{requests.slice(0, 3).map((item) => <li key={item.id}><div><strong>{item.customerContact.name}</strong><p>{eventDay(item.eventDate)} · {item.eventLocation}</p></div><BookingBadge status={item.status} /></li>)}</ul> : <p className="vendor-muted">No booking requests yet.</p>)}<Link className="wp-text-link" href="/vendor/bookings">View booking requests</Link><div className="vendor-actions"><ActionLink href="/vendor/services/new">Add service</ActionLink><ActionLink href="/vendor/services" secondary>My Services</ActionLink></div></section>
      <section className="vendor-card">
        <div className="vendor-section-head"><h2>Your Recent Services</h2><Link className="wp-text-link" href="/vendor/services">View all</Link></div>
        {services.isSuccess && (recent.length ? <ul className="vendor-activity">
          {recent.map((item) => <li key={item.id}><div>
            <Link href={`/vendor/services/${item.id}/edit`}>{item.title}</Link>
            <p>{item.createdAt === item.updatedAt ? "Created" : "Updated"}</p>
          </div><time dateTime={item.updatedAt}>{date.format(new Date(item.updatedAt))}</time></li>)}
        </ul> : <p className="vendor-muted">Add your first service to see activity here.</p>)}
      </section>
    </div>
  </div>
}
