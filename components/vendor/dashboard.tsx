"use client"

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
  const items = services.data ?? []
  const active = items.filter(({ isActive }) => isActive).length
  const recent = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const stats = [
    { label: "Total services", value: services.data ? items.length : "—", icon: Layers3 },
    { label: "Active services", value: services.data ? active : "—", icon: CircleCheck },
    { label: "Inactive services", value: services.data ? items.length - active : "—", icon: CircleMinus },
    { label: "Total bookings", value: "Unavailable", icon: CalendarDays },
    { label: "Pending requests", value: "Unavailable", icon: Clock3 },
  ]

  return <div className="vendor-stack">
    <VendorBanner title={<>Welcome back,<br />{profile.name}</>} description="Manage your services and grow your wedding business with WedPlan." />
    <VendorStats items={stats} />
    {services.isPending && <LoadingState text="Loading service statistics…" />}
    {services.isError && <RequestError error={services.error} retry={() => void services.refetch()} />}
    <div className="vendor-dashboard-grid">
      <section className="vendor-card"><h2>Booking Overview</h2><p className="vendor-muted">Booking totals and pending requests are unavailable until booking data is connected.</p></section>

      <section className="vendor-card vendor-plan">
        <h2>Subscription</h2>
        <p><span className="vendor-badge">{plan === "Unavailable" ? "Status unavailable" : `${plan} plan`}</span></p>
        <p className="vendor-muted">{plan === "Premium" ? "Unlimited active services."
          : plan === "Free" ? services.data ? `${active} of ${activeLimit} active services in use.` : `Up to ${activeLimit} active services.`
            : "The current subscription is unavailable."}</p>
        <ActionLink href="/vendor/services" secondary>Manage my services</ActionLink>
      </section>
      <section className="vendor-card"><h2>Recent Booking Requests</h2><p className="vendor-muted">Booking requests are unavailable.</p><div className="vendor-actions"><ActionLink href="/vendor/services/new">Add service</ActionLink><ActionLink href="/vendor/services" secondary>My Services</ActionLink></div></section>
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
