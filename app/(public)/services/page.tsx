import { UiIcon } from "@/components/ui/icon"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import type { Metadata } from "next"
import { ActionLink, DemoNotice, EmptyState, ServiceCard } from "@/components/public/ui"
import { browseUrl, categories, listServices, parseFilters } from "@/lib/services"

export const metadata: Metadata = { title: "Browse wedding services" }

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams)
  const result = await listServices(filters)
  const { total, page, totalPages } = result.pagination
  const filtered = Boolean(filters.q || filters.category || filters.location)
  return (
    <>
      <header className="wp-browse-hero"><div className="wp-wrap wp-page-heading"><p className="wp-breadcrumb-inline"><Link href="/">Home</Link> <UiIcon icon={ChevronRight} size="sm" /> Browse Services</p><h1>Browse Wedding Services</h1><p>Find venues, photographers, florists, and more for your wedding.</p></div></header>
      <div className="wp-wrap wp-browse-grid">
      <form action="/services" id="directory-filters" className="wp-filter-rail">
        <div><h2>Filters</h2><Link className="wp-text-link" href="/services">Clear all</Link></div>
        <label>Category<input name="category" defaultValue={filters.category} maxLength={80} list="directory-categories" placeholder="All categories" /></label>
        <datalist id="directory-categories">{categories.map(({ name }) => <option key={name} value={name} />)}</datalist>
        <label>Location<input name="location" defaultValue={filters.location} maxLength={120} placeholder="City or region" /></label>
        <button className="wp-button" type="submit">Apply filters</button>
      </form>
      <section className="wp-results" aria-label="Search results">
        <label className="wp-browse-search">Search services<input form="directory-filters" name="q" type="search" placeholder="Search for services…" defaultValue={filters.q} maxLength={120} /></label>
        {result.demo && <DemoNotice />}
        {result.data.length === 0 ? <EmptyState title={page > 1 ? "No services on this page" : "No services found"}>
          <p>{filtered ? "Try changing your search or clearing your filters." : "Check back for new listings."}</p>
          {(filtered || page > 1) && <ActionLink href="/services" secondary>View all services</ActionLink>}
        </EmptyState> : <>
          <p className="wp-result-count">{total} {total === 1 ? "service" : "services"}{result.demo ? " in the sample catalog" : ""}</p>
          <div className="wp-service-grid">{result.data.map((service) => <ServiceCard key={service.id} service={service} />)}</div>
        </>}
        {totalPages > 1 && <nav className="wp-pagination" aria-label="Results pages">
          {page > 1 && <ActionLink href={browseUrl({ ...filters, page: Math.min(page - 1, totalPages) })} secondary>Previous</ActionLink>}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages && <ActionLink href={browseUrl({ ...filters, page: page + 1 })} secondary>Next</ActionLink>}
        </nav>}
      </section>
    </div>
    </>
  )
}
