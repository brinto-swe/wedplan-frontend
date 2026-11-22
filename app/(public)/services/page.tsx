import type { Metadata } from "next"
import { ActionLink, DemoNotice, EmptyState, SearchForm, ServiceCard } from "@/components/public/ui"
import { browseUrl, listServices, parseFilters } from "@/lib/services"

export const metadata: Metadata = { title: "Browse wedding services" }

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams)
  const result = await listServices(filters)
  const { total, page, totalPages } = result.pagination
  const filtered = Boolean(filters.q || filters.category || filters.location)
  return (
    <div className="wp-wrap wp-section">
      <div className="wp-page-heading"><p className="wp-kicker">THE WEDDING DIRECTORY</p><h1>Browse wedding services</h1><p>Find venues, photographers, florists, and more for your wedding.</p></div>
      <SearchForm filters={filters} />
      <section className="wp-results" aria-label="Search results">
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
  )
}
