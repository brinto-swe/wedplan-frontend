import { UiIcon } from "@/components/ui/icon"
import Image from "next/image"
import Link from "next/link"
import { MapPin, Search } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { formattedPrice, serviceImages, type Filters, type Service } from "@/lib/services"

export function ActionLink({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
  return <Link className={cn("wp-button", secondary && "wp-button-outline")} href={href}>{children}</Link>
}

export function SearchForm({ filters, hero = false }: { filters?: Filters; hero?: boolean }) {
  return (
    <form action="/services" className={cn("wp-search", hero && "wp-search-hero")} role="search" aria-label="Find wedding services">
      <label><span>What are you looking for?</span><input name="q" defaultValue={filters?.q} placeholder="e.g. garden venue" maxLength={120} /></label>
      <label><span>Location</span><input name="location" defaultValue={filters?.location} placeholder="City or region" maxLength={120} /></label>
      <label><span>Category</span><input name="category" defaultValue={filters?.category} placeholder="Any category" maxLength={80} /></label>
      <button type="submit" className="wp-button"><UiIcon icon={Search} size="sm" /> Search</button>
    </form>
  )
}

export function ServiceCard({ service }: { service: Service }) {
  const [image] = serviceImages(service.category)
  return (
    <article className="wp-card">
      <Link href={`/services/${encodeURIComponent(service.id)}`} className="wp-card-link">
        <div className="wp-card-image"><Image src={image.image} alt="" fill sizes="(max-width: 580px) 100vw, (max-width: 900px) 50vw, 33vw" /></div>
        <div className="wp-card-content">
          <p className="wp-kicker">{service.category}</p>
          <h3>{service.title}</h3>
          <p className="wp-location"><UiIcon icon={MapPin} size="sm" />{service.location}</p>
          <p className="wp-price">From <strong>{formattedPrice(service)}</strong></p>
        </div>
      </Link>
    </article>
  )
}

export function DemoNotice() {
  return <p className="wp-notice" role="status">The live catalog is temporarily unavailable. You’re viewing sample listings.</p>
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="wp-empty"><h2>{title}</h2>{children}</div>
}
