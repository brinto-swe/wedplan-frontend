"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleCheck, CircleMinus, Eye, Layers3, Pencil, Power, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { LoadingLabel } from "@/components/ui/loading-label"
import { UiIcon } from "@/components/ui/icon"
import { VendorBanner, VendorStats } from "@/components/vendor/presentation"
import { WorkspaceState } from "@/components/vendor/workspace"
import { AdminApiError, deleteAdminService, getAdminOverview, getAdminService, listAdminServices, updateAdminService,
  type AdminService, type AdminServiceFilters, type AdminServiceRow } from "@/lib/admin"
import { authClient } from "@/lib/auth"
import { serviceIdPattern, serviceInput, type ServiceInput } from "@/lib/vendor-services"
import { AdminRequestError } from "./workspace"

const defaults: AdminServiceFilters = { q: "", category: "", vendorId: "", visibility: "", page: 1 }
const format = new Intl.NumberFormat()
const price = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" })
type Action = { service: AdminService; type: "delete" | "visibility" } | { service: AdminService; type: "edit"; patch: Partial<ServiceInput> }

function vendorName(vendor: AdminServiceRow["vendor"]) {
  if (!vendor) return "Vendor unavailable"
  if (vendor.businessName && vendor.name && vendor.businessName !== vendor.name) return vendor.businessName + " · " + vendor.name
  return vendor.businessName || vendor.name || vendor.id
}

function ServiceStatus({ active }: { active: boolean }) {
  return <span className={`vendor-badge admin-user-status ${active ? "vendor-active" : ""}`}>{active ? "Active" : "Inactive"}</span>
}

function ServiceSkeleton({ label }: { label: string }) {
  return <div className="admin-user-loading" aria-busy="true"><LoadingLabel>{label}</LoadingLabel>
    <div aria-hidden="true">{[0, 1, 2].map((item) => <span key={item} className="admin-gate-skeleton" />)}</div>
  </div>
}

export function ManageServices() {
  const viewer = authClient.useSession().data?.user.id
  const client = useQueryClient()
  const [filters, setFilters] = useState(defaults)
  const [draft, setDraft] = useState({ q: "", category: "", vendorId: "" })
  const [filterError, setFilterError] = useState("")
  const [selected, setSelected] = useState<AdminServiceRow | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [editError, setEditError] = useState("")
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const inFlight = useRef(false)
  const listKey = ["admin-services", viewer]
  const detailKey = ["admin-service", viewer, selected?.id]
  const overviewKey = ["admin-overview", viewer]
  const services = useQuery({ queryKey: [...listKey, filters], queryFn: ({ signal }) => listAdminServices(filters, signal) })
  const summary = useQuery({ queryKey: overviewKey, queryFn: ({ signal }) => getAdminOverview(signal) })
  const detail = useQuery({ queryKey: detailKey, enabled: selected !== null, queryFn: ({ signal }) => getAdminService(selected!.id, signal) })
  useEffect(() => { if (selected) title.current?.focus() }, [selected])

  const operation = useMutation({
    mutationFn: async (change: Action) => {
      if (change.type === "delete") return deleteAdminService(change.service.id)
      return updateAdminService(change.service.id, change.type === "edit" ? change.patch : { isActive: !change.service.isActive })
    },
    onSuccess: async (updated, change) => {
      if (updated) {
        await client.cancelQueries({ queryKey: ["admin-service", viewer, updated.id] })
        client.setQueryData(["admin-service", viewer, updated.id], updated)
      }
      if (change.type === "delete") {
        if (selected?.id === change.service.id) setSelected(null)
        if (services.data?.data.length === 1 && filters.page > 1) setFilters((current) => ({ ...current, page: current.page - 1 }))
      }
      await Promise.all([client.invalidateQueries({ queryKey: listKey }), client.invalidateQueries({ queryKey: overviewKey })])
      dialog.current?.close()
      toast.success(change.type === "delete" ? "Service deleted." : "Service updated.")
    },
    onSettled: () => { inFlight.current = false },
  })

  function open(next: Action) {
    setEditError("")
    operation.reset()
    setAction(next)
    dialog.current?.showModal()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action || inFlight.current) return
    if (action.type === "edit") {
      const form = new FormData(event.currentTarget)
      const amount = String(form.get("price") ?? "").trim()
      const parsed = serviceInput.safeParse({
        title: String(form.get("title") ?? ""), description: String(form.get("description") ?? ""),
        category: String(form.get("category") ?? ""), location: String(form.get("location") ?? ""),
        price: amount ? Number(amount) : NaN, isActive: action.service.isActive,
      })
      if (!parsed.success) {
        setEditError(parsed.error.issues[0]?.message ?? "Check the service information.")
        return
      }
      const { title, description, category, location, price } = parsed.data
      inFlight.current = true
      operation.mutate({ ...action, patch: { title, description, category, location, price } })
      return
    }
    inFlight.current = true
    operation.mutate(action)
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const vendorId = draft.vendorId.trim()
    if (vendorId && !serviceIdPattern.test(vendorId)) {
      setFilterError("Enter a valid 24-character Vendor ID.")
      return
    }
    setFilterError("")
    setFilters((current) => ({ ...current, ...draft, vendorId, page: 1 }))
  }

  function actions(service: AdminService) {
    const visibility = service.isActive ? "Deactivate" : "Activate"
    return <div className="admin-user-actions">
      <button type="button" className="wp-button wp-button-outline admin-user-action" disabled={operation.isPending}
        aria-label={`Edit ${service.title}`} onClick={() => open({ service, type: "edit", patch: {} })}><UiIcon icon={Pencil} size="sm" /><span className="sr-only">Edit</span></button>
      <button type="button" className="wp-button wp-button-outline admin-user-action" disabled={operation.isPending}
        aria-label={`${visibility} ${service.title}`} onClick={() => open({ service, type: "visibility" })}><UiIcon icon={Power} size="sm" /><span className="sr-only">{visibility}</span></button>
      <button type="button" className="wp-button wp-button-outline admin-user-action" disabled={operation.isPending}
        aria-label={`Delete ${service.title}`} onClick={() => open({ service, type: "delete" })}><UiIcon icon={Trash2} size="sm" /><span className="sr-only">Delete</span></button>
    </div>
  }

  const stats = summary.data?.services
  const pagination = services.data?.pagination
  const rows = services.data?.data ?? []
  const filtered = Boolean(filters.q.trim() || filters.category.trim() || filters.vendorId || filters.visibility)
  const errorStatus = operation.error instanceof AdminApiError ? operation.error.status : null
  const confirmation = action?.type === "delete" ? "Delete service" : action?.type === "edit" ? "Edit service"
    : action?.service.isActive ? "Deactivate service" : "Activate service"

  return <div className="vendor-stack admin-users admin-services">
    <VendorBanner title="Manage Services" description="Review Vendor listings, update service information, and manage visibility." />
    <div className={`admin-users-grid${selected ? " admin-users-split" : ""}`}>
      <div className="admin-users-main">
        <VendorStats items={[
          { label: "Total Services", value: stats ? format.format(stats.total) : "—", icon: Layers3 },
          { label: "Active Services", value: stats ? format.format(stats.active) : "—", icon: CircleCheck },
          { label: "Inactive Services", value: stats ? format.format(stats.inactive) : "—", icon: CircleMinus },
        ]} />
        <div className="admin-user-presets" role="group" aria-label="Service visibility filters">
          {([["", "All Services"], ["active", "Active"], ["inactive", "Inactive"]] as const).map(([value, label]) =>
            <button type="button" key={label} className="wp-button wp-button-outline" aria-pressed={filters.visibility === value}
              onClick={() => setFilters((current) => ({ ...current, visibility: value, page: 1 }))}>{label}</button>)}
        </div>
        <form className="vendor-toolbar admin-users-toolbar" onSubmit={applyFilters}>
          <label className="vendor-search"><span>Search title or description</span><span><UiIcon icon={Search} size="sm" />
            <input type="search" maxLength={120} value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} /></span></label>
          <label>Category<input value={draft.category} maxLength={80} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
          <label>Vendor ID<input value={draft.vendorId} maxLength={24} aria-invalid={Boolean(filterError)}
            aria-describedby={filterError ? "admin-service-vendor-error" : undefined}
            onChange={(event) => { setDraft({ ...draft, vendorId: event.target.value }); setFilterError("") }} /></label>
          <button type="submit" className="wp-button wp-button-outline">Apply filters</button>
        </form>
        {filterError && <p id="admin-service-vendor-error" role="alert">{filterError}</p>}
        {services.isPending ? <ServiceSkeleton label="Loading services…" />
          : services.isError ? <AdminRequestError title="Unable to load services" error={services.error} retry={() => void services.refetch()} />
          : <section className="vendor-card admin-user-table" aria-label="Service listings" aria-busy={services.isFetching}>
            {rows.length ? <div className="vendor-table-wrap" tabIndex={0} role="region" aria-label="Scrollable services table">
              <table className="vendor-table"><thead><tr>
                <th scope="col">Service</th><th scope="col">Category</th><th scope="col">Vendor</th><th scope="col">Price</th><th scope="col">Visibility</th><th scope="col">Created on</th><th scope="col">Actions</th>
              </tr></thead><tbody>{rows.map((service) => <tr key={service.id} data-selected={selected?.id === service.id}>
                <th scope="row">{service.title}</th><td><span className="vendor-badge">{service.category}</span></td>
                <td>{vendorName(service.vendor)}</td><td>{price.format(service.price)}</td><td><ServiceStatus active={service.isActive} /></td>
                <td><time dateTime={service.createdAt}>{date.format(new Date(service.createdAt))}</time></td>
                <td><div className="admin-user-actions">
                  <button type="button" className="wp-button wp-button-outline admin-user-action" aria-label={`View ${service.title}`}
                    aria-expanded={selected?.id === service.id} onClick={() => setSelected(service)}><UiIcon icon={Eye} size="sm" /><span className="sr-only">View</span></button>
                  {actions(service)}
                </div></td>
              </tr>)}</tbody></table>
            </div> : <WorkspaceState title={filtered ? "No matching services" : "No services yet"}
              text={filtered ? "Try another search or reset the filters." : "Vendor listings will appear here."}>
              {filtered && <button type="button" className="wp-button wp-button-outline" onClick={() => {
                setDraft({ q: "", category: "", vendorId: "" }); setFilters(defaults); setFilterError("")
              }}>Clear filters</button>}
            </WorkspaceState>}
            {pagination && (pagination.totalPages > 1 || filters.page > 1) && <nav className="vendor-pagination" aria-label="Service pagination">
              <span>{format.format(pagination.total)} services · Page {filters.page} of {Math.max(1, pagination.totalPages)}</span>
              <div className="vendor-actions">
                <button type="button" className="wp-button wp-button-outline" disabled={filters.page <= 1}
                  onClick={() => setFilters({ ...filters, page: Math.max(1, Math.min(filters.page - 1, pagination.totalPages)) })}>Previous</button>
                <button type="button" className="wp-button wp-button-outline" disabled={filters.page >= Math.min(10000, pagination.totalPages)}
                  onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button>
              </div>
            </nav>}
          </section>}
      </div>
      {selected && <aside className="vendor-card admin-user-detail" aria-labelledby="admin-service-detail-title">
        <header className="vendor-section-head">
          <h2 id="admin-service-detail-title" ref={title} tabIndex={-1}>Service Details</h2>
          <button type="button" className="wp-button wp-button-outline admin-user-action" aria-label="Close service details" onClick={() => setSelected(null)}><UiIcon icon={X} size="sm" /></button>
        </header>
        {detail.isPending ? <ServiceSkeleton label="Loading service details…" />
          : detail.isError ? <AdminRequestError title="Unable to load service details" error={detail.error} retry={() => void detail.refetch()} />
          : <><div><h3>{detail.data.title}</h3><p>{vendorName(selected.vendor)}</p></div>
            {actions(detail.data)}
            <dl className="admin-metrics">
              <div><dt>Category</dt><dd>{detail.data.category}</dd></div>
              <div><dt>Vendor ID</dt><dd>{detail.data.vendorId}</dd></div>
              <div><dt>Price</dt><dd>{price.format(detail.data.price)}</dd></div>
              <div><dt>Location</dt><dd>{detail.data.location}</dd></div>
              <div><dt>Visibility</dt><dd><ServiceStatus active={detail.data.isActive} /></dd></div>
              <div><dt>Created on</dt><dd><time dateTime={detail.data.createdAt}>{date.format(new Date(detail.data.createdAt))}</time></dd></div>
            </dl>
            <div><h3>Description</h3><p className="admin-service-description">{detail.data.description}</p></div>
          </>}
      </aside>}
    </div>
    <dialog ref={dialog} className="vendor-confirm" aria-labelledby="admin-service-confirm-title"
      onCancel={(event) => { if (operation.isPending) event.preventDefault() }} onClose={() => setAction(null)}>
      {action && <form className="admin-service-form" onSubmit={submit}>
        <h2 id="admin-service-confirm-title">{confirmation}</h2>
        {action.type === "edit" ? <fieldset disabled={operation.isPending}>
          <label>Service title<input name="title" defaultValue={action.service.title} maxLength={120} required /></label>
          <label>Category<input name="category" defaultValue={action.service.category} maxLength={80} required /></label>
          <label>Price<input name="price" type="number" min="0" max="1000000000" step="any" defaultValue={action.service.price} required /></label>
          <label>Location<input name="location" defaultValue={action.service.location} maxLength={120} required /></label>
          <label>Description<textarea name="description" defaultValue={action.service.description} maxLength={5000} required /></label>
        </fieldset> : <p>{action.type === "delete" ? `Permanently delete “${action.service.title}”?`
          : `${action.service.isActive ? "Hide" : "Publish"} “${action.service.title}” in the marketplace?`}</p>}
        {(editError || operation.isError) && <p role="alert" className="admin-user-mutation-error">{editError ||
          (errorStatus === 409 ? "A Free Vendor can have at most 3 active services. Deactivate another listing before activating this one."
            : errorStatus === 404 ? "This service no longer exists." : errorStatus === 403 ? "The server denied this action."
              : errorStatus === 401 ? "Your session expired. Sign in again before retrying." : "Could not update the service. Please try again.")}</p>}
        <div className="vendor-actions">
          <button type="button" className="wp-button wp-button-outline" disabled={operation.isPending} onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit" className="wp-button" disabled={operation.isPending}>{operation.isPending ? "Working…" :
            action.type === "edit" ? "Save changes" : confirmation}</button>
        </div>
      </form>}
    </dialog>
  </div>
}
