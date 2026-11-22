import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"

import { ActionLink, DemoNotice, EmptyState, SearchForm, ServiceCard } from "@/components/public/ui"
import { browseUrl, categories, listServices } from "@/lib/services"

async function FeaturedServices() {
  const result = await listServices({ page: 1 }, 3)
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
            <p className="wp-kicker">THE WEDDING SERVICES DIRECTORY</p>
            <h1>Your wedding,<br /><em>your way.</em></h1>
            <p>Find the venues, makers, and wedding professionals who can bring your day to life.</p>
            <ActionLink href="/services">Explore services</ActionLink>
          </div>
          <div className="wp-hero-image">
            <Image src="/weddings/hero.webp" fill sizes="(max-width: 740px) 100vw, 58vw" alt="An outdoor wedding reception at a stone villa, with flowers and candlelit tables" preload />
          </div>
        </div>
        <SearchForm hero />
      </section>

      <section className="wp-wrap wp-section" id="categories">
        <div className="wp-section-heading"><div><p className="wp-kicker">THE WEDDING DIRECTORY</p><h2>Explore by category</h2></div><Link className="wp-text-link" href="/services">View all services</Link></div>
        <div className="wp-category-grid">
          {categories.map((category) => <Link key={category.name} className="wp-category" href={browseUrl({ page: 1, category: category.name })}>
            <Image src={category.image} fill sizes="(max-width: 740px) 50vw, 25vw" alt="" />
            <h3>{category.name}</h3>
          </Link>)}
        </div>
      </section>

      <section className="wp-featured">
        <div className="wp-wrap wp-section">
          <div className="wp-section-heading"><div><h2>Featured services</h2><p>Find the right fit for the day you have in mind.</p></div><Link className="wp-text-link" href="/services">Browse the directory</Link></div>
          <Suspense fallback={<p className="wp-notice" role="status">Loading services…</p>}><FeaturedServices /></Suspense>
        </div>
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
