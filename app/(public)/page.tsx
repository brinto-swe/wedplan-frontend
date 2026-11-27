import { LoadingLabel } from "@/components/ui/loading-label"
import { UiIcon } from "@/components/ui/icon"
import Image from "next/image"
import Link from "next/link"
import { Camera, CookingPot, Flower2, MapPin, Sparkles, Shirt, Search, CalendarDays, Check, ShieldCheck, LayoutGrid, CalendarCheck, Images } from "lucide-react"
import { Suspense } from "react"

import { HomeEntrance } from "@/components/public/home-entrance"
import { RetryButton } from "@/components/public/retry-button"
import { ActionLink, EmptyState, SearchForm, ServiceCard } from "@/components/public/ui"
import { browseUrl, categoryNames, listLiveServices } from "@/lib/services"

const categoryIcons = [Camera, MapPin, Flower2, CookingPot, Sparkles, Shirt] as const

const benefits = [
  [ShieldCheck, "Admin-reviewed services", "Browse listings reviewed before they are published."],
  [LayoutGrid, "Compare your options", "Narrow the directory by category, location, or price."],
  [Images, "See what Vendors offer", "Explore service photos and descriptions before you request a booking."],
  [CalendarCheck, "Track your requests", "See whether a Vendor has responded from your bookings dashboard."],
] as const

const steps = [
  [Search, "Discover services", "Browse venues, photographers, and more."],
  [CalendarDays, "Request a booking", "Share your event details with your preferred Vendor."],
  [Check, "Get confirmed", "Check your dashboard for the Vendor’s response."],
] as const

async function FeaturedServices() {
  const result = await listLiveServices({ page: 1 }, 6).catch(() => null)
  if (!result) {
    return <div className="wp-empty" role="status">
      <h3>Popular services are temporarily unavailable</h3>
      <p>Try loading the listings again.</p>
      <RetryButton />
    </div>
  }
  return result.data.length
    ? <HomeEntrance className="wp-service-grid">{result.data.map((service) => <ServiceCard key={service.id} service={service} featured />)}</HomeEntrance>
    : <EmptyState title="No services listed yet"><p>Check back for new wedding services.</p></EmptyState>
}

export default function HomePage() {
  return (
    <>
      <section className="wp-wrap wp-hero">
        <div className="wp-hero-grid">
          <HomeEntrance className="wp-hero-copy" hero>
            <p className="wp-kicker">PLAN YOUR PERFECT WEDDING</p>
            <h1>Discover, Book &amp; Plan Your Dream Wedding</h1>
            <p>Find the venues, makers, and wedding professionals who can bring your day to life.</p>
            <div className="wp-hero-actions"><ActionLink href="/services">Browse Services</ActionLink><ActionLink href="/sign-up" secondary>Become a Vendor</ActionLink></div>
          </HomeEntrance>
          <div className="wp-hero-image">
            <Image src="/weddings/hero.webp" fill sizes="(max-width: 740px) 100vw, 58vw" alt="An outdoor wedding reception at a stone villa, with flowers and candlelit tables" preload />
          </div>
        </div>
        <SearchForm hero />
      </section>

      <section className="wp-wrap wp-section" id="categories">
        <div className="wp-section-heading"><div><p className="wp-kicker">THE WEDDING DIRECTORY</p><h2>Wedding Service Categories</h2></div><Link className="wp-text-link" href="/services">View all services</Link></div>
        <HomeEntrance className="wp-category-grid">
          {categoryNames.map((name, index) => {
            const Icon = categoryIcons[index]
            return <Link key={name} className="wp-category wp-category-icon" href={browseUrl({ page: 1, category: name })}>
              <UiIcon icon={Icon} size="xl" /><h3>{name}</h3>
            </Link>
          })}
        </HomeEntrance>
      </section>

      <section className="wp-featured">
        <div className="wp-wrap wp-section">
          <div className="wp-section-heading"><div><h2>Popular Wedding Services</h2><p>Find the right fit for the day you have in mind.</p></div><Link className="wp-text-link" href="/services">Browse the directory</Link></div>
          <Suspense fallback={<LoadingLabel>Loading services…</LoadingLabel>}><FeaturedServices /></Suspense>
        </div>
      </section>

      <section className="wp-home-steps"><div className="wp-wrap">
        <h2>Plan Your Wedding in Three Steps</h2>
        <HomeEntrance>{steps.map(([Icon, title, copy]) => <article key={title}>
          <UiIcon icon={Icon} size="xl" /><h3>{title}</h3><p>{copy}</p>
        </article>)}</HomeEntrance>
      </div></section>

      <section className="wp-wrap wp-section wp-home-benefits">
        <h2>Why Choose WedPlan</h2>
        <HomeEntrance className="wp-benefit-grid">{benefits.map(([Icon, title, copy]) => <article key={title}>
          <UiIcon icon={Icon} size="xl" /><h3>{title}</h3><p>{copy}</p>
        </article>)}</HomeEntrance>
      </section>

      <section className="wp-wrap wp-section">
        <div className="wp-cta">
          <h2>Start with what matters most.</h2>
          <p>Search by location or service to find a starting point for your plans.</p>
          <ActionLink href="/services" secondary>Find wedding services</ActionLink>
        </div>
      </section>
    </>
  )
}
