import { LoadingLabel } from "@/components/ui/loading-label"
import { UiIcon } from "@/components/ui/icon"
import Image from "next/image"
import Link from "next/link"
import { Camera, CookingPot, Flower2, MapPin, Music, Car, Video, Shirt, Search, CalendarDays, Check } from "lucide-react"
import { Suspense } from "react"

import { ActionLink, DemoNotice, EmptyState, SearchForm, ServiceCard } from "@/components/public/ui"
import { browseUrl, listServices } from "@/lib/services"

const homeCategories = [
  ["Photography", Camera], ["Videography", Video], ["Bridal Wear", Shirt], ["Decoration", Flower2],
  ["Catering", CookingPot], ["Entertainment", Music], ["Transportation", Car], ["Venues", MapPin],
] as const

async function FeaturedServices() {
  const result = await listServices({ page: 1 }, 6)
  return <>
    {result.demo && <DemoNotice />}
    {result.data.length
      ? <div className="wp-service-grid">{result.data.map((service) => <ServiceCard key={service.id} service={service} />)}</div>
      : <EmptyState title="No services listed yet"><p>Check back for new wedding services.</p></EmptyState>}
  </>
}

export default function HomePage() {
  return (
    <>
      <section className="wp-wrap wp-hero">
        <div className="wp-hero-grid">
          <div className="wp-hero-copy">
            <p className="wp-kicker">PLAN YOUR PERFECT WEDDING</p>
            <h1>Discover, Book &amp; Plan Your Dream Wedding</h1>
            <p>Find the venues, makers, and wedding professionals who can bring your day to life.</p>
            <div className="wp-hero-actions"><ActionLink href="/services">Browse Services</ActionLink><ActionLink href="/sign-up" secondary>Become a Vendor</ActionLink></div>
          </div>
          <div className="wp-hero-image">
            <Image src="/weddings/hero.webp" fill sizes="(max-width: 740px) 100vw, 58vw" alt="An outdoor wedding reception at a stone villa, with flowers and candlelit tables" preload />
          </div>
        </div>
        <SearchForm hero />
      </section>

      <section className="wp-wrap wp-section" id="categories">
        <div className="wp-section-heading"><div><p className="wp-kicker">THE WEDDING DIRECTORY</p><h2>Wedding Service Categories</h2></div><Link className="wp-text-link" href="/services">View all services</Link></div>
        <div className="wp-category-grid">
          {homeCategories.map(([name, Icon]) => <Link key={name} className="wp-category wp-category-icon" href={browseUrl({ page: 1, category: name })}>
            <UiIcon icon={Icon} size="xl" /><h3>{name}</h3>
          </Link>)}
        </div>
      </section>

      <section className="wp-featured">
        <div className="wp-wrap wp-section">
          <div className="wp-section-heading"><div><h2>Popular Wedding Services</h2><p>Find the right fit for the day you have in mind.</p></div><Link className="wp-text-link" href="/services">Browse the directory</Link></div>
          <Suspense fallback={<LoadingLabel>Loading services…</LoadingLabel>}><FeaturedServices /></Suspense>
        </div>
      </section>

      <section className="wp-home-steps"><div className="wp-wrap"><h2>Plan Your Wedding in Three Steps</h2><div>{[[Search, "Discover services", "Browse venues, photographers, and more."], [CalendarDays, "Request a booking", "Booking requests will be available when booking launches."], [Check, "Get confirmed", "Vendors will confirm availability through the booking workflow."]].map(([Icon, title, copy]) => { const StepIcon = Icon as typeof Search; return <article key={String(title)}><UiIcon icon={StepIcon} size="xl" /><h3>{String(title)}</h3><p>{String(copy)}</p></article> })}</div></div></section>
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
