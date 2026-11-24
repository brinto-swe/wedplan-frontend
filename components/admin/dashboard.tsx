"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { BarChart3, CalendarDays, ChartPie, Crown, Layers3, ReceiptText, Store, Users, Zap, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { UiIcon } from "@/components/ui/icon"
import { LoadingLabel } from "@/components/ui/loading-label"
import { VendorBanner, VendorStats } from "@/components/vendor/presentation"
import { authClient } from "@/lib/auth"
import { getAdminOverview, type AdminOverview } from "@/lib/admin"
import { formatStripeAmount } from "@/lib/stripe-amount"
import { AdminRequestError } from "./workspace"

const number = new Intl.NumberFormat()
const percentage = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 })
const statuses = [
  { key: "accepted", label: "Accepted" },
  { key: "pending", label: "Pending" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
] as const

function Panel({ id, title, icon, children }: { id: string; title: string; icon: LucideIcon; children: ReactNode }) {
  return <section className="vendor-card admin-panel" aria-labelledby={id}>
    <h2 id={id}><UiIcon icon={icon} size="lg" />{title}</h2>
    {children}
  </section>
}

function Metrics({ rows }: { rows: [string, number][] }) {
  return <dl className="admin-metrics">{rows.map(([label, count]) =>
    <div key={label}><dt>{label}</dt><dd>{number.format(count)}</dd></div>)}</dl>
}

function BookingPanels({ bookings }: { bookings: AdminOverview["bookings"] }) {
  let start = 0
  const shown = statuses.reduce((sum, { key }) => sum + bookings[key], 0)
  const segments: string[] = []
  for (const { key } of statuses) {
    if (!bookings[key]) continue
    const end = start + bookings[key] / shown * 100
    segments.push(`var(--admin-${key}) ${start}% ${end}%`)
    start = end
  }
  return <>
    <Panel id="admin-bookings" title="Booking Analytics" icon={CalendarDays}>
      <p className="vendor-muted">All-time booking counts by status</p>
      {shown > 0 && <div className="admin-bars" aria-hidden="true">
        {statuses.map(({ key, label }) => <div key={key}>
          <span>{label}</span>
          <span className="admin-bar-track"><span style={{ width: `${bookings[key] / shown * 100}%`, background: `var(--admin-${key})` }} /></span>
          <strong>{number.format(bookings[key])}</strong>
        </div>)}
      </div>}
      {!shown && <p className="admin-panel-empty">No bookings to visualize yet.</p>}
    </Panel>
    <Panel id="admin-booking-status" title="Bookings by Status" icon={ChartPie}>
      <div className="admin-booking-chart">
        {shown > 0 && <div aria-hidden="true" className="admin-donut" style={{ background: `conic-gradient(${segments.join(",")})` }}>
          <span><strong>{number.format(bookings.total)}</strong>Bookings</span>
        </div>}
        <ul aria-label="Booking status counts">{statuses.map(({ key, label }) =>
          <li key={key}>
            <span><i style={{ background: `var(--admin-${key})` }} />{label}</span>
            <strong>{number.format(bookings[key])}{shown > 0 ? ` (${percentage.format(bookings[key] / shown)})` : ""}</strong>
          </li>)}</ul>
      </div>
    </Panel>
  </>
}

function Overview({ data }: { data: AdminOverview }) {
  const { users, services, bookings, subscriptions, revenue } = data
  const empty = !users.total && !services.total && !bookings.total && !revenue.paidInvoiceCount && !revenue.failedInvoiceCount
  return <>
    <VendorStats items={[
      { label: "Total Users", value: number.format(users.total), icon: Users },
      { label: "Total Vendors", value: number.format(users.vendors), icon: Store },
      { label: "Total Services", value: number.format(services.total), icon: Layers3 },
      { label: "Total Bookings", value: number.format(bookings.total), icon: CalendarDays },
      { label: "Premium Vendors", value: number.format(subscriptions.premium), icon: Crown },
    ]} />
    {empty && <p className="vendor-plan-strip" role="status">No platform activity to report yet.</p>}
    <div className="admin-overview-grid">
      <BookingPanels bookings={bookings} />
      <Panel id="admin-actions" title="Quick Actions" icon={Zap}>
        <ul className="admin-quick-actions">
          <li><Link href="#admin-users"><UiIcon icon={Users} size="sm" />View user counts</Link></li>
          <li><Link href="#admin-booking-status"><UiIcon icon={CalendarDays} size="sm" />View booking status</Link></li>
          <li><Link href="#admin-platform"><UiIcon icon={Layers3} size="sm" />View platform overview</Link></li>
          <li><Link href="#admin-revenue"><UiIcon icon={ReceiptText} size="sm" />View revenue breakdown</Link></li>
        </ul>
      </Panel>
      <Panel id="admin-users" title="Users Overview" icon={Users}>
        <Metrics rows={[
          ["Customers", users.customers], ["Vendors", users.vendors], ["Admins", users.admins],
          ["Active users", users.active], ["Blocked users", users.blocked],
        ]} />
      </Panel>
      <Panel id="admin-platform" title="Platform Overview" icon={BarChart3}>
        <Metrics rows={[
          ["Active services", services.active], ["Inactive services", services.inactive],
          ["Free Vendors", subscriptions.free], ["Premium Vendors", subscriptions.premium],
          ["Scheduled cancellations", subscriptions.cancellationScheduled],
        ]} />
      </Panel>
      <Panel id="admin-revenue" title="All-Time Revenue" icon={ReceiptText}>
        <Metrics rows={[["Paid invoices", revenue.paidInvoiceCount], ["Failed invoices", revenue.failedInvoiceCount]]} />
        {revenue.paidByCurrency.length ? <dl className="admin-metrics">
          {revenue.paidByCurrency.map(({ currency, amount }) => <div key={currency}>
            <dt>{currency.toUpperCase()}</dt><dd>{formatStripeAmount(amount, currency, "code")}</dd>
          </div>)}
        </dl> : <p className="admin-panel-empty">No paid revenue has been recorded yet.</p>}
      </Panel>
    </div>
  </>
}

function OverviewSkeleton() {
  return <div className="admin-overview-loading" aria-busy="true">
    <LoadingLabel>Loading dashboard overview…</LoadingLabel>
    <div className="vendor-stats" aria-hidden="true">{Array.from({ length: 5 }, (_, index) =>
      <div key={index} className="vendor-card admin-skeleton" />)}</div>
    <div className="admin-overview-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) =>
      <div key={index} className="vendor-card admin-skeleton" />)}</div>
  </div>
}

export function AdminDashboard() {
  const user = authClient.useSession().data?.user
  const overview = useQuery({
    queryKey: ["admin-overview", user?.id],
    queryFn: ({ signal }) => getAdminOverview(signal),
  })

  if (overview.isError) return <AdminRequestError error={overview.error} retry={() => void overview.refetch()} />
  return <div className="vendor-stack admin-dashboard">
    <VendorBanner title={`Welcome back, ${user?.name || "Admin"}!`} description="Monitor users, services, bookings, and billing across WedPlan." />
    {overview.isPending ? <OverviewSkeleton /> : <Overview data={overview.data} />}
  </div>
}
