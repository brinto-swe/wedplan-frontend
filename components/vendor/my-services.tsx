"use client"

import { UiIcon } from "@/components/ui/icon"
import { ModerationBadge } from "@/components/ui/moderation-badge"
import { ServicePhoto } from "@/components/public/service-photo"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CircleCheck, CircleMinus, Layers3, Search, Pencil, Trash2, Eye } from "lucide-react"
import { serviceImages } from "@/lib/services"
import { ActionLink } from "@/components/public/ui"
import { activeLimit, deleteVendorService, type VendorService } from "@/lib/vendor-services"
import { LoadingState, RequestError, useVendor, useVendorServices, vendorServicesKey, WorkspaceState } from "./workspace"

import { VendorBanner, VendorStats } from "./presentation"

const pageSize = 6
const formatPrice = new Intl.NumberFormat("en", { maximumFractionDigits: 2 })

export function MyServices() {
  const { profile, plan } = useVendor()
  const query = useVendorServices()
  const client = useQueryClient()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")
  const [category, setCategory] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<VendorService | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [notice, setNotice] = useState("")
  const removal = useMutation({
    mutationFn: deleteVendorService,
    onSuccess: async (_data, deletedId) => {
      const key = vendorServicesKey(profile.id)
      await client.cancelQueries({ queryKey: key })
      client.setQueryData<VendorService[]>(key, (services) => services?.filter(({ id }) => id !== deletedId))
      setSelected(null)
      setNotice("Service deleted.")
      void client.invalidateQueries({ queryKey: key })
    },
  })
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal()
    if (!selected && dialog.current?.open) dialog.current.close()
  }, [selected])
  const items = query.data ?? []
  const active = items.filter((item) => item.isActive).length
  const needle = search.trim().toLowerCase()
  const matches = items.filter((item) =>
    (!category || item.category === category) &&
    (status === "all" || item.isActive === (status === "active")) &&
    (!needle || [item.title, item.category, item.location].some((value) => value.toLowerCase().includes(needle))),
  )
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize))
  const current = Math.min(page, totalPages)
  const visible = matches.slice((current - 1) * pageSize, current * pageSize)

  return <div className="vendor-stack">
    <VendorBanner title="My Services" description="Manage your wedding services, keep them up to date, and showcase your offerings."><ActionLink href="/vendor/services/new">Add New Service</ActionLink></VendorBanner>
    <VendorStats items={[
      { label: "Total services", value: query.data ? items.length : "—", icon: Layers3 },
      { label: "Active", value: query.data ? active : "—", icon: CircleCheck },
      { label: "Inactive", value: query.data ? items.length - active : "—", icon: CircleMinus },
    ]} />
    <section className="vendor-plan-strip" aria-label="Service limit">
      <span className="vendor-badge">{plan === "Unavailable" ? "Plan unavailable" : `${plan} plan`}</span>
      <p>{plan === "Free" ? `Only your ${activeLimit} newest approved services are eligible to publish. Older approved services stay saved. Paused services stay off.`
        : plan === "Premium" ? "All approved services are eligible to publish. Manually paused services stay off." : "Subscription data is unavailable. Public visibility reflects the latest service response."}</p>
    </section>
    {notice && <p className="vendor-notice" role="status">{notice}</p>}
    <dialog ref={dialog} className="vendor-confirm" aria-labelledby="delete-service-title" onCancel={(event) => { event.preventDefault(); if (!removal.isPending) setSelected(null) }}>
    {selected && <>
      <div><h2 id="delete-service-title">Delete {selected.title}?</h2><p>This action permanently removes the service.</p></div>
      <div className="vendor-actions">
        <button className="wp-button wp-button-outline" type="button" disabled={removal.isPending} onClick={() => setSelected(null)}>Cancel</button>
        <button className="wp-button" type="button" disabled={removal.isPending} onClick={() => removal.mutate(selected.id)}>
          {removal.isPending ? "Deleting…" : "Confirm delete"}
        </button>
      </div>
      {removal.isError && <RequestError error={removal.error} retry={() => removal.mutate(selected.id)} />}
    </>}
    </dialog>
    {query.isPending ? <LoadingState text="Loading your services…" /> : query.isError ? <RequestError error={query.error} retry={() => void query.refetch()} /> : (
      <section className="vendor-card vendor-table-card" aria-label="Your service listings">
        <div className="vendor-toolbar">
          <label className="vendor-search"><span>Search services</span><span><UiIcon icon={Search} size="sm" /><input type="search" value={search} placeholder="Title, category, or location" onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></span></label>
          <label>Category<select value={category} onChange={(event) => {setCategory(event.target.value); setPage(1)}}><option value="">All categories</option>{[...new Set(items.map((item) => item.category))].sort().map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Public visibility<select value={status} onChange={(event) => { const value = event.target.value; setStatus(value === "active" || value === "inactive" ? value : "all"); setPage(1) }}>
            <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select></label>
        </div>
        {visible.length ? <>
          <div className="vendor-table-wrap"><table className="vendor-table">
            <thead><tr><th scope="col">Service</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Moderation</th><th scope="col">Saved availability</th><th scope="col">Public visibility</th><th scope="col">Created</th><th scope="col">Actions</th></tr></thead>
            <tbody>{visible.map((item) => <tr key={item.id}>
              <td><div className="vendor-service-cell"><ServicePhoto src={item.images?.[0] ?? serviceImages(item.category)[0].image}
                fallback={serviceImages(item.category)[0].image} alt="" width={70} height={43} /><div><strong>{item.title}</strong><span>{item.location}</span></div></div></td>
              <td><span className="vendor-badge">{item.category}</span></td><td>{formatPrice.format(item.price)}</td>
              <td><ModerationBadge status={item.moderationStatus} />
                {item.moderationStatus === "pending" && <p className="vendor-publication-note">Awaiting Admin review</p>}
                {item.moderationStatus === "rejected" && <p className="vendor-publication-note">Ineligible for public display</p>}
              </td>
              <td>{item.moderationStatus === "approved" ? item.vendorAvailable ? "Enabled" : "Paused" : "Locked until approval"}</td>
              <td><span className={`vendor-badge ${item.isActive ? "vendor-active" : ""}`}>{item.isActive ? "Active" : "Inactive"}</span>
                {item.moderationStatus === "approved" && item.vendorAvailable && !item.isActive &&
                  <p className="vendor-publication-note">{plan === "Free" ? "Outside the Free plan’s latest three. Still saved." : "Availability enabled. Currently unpublished."}</p>}
              </td>
              <td><time dateTime={item.createdAt}>{new Intl.DateTimeFormat("en",{dateStyle:"medium"}).format(new Date(item.createdAt))}</time></td><td><div className="vendor-row-actions">
                {item.isActive && <Link aria-label={`View ${item.title}`} href={`/services/${item.id}`}><UiIcon icon={Eye} size="sm" /></Link>}
                <Link aria-label={`Edit ${item.title}`} href={`/vendor/services/${item.id}/edit`}><UiIcon icon={Pencil} size="sm" /></Link>
                <button type="button" aria-label={`Delete ${item.title}`} disabled={removal.isPending} onClick={() => { removal.reset(); setNotice(""); setSelected(item) }}><UiIcon icon={Trash2} size="sm" /></button>
              </div></td>
            </tr>)}</tbody>
          </table></div>
          <div className="vendor-pagination">
            <p>{matches.length} {matches.length === 1 ? "service" : "services"} · Page {current} of {totalPages}</p>
            <div className="vendor-actions">
              <button className="wp-button wp-button-outline" type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button>
              <button className="wp-button wp-button-outline" type="button" disabled={current === totalPages} onClick={() => setPage(current + 1)}>Next</button>
            </div>
          </div>
        </> : <WorkspaceState title={items.length ? "No matching services" : "No services yet"}
          text={items.length ? "Try a different search or change the status filter." : "Add your first service to start building your portfolio."}>
          {items.length ? <button className="wp-button wp-button-outline" type="button" onClick={() => { setSearch(""); setStatus("all"); setCategory(""); setPage(1) }}>Clear filters</button>
            : <ActionLink href="/vendor/services/new">Add service</ActionLink>}
        </WorkspaceState>}
      </section>
    )}
  </div>
}
