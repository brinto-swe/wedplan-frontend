import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { MapPin } from "lucide-react"

import { Gallery } from "@/components/public/gallery"
import { RetryButton } from "@/components/public/retry-button"
import { ActionLink, DemoNotice, EmptyState } from "@/components/public/ui"
import { formattedPrice, getService, serviceImages } from "@/lib/services"

export const metadata: Metadata = { title: "Service details" }

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getService(id)
  if (result.kind === "missing") notFound()
  if (result.kind !== "found") return <div className="wp-wrap wp-section">
    <EmptyState title="Service details unavailable"><p>We couldn’t reach the wedding directory. Try again in a moment.</p>
      <RetryButton />{" "}
      <ActionLink href="/services">Browse services</ActionLink>
    </EmptyState>
  </div>

  const { service } = result
  return (
    <div className="wp-wrap wp-section">
      <nav className="wp-breadcrumb" aria-label="Breadcrumb"><Link href="/services">Browse services</Link><span aria-hidden="true">/</span><span>{service.category}</span></nav>
      {service.demo && <DemoNotice />}
      <div className="wp-detail-grid wp-detail-reference">
      <Gallery key={id} images={serviceImages(service.category)} />
      <div className="wp-page-heading wp-detail-heading">
        <p className="wp-kicker">{service.category}</p><h1>{service.title}</h1>
        <p className="wp-location"><MapPin size={18} aria-hidden="true" />{service.location}</p>
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
          <button type="button" className="wp-button" disabled aria-describedby="booking-status">Request booking</button>
          <p id="booking-status">Online booking is coming soon.</p>
        </aside>
      </div>
    </div>
  )
}
