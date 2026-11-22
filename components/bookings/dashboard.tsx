"use client"

import Link from "next/link"
import { CalendarDays, CircleCheck, Clock3 } from "lucide-react"
import { authClient } from "@/lib/auth"
import { VendorBanner, VendorStats } from "@/components/vendor/presentation"
import { LoadingLabel } from "@/components/ui/loading-label"
import { BookingBadge, BookingError, eventDay, ServiceTitle, useBookings, useServiceInfo } from "./shared"

export function CustomerDashboard() {
  const user = authClient.useSession().data!.user
  const query = useBookings("customer", user.id)
  const items = query.data ?? []
  const recent = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  const services = useServiceInfo(recent)
  const upcoming = items.filter((item) => item.status === "accepted" && item.eventDate >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0]
  const upcomingService = useServiceInfo(upcoming ? [upcoming] : [])
  return <div className="vendor-stack">
    <VendorBanner title={`Welcome back, ${user.name}!`} description="Plan and manage your wedding service bookings in one place." />
    <VendorStats items={[
      { label: "Total bookings", value: query.data ? items.length : "—", icon: CalendarDays },
      { label: "Pending", value: query.data ? items.filter((item) => item.status === "pending").length : "—", icon: Clock3 },
      { label: "Accepted", value: query.data ? items.filter((item) => item.status === "accepted").length : "—", icon: CircleCheck },
    ]} />
    {query.isPending ? <LoadingLabel>Loading your bookings…</LoadingLabel> : query.isError ? <BookingError error={query.error} retry={() => void query.refetch()} /> : null}
    <div className="booking-dashboard-grid">
      <section className="vendor-card"><h2>Upcoming Booking</h2>
        {upcoming ? <><ServiceTitle booking={upcoming} service={upcomingService.get(upcoming.serviceId)} /><p>{eventDay(upcoming.eventDate)} · {upcoming.eventLocation}</p><Link className="wp-text-link" href={`/customer/bookings/${upcoming.id}`}>View booking</Link></>
          : query.isSuccess && <p>No upcoming accepted bookings.</p>}
      </section>
      <section className="vendor-card booking-quick"><h2>Quick Actions</h2><div className="vendor-actions">
        <Link className="wp-button" href="/services">Browse services</Link>
        <Link className="wp-button wp-button-outline" href="/customer/bookings">My Bookings</Link>
        <Link className="wp-button wp-button-outline" href="/customer/profile">My Profile</Link>
      </div></section>
      <section className="vendor-card"><div className="vendor-section-head"><h2>Recent Booking Activity</h2><Link href="/customer/bookings" className="wp-text-link">View all</Link></div>
        {recent.length ? <ul className="vendor-activity">{recent.map((booking) => <li key={booking.id}>
          <Link href={`/customer/bookings/${booking.id}`}><ServiceTitle booking={booking} service={services.get(booking.serviceId)} /><time dateTime={booking.updatedAt}>{eventDay(booking.updatedAt)}</time></Link><BookingBadge status={booking.status} />
        </li>)}</ul> : query.isSuccess && <p>You haven’t made any bookings yet. Browse services to get started.</p>}
      </section>
    </div>
  </div>
}
