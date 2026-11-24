"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Ban, Eye, Search, ShieldCheck, Store, UserRound, Users, X } from "lucide-react"
import { toast } from "sonner"

import { UiIcon } from "@/components/ui/icon"
import { LoadingLabel } from "@/components/ui/loading-label"
import { VendorBanner, VendorStats } from "@/components/vendor/presentation"
import { WorkspaceState } from "@/components/vendor/workspace"
import { authClient } from "@/lib/auth"
import {
  AdminApiError, adminUserRoles, adminUserStatuses, getAdminOverview, getAdminUser, listAdminUsers,
  updateAdminUserStatus, type AdminUser, type AdminUserFilters,
} from "@/lib/admin"
import { AdminRequestError } from "./workspace"

const roleLabels = { admin: "Admin", customer: "Customer", vendor: "Vendor" }
const statusLabels = { active: "Active", blocked: "Blocked" }
const defaults: AdminUserFilters = { q: "", role: "", status: "", page: 1 }
const number = new Intl.NumberFormat()
const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" })

function UserDate({ value }: { value?: string }) {
  return value ? <time dateTime={value}>{date.format(new Date(value))}</time> : "—"
}

function UserStatus({ status }: { status: AdminUser["status"] }) {
  return <span className={`vendor-badge admin-user-status ${status === "active" ? "vendor-active" : "admin-user-blocked"}`}>{statusLabels[status]}</span>
}

function UserIdentity({ user }: { user: AdminUser }) {
  return <div className="admin-user-identity">
    <span className="vendor-avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>
    <div><strong>{user.name}</strong><p>{user.email}</p></div>
  </div>
}

function UserSkeleton({ label }: { label: string }) {
  return <div className="admin-user-loading" aria-busy="true">
    <LoadingLabel>{label}</LoadingLabel>
    <div aria-hidden="true">{[0, 1, 2].map((row) => <span className="admin-gate-skeleton" key={row} />)}</div>
  </div>
}

export function ManageUsers() {
  const viewer = authClient.useSession().data?.user.id
  const client = useQueryClient()
  const [filters, setFilters] = useState(defaults)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [target, setTarget] = useState<AdminUser | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const detailTitle = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (selectedId) detailTitle.current?.focus() }, [selectedId])
  const usersKey = ["admin-users", viewer]
  const detailKey = ["admin-user", viewer]
  const overviewKey = ["admin-overview", viewer]
  const summary = useQuery({ queryKey: overviewKey, queryFn: ({ signal }) => getAdminOverview(signal) })
  const users = useQuery({ queryKey: [...usersKey, filters], queryFn: ({ signal }) => listAdminUsers(filters, signal) })
  const detail = useQuery({
    queryKey: [...detailKey, selectedId],
    enabled: selectedId !== null,
    queryFn: ({ signal }) => getAdminUser(selectedId!, signal),
  })
  const mutation = useMutation({
    mutationFn: ({ id, status }: AdminUser) => updateAdminUserStatus(id, status === "active" ? "blocked" : "active"),
    onSuccess: async (updated) => {
      await client.cancelQueries({ queryKey: [...detailKey, updated.id] })
      client.setQueryData([...detailKey, updated.id], updated)
      await Promise.all([
        client.invalidateQueries({ queryKey: usersKey }),
        client.invalidateQueries({ queryKey: overviewKey }),
      ])
      dialog.current?.close()
      toast.success(updated.status === "blocked" ? "User blocked." : "User unblocked.")
    },
  })

  function changeFilters(next: Partial<AdminUserFilters>) {
    setFilters((current) => ({ ...current, ...next, page: 1 }))
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    changeFilters({ q: search.trim() })
  }

  function openStatus(user: AdminUser) {
    if (user.id === viewer && user.status === "active") return
    mutation.reset()
    setTarget(user)
    dialog.current?.showModal()
  }

  function statusButton(user: AdminUser) {
    const blocked = user.status === "blocked"
    return <button type="button" className="wp-button wp-button-outline admin-user-action"
      disabled={mutation.isPending || (!blocked && user.id === viewer)}
      aria-label={`${blocked ? "Unblock" : "Block"} ${user.name}`}
      title={!blocked && user.id === viewer ? "You cannot block your own account" : undefined}
      onClick={() => openStatus(user)}>
      <UiIcon icon={blocked ? ShieldCheck : Ban} size="sm" />{blocked ? "Unblock" : "Block"}
    </button>
  }

  const presets = [
    { label: "All Users", role: "", status: "" },
    { label: "Customers", role: "customer", status: "" },
    { label: "Vendors", role: "vendor", status: "" },
    { label: "Blocked", role: "", status: "blocked" },
  ] as const
  const summaryCounts = summary.data?.users
  const pagination = users.data?.pagination
  const entries = users.data?.data ?? []
  const filtered = Boolean(filters.q || filters.role || filters.status)
  const mutationStatus = mutation.error instanceof AdminApiError ? mutation.error.status : null

  return <div className="vendor-stack admin-users">
    <VendorBanner title="Users Management" description="Review platform accounts and manage their access." />
    <div className={`admin-users-grid${selectedId ? " admin-users-split" : ""}`}>
      <div className="admin-users-main">
        <VendorStats items={[
          { label: "Total Users", value: summaryCounts ? number.format(summaryCounts.total) : "—", icon: Users },
          { label: "Customers", value: summaryCounts ? number.format(summaryCounts.customers) : "—", icon: UserRound },
          { label: "Vendors", value: summaryCounts ? number.format(summaryCounts.vendors) : "—", icon: Store },
          { label: "Blocked Users", value: summaryCounts ? number.format(summaryCounts.blocked) : "—", icon: Ban },
        ]} />
        <div className="admin-user-presets" role="group" aria-label="User categories">{presets.map(({ label, role, status }) =>
          <button type="button" key={label} className="wp-button wp-button-outline"
            aria-pressed={role === filters.role && status === filters.status} onClick={() => changeFilters({ role, status })}>{label}</button>
        )}</div>
        <form className="vendor-toolbar admin-users-toolbar" onSubmit={submitSearch}>
          <label className="vendor-search"><span>Search by name or email</span><span><UiIcon icon={Search} size="sm" />
            <input type="search" value={search} maxLength={254} onChange={(event) => setSearch(event.target.value)} /></span></label>
          <button className="wp-button wp-button-outline" type="submit">Search</button>
          <label><span id="admin-user-role-filter">Role</span><select aria-labelledby="admin-user-role-filter" value={filters.role} onChange={(event) => {
            const value = event.target.value
            changeFilters({ role: adminUserRoles.find((role) => role === value) ?? "" })
          }}><option value="">All roles</option>{adminUserRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
          <label><span id="admin-user-status-filter">Account status</span><select aria-labelledby="admin-user-status-filter" value={filters.status} onChange={(event) => {
            const value = event.target.value
            changeFilters({ status: adminUserStatuses.find((status) => status === value) ?? "" })
          }}><option value="">All statuses</option>{adminUserStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        </form>
        {users.isPending ? <UserSkeleton label="Loading users…" />
          : users.isError ? <AdminRequestError title="Unable to load users" error={users.error} retry={() => void users.refetch()} />
          : <section className="vendor-card admin-user-table" aria-label="User accounts" aria-busy={users.isFetching}>
            {entries.length ? <div className="vendor-table-wrap" tabIndex={0} role="region" aria-label="Scrollable users table">
              <table className="vendor-table"><thead><tr>
                <th scope="col">User</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined on</th><th scope="col">Actions</th>
              </tr></thead><tbody>{entries.map((user) => <tr key={user.id} data-selected={selectedId === user.id}>
                <th scope="row"><UserIdentity user={user} /></th>
                <td><span className="vendor-badge">{roleLabels[user.role]}</span></td><td><UserStatus status={user.status} /></td>
                <td><UserDate value={user.createdAt} /></td>
                <td><div className="admin-user-actions">
                  <button type="button" className="wp-button wp-button-outline admin-user-action" aria-label={`View ${user.name}`}
                    aria-expanded={selectedId === user.id} onClick={() => setSelectedId(user.id)}><UiIcon icon={Eye} size="sm" />View</button>
                  {statusButton(user)}
                </div></td>
              </tr>)}</tbody></table>
            </div> : <WorkspaceState title={filtered ? "No matching users" : "No users yet"}
              text={filtered ? "Try another search or reset the filters." : "Accounts will appear here after registration."}>
              {filtered && <button type="button" className="wp-button wp-button-outline" onClick={() => { setSearch(""); setFilters(defaults) }}>Clear filters</button>}
            </WorkspaceState>}
            {pagination && (pagination.totalPages > 1 || filters.page > 1) && <nav className="vendor-pagination" aria-label="User pagination">
              <span>{number.format(pagination.total)} users · Page {filters.page} of {Math.max(1, pagination.totalPages)}</span>
              <div className="vendor-actions">
                <button type="button" className="wp-button wp-button-outline" disabled={filters.page <= 1}
                  onClick={() => setFilters({ ...filters, page: Math.max(1, Math.min(filters.page - 1, pagination.totalPages)) })}>Previous</button>
                <button type="button" className="wp-button wp-button-outline" disabled={filters.page >= Math.min(10000, pagination.totalPages)}
                  onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button>
              </div>
            </nav>}
          </section>}
      </div>
      {selectedId && <aside className="vendor-card admin-user-detail" aria-labelledby="admin-user-detail-title">
        <header className="vendor-section-head"><h2 id="admin-user-detail-title" ref={detailTitle} tabIndex={-1}>User Details</h2>
          <button type="button" className="wp-button wp-button-outline admin-user-action" aria-label="Close user details" onClick={() => setSelectedId(null)}><UiIcon icon={X} size="sm" /></button>
        </header>
        {detail.isPending ? <UserSkeleton label="Loading user details…" />
          : detail.isError ? <AdminRequestError title="Unable to load user details" error={detail.error} retry={() => void detail.refetch()} />
          : <><UserIdentity user={detail.data} /><dl className="admin-metrics">
            <div><dt>Role</dt><dd>{roleLabels[detail.data.role]}</dd></div>
            <div><dt>Account status</dt><dd><UserStatus status={detail.data.status} /></dd></div>
            <div><dt>Email verified</dt><dd>{detail.data.emailVerified ? "Yes" : "No"}</dd></div>
            <div><dt>Joined on</dt><dd><UserDate value={detail.data.createdAt} /></dd></div>
            <div><dt>Last updated</dt><dd><UserDate value={detail.data.updatedAt} /></dd></div>
          </dl>{statusButton(detail.data)}</>}
      </aside>}
    </div>
    <dialog ref={dialog} className="vendor-confirm" aria-labelledby="admin-user-confirm-title"
      onCancel={(event) => { if (mutation.isPending) event.preventDefault() }} onClose={() => setTarget(null)}>
      {target && <><h2 id="admin-user-confirm-title">{target.status === "active" ? "Block" : "Unblock"} {target.name}?</h2>
        <p>{target.status === "active" ? "This user will lose access to protected features." : "This user will regain access to their account."}</p>
        {mutation.isError && <p role="alert" className="admin-user-mutation-error">{
          mutationStatus === 403 ? "The server denied this status change." : mutationStatus === 404 ? "This user is no longer available."
            : mutationStatus === 401 ? "Your session expired. Sign in again before retrying." : "Could not change the account status. Please try again."
        }</p>}
        <div className="vendor-actions">
          <button type="button" className="wp-button wp-button-outline" disabled={mutation.isPending} onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="button" className="wp-button" disabled={mutation.isPending} onClick={() => mutation.mutate(target)}>
            {mutation.isPending ? "Updating…" : target.status === "active" ? "Confirm block" : "Confirm unblock"}
          </button>
        </div>
      </>}
    </dialog>
  </div>
}
