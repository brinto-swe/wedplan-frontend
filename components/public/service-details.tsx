"use client"

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { ChevronRight, MapPin } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { BookingRequest } from "@/components/bookings/request-form"
import { Gallery } from "@/components/public/gallery"
import { ActionLink, DemoNotice, EmptyState } from "@/components/public/ui"
import { UiIcon } from "@/components/ui/icon"
import { LoadingLabel } from "@/components/ui/loading-label"
import { authClient, fetchProtectedProfile, getProtectedToken, ProtectedProfileError } from "@/lib/auth"
import { signInFor } from "@/lib/auth-navigation"
import { formattedPrice, getService, serviceImages } from "@/lib/services"

export function ServiceDetails({ id, autoOpen }: { id: string; autoOpen: boolean }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <QueryClientProvider client={client}><PrivateService id={id} autoOpen={autoOpen} /></QueryClientProvider>
}

function PrivateService({ id, autoOpen }: { id: string; autoOpen: boolean }) {
  const session = authClient.useSession()
  const userId = session.data?.user.id
  const router = useRouter()
  const details = useQuery({
    queryKey: ["private-service", userId, id],
    enabled: Boolean(userId && !session.isPending && !session.error),
    queryFn: async ({ signal }) => {
      const token = await getProtectedToken(signal)
      const viewer = await fetchProtectedProfile(signal, token)
      if (viewer.id !== userId || !["customer", "vendor", "admin"].includes(viewer.role)) throw new ProtectedProfileError(403, "Access denied")
      return { viewer, result: await getService(id, token, signal) }
    },
  })
  const failure = details.error instanceof ProtectedProfileError ? details.error.status : session.error?.status
  const result = details.data?.result
  const redirect = !session.isPending && (
    (!userId && (!session.error || failure === 401)) || failure === 401 || result?.kind === "unauthorized"
  )
  const target = signInFor(`/services/${id}${autoOpen ? "?book=1" : ""}`)
  useEffect(() => { if (redirect) router.replace(target) }, [redirect, router, target])

  if (session.isPending || redirect || (userId && !session.error && details.isPending)) {
    return <div className="wp-wrap wp-section"><LoadingLabel>Checking service access…</LoadingLabel></div>
  }
  if (failure === 403 || result?.kind === "forbidden") return <div className="wp-wrap wp-section">
    <EmptyState title="Service access denied"><p>This account cannot view this listing.</p><ActionLink href="/services">Browse services</ActionLink></EmptyState>
  </div>
  if (result?.kind === "missing") return <div className="wp-wrap wp-section">
    <EmptyState title="Service not found"><p>This listing may have been removed or is no longer active.</p><ActionLink href="/services">Browse services</ActionLink></EmptyState>
  </div>
  if (session.error || details.isError || !details.data || result?.kind !== "found") return <div className="wp-wrap wp-section">
    <EmptyState title="Service details unavailable">
      <p>We couldn’t load this listing. Try again in a moment.</p>
      <button type="button" className="wp-button wp-button-outline" onClick={() => void (session.error ? session.refetch() : details.refetch())}>Try again</button>{" "}
      <ActionLink href="/services">Browse services</ActionLink>
    </EmptyState>
  </div>
  const { viewer } = details.data
  const { service } = result
  return (
    <div className="wp-wrap wp-section">
      <nav className="wp-breadcrumb" aria-label="Breadcrumb"><Link href="/services">Browse services</Link><UiIcon icon={ChevronRight} size="sm" /><span>{service.category}</span></nav>
      {service.demo && <DemoNotice />}
      <div className="wp-detail-grid wp-detail-reference">
      <Gallery key={id} images={serviceImages(service.category, service.images, service.title)} />
      <div className="wp-page-heading wp-detail-heading">
        <p className="wp-kicker">{service.category}</p><h1>{service.title}</h1>
        <p className="wp-location"><UiIcon icon={MapPin} size="md" />{service.location}</p>
      </div>
        <div className="wp-detail-about">
          <section className="wp-detail-copy"><h2>About this service</h2><p>{service.description}</p></section>
          <section className="wp-detail-copy"><h2>Vendor information</h2>
            {service.vendorName ? <p>{service.vendorName}</p> : <p className="wp-vendor-id">Vendor reference {service.vendorId}</p>}
            <p>Service location: {service.location}</p>
          </section>
        </div>
        <aside className="wp-pricing">
          <h2>Request Booking</h2><p className="wp-kicker">STARTING PRICE</p><p className="wp-detail-price">{formattedPrice(service)}</p>
          {viewer.role === "customer" ? <BookingRequest serviceId={id} autoOpen={autoOpen} customer={viewer} /> : <p>Only customer accounts can request bookings.</p>}
        </aside>
      </div>
    </div>
  )
}
