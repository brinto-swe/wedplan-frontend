"use client"

import { useQuery } from "@tanstack/react-query"
import { CalendarDays, Eye, ReceiptText, Search, X } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { AdminRequestError } from "@/components/admin/workspace"
import { UiIcon } from "@/components/ui/icon"
import { LoadingLabel } from "@/components/ui/loading-label"
import { VendorBanner } from "@/components/vendor/presentation"
import { WorkspaceState } from "@/components/vendor/workspace"
import { getAdminTransaction, listAdminTransactions, type AdminTransaction, type AdminTransactionFilters } from "@/lib/admin"
import { formatStripeAmount } from "@/lib/stripe-amount"

const defaults: AdminTransactionFilters = { q: "", status: "", vendorId: "", currency: "", from: "", to: "" }
const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })
const number = new Intl.NumberFormat()

function TransactionDate({ value }: { value: string }) {
  return <time dateTime={value}>{date.format(new Date(value))} UTC</time>
}

function PaymentStatus({ status }: { status: AdminTransaction["status"] }) {
  return <span className={`vendor-badge admin-user-status ${status === "paid" ? "vendor-active" : "admin-user-blocked"}`}>
    {status === "paid" ? "Paid" : "Failed"}
  </span>
}

function VendorDisplay({ transaction }: { transaction: AdminTransaction }) {
  const { vendor, vendorId } = transaction
  return <div className="admin-transaction-vendor">
    <strong>{vendor?.businessName || vendor?.name || "Vendor " + vendorId}</strong>
    {vendor?.businessName && vendor.name && vendor.name !== vendor.businessName && <p>{vendor.name}</p>}
  </div>
}

function planLabel(plan: AdminTransaction["plan"]) {
  return plan === "premium" ? "Premium" : "Not recorded"
}

function TransactionSkeleton({ label }: { label: string }) {
  return <div className="vendor-card admin-user-loading" aria-busy="true">
    <LoadingLabel>{label}</LoadingLabel>
    <div aria-hidden="true">{[1, 2, 3].map((row) => <div className="admin-gate-skeleton" key={row} />)}</div>
  </div>
}

function TransactionDetails({ id, close }: { id: string; close: () => void }) {
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => { title.current?.focus() }, [id])
  const detail = useQuery({
    queryKey: ["admin-transaction", id],
    queryFn: ({ signal }) => getAdminTransaction(id, signal),
  })
  return <aside className="vendor-card admin-user-detail" aria-labelledby="admin-transaction-detail-title">
    <header className="vendor-section-head">
      <h2 id="admin-transaction-detail-title" ref={title} tabIndex={-1}><UiIcon icon={ReceiptText} size="sm" /> Transaction Details</h2>
      <button type="button" className="wp-button wp-button-outline admin-user-action" aria-label="Close transaction details" onClick={close}>
        <UiIcon icon={X} size="sm" />
      </button>
    </header>
    {detail.isPending ? <TransactionSkeleton label="Loading transaction details…" />
      : detail.isError ? <AdminRequestError title="Unable to load transaction details" error={detail.error} retry={() => void detail.refetch()} />
      : <><PaymentStatus status={detail.data.status} />
        <dl className="admin-metrics">
          <div><dt>Invoice ID</dt><dd>{detail.data.id}</dd></div>
          <div><dt>Vendor</dt><dd><VendorDisplay transaction={detail.data} /></dd></div>
          <div><dt>Plan</dt><dd>{planLabel(detail.data.plan)}</dd></div>
          <div><dt>Vendor ID</dt><dd>{detail.data.vendorId}</dd></div>
          <div><dt>Amount</dt><dd>{formatStripeAmount(detail.data.amount, detail.data.currency, "code")}</dd></div>
          <div><dt>Invoice type</dt><dd>Subscription</dd></div>
          <div><dt>Recorded event (UTC)</dt><dd><TransactionDate value={detail.data.createdAt} /></dd></div>
          <div><dt>Date basis</dt><dd><code>{detail.data.dateBasis}</code></dd></div>
          <div><dt>Invoice creation date</dt><dd>Unavailable</dd></div>
          <div><dt>Billing period</dt><dd>Unavailable</dd></div>
        </dl>
        <p className="admin-panel-empty">The recorded date comes from the Stripe invoice webhook event.</p>
      </>}
  </aside>
}

export function AdminTransactions() {
  const [draft, setDraft] = useState(defaults)
  const [filters, setFilters] = useState(defaults)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [dateError, setDateError] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const ledger = useQuery({
    queryKey: ["admin-transactions", filters, page],
    queryFn: ({ signal }) => listAdminTransactions(filters, page, signal),
  })
  const filtered = Object.values(filters).some(Boolean)
  const pagination = ledger.data?.pagination

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const invalidRange = Boolean(draft.from && draft.to && draft.from > draft.to)
    setDateError(invalidRange)
    if (invalidRange) return
    setFilters({ ...draft, q: draft.q.trim(), vendorId: draft.vendorId.trim(), currency: draft.currency.toLowerCase() })
    setPage(1)
    setSelected(null)
  }

  function clearFilters() {
    setDraft(defaults)
    setFilters(defaults)
    setPage(1)
    setDateError(false)
    setSelected(null)
  }

  return <div className="vendor-stack admin-transactions">
    <div className={`admin-users-grid${selected ? " admin-users-split" : ""}`}>
      <div className="admin-users-main">
        <VendorBanner title="Transactions" description="Review recorded Stripe subscription invoices. Individual card payment attempts are outside this ledger." />
        <form className="vendor-toolbar admin-users-toolbar admin-transaction-filters" onSubmit={filter}>
          <label className="vendor-search"><span>Invoice ID search</span><span><UiIcon icon={Search} size="sm" />
            <input type="search" maxLength={128} pattern="[A-Za-z0-9_]{1,128}" title="Use letters, numbers, and underscores" value={draft.q}
              onChange={(event) => setDraft({ ...draft, q: event.target.value })} />
          </span></label>
          <label>Payment status<select value={draft.status} onChange={(event) => setDraft({
            ...draft, status: event.target.value as AdminTransactionFilters["status"],
          })}>
            <option value="">All statuses</option><option value="paid">Paid</option><option value="failed">Failed</option>
          </select></label>
          <label>Vendor ID<input maxLength={24} pattern="[a-fA-F0-9]{24}" title="Enter a 24-character hexadecimal Vendor ID"
            value={draft.vendorId} onChange={(event) => setDraft({ ...draft, vendorId: event.target.value })} /></label>
          <label>Currency<input maxLength={3} pattern="[A-Za-z]{3}" title="Enter a three-letter currency code" placeholder="All currencies"
            value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })} /></label>
          <label>From (UTC)<input type="date" value={draft.from}
            onChange={(event) => { setDraft({ ...draft, from: event.target.value }); setDateError(false) }} /></label>
          <label>To (UTC)<input type="date" value={draft.to} aria-invalid={dateError} aria-describedby={dateError ? "transaction-date-error" : undefined}
            onChange={(event) => { setDraft({ ...draft, to: event.target.value }); setDateError(false) }} /></label>
          <div className="vendor-actions">
            <button type="submit" className="wp-button">Apply filters</button>
            <button type="button" className="wp-button wp-button-outline" onClick={clearFilters}>Clear filters</button>
          </div>
        </form>
        {dateError && <p id="transaction-date-error" className="admin-user-mutation-error" role="alert">End date must be on or after the start date.</p>}
        <p className="admin-transaction-date-basis"><UiIcon icon={CalendarDays} size="sm" /> Dates reflect recorded Stripe invoice events (UTC).</p>
        {ledger.isPending ? <TransactionSkeleton label="Loading transactions…" />
          : ledger.isError ? <AdminRequestError title="Unable to load transactions" error={ledger.error} retry={() => void ledger.refetch()} />
          : <section className="vendor-card admin-user-table" aria-label="Transaction ledger" aria-busy={ledger.isFetching}>
            {ledger.data.data.length ? <div className="vendor-table-wrap" role="region" tabIndex={0} aria-label="Scrollable transactions table">
              <table className="vendor-table">
                <thead><tr>
                  <th scope="col">Invoice ID</th><th scope="col">Vendor</th><th scope="col">Plan</th><th scope="col">Amount</th><th scope="col">Status</th>
                  <th scope="col">Recorded event (UTC)</th><th scope="col">Details</th>
                </tr></thead>
                <tbody>{ledger.data.data.map((row) => <tr key={row.id} data-selected={row.id === selected}>
                  <th scope="row"><span className="admin-transaction-id">{row.id}</span></th>
                  <td><VendorDisplay transaction={row} /></td>
                  <td>{planLabel(row.plan)}</td>
                  <td className="admin-transaction-amount">{formatStripeAmount(row.amount, row.currency, "code")}</td>
                  <td><PaymentStatus status={row.status} /></td>
                  <td><TransactionDate value={row.createdAt} /></td>
                  <td><button type="button" className="wp-button wp-button-outline admin-user-action"
                    aria-label={`View invoice ${row.id}`} aria-expanded={row.id === selected} onClick={(event) => {
                      trigger.current = event.currentTarget
                      setSelected(row.id)
                    }}><UiIcon icon={Eye} size="sm" /></button></td>
                </tr>)}</tbody>
              </table>
            </div> : <WorkspaceState title={filtered ? "No matching transactions" : "No transactions yet"}
              text={filtered ? "Try another invoice ID or clear the filters." : "Recorded Stripe subscription invoices will appear here."} />}
            {pagination && (pagination.total > 0 || page > 1) && <nav className="vendor-pagination" aria-label="Transaction pagination">
              <span>{number.format(pagination.total)} {pagination.total === 1 ? "invoice" : "invoices"} · Page {page} of {Math.max(1, pagination.totalPages)}</span>
              <div className="vendor-actions">
                <button type="button" className="wp-button wp-button-outline" disabled={page <= 1} onClick={() => {
                  setSelected(null)
                  setPage(Math.max(1, Math.min(page - 1, pagination.totalPages)))
                }}>Previous</button>
                <button type="button" className="wp-button wp-button-outline" disabled={page >= Math.min(10000, pagination.totalPages)} onClick={() => {
                  setSelected(null)
                  setPage(page + 1)
                }}>Next</button>
              </div>
            </nav>}
          </section>}
      </div>
      {selected && <TransactionDetails id={selected} close={() => { setSelected(null); trigger.current?.focus() }} />}
    </div>
  </div>
}
