"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ReceiptText } from "lucide-react"

import { UiIcon } from "@/components/ui/icon"
import { LoadingState, useVendor, WorkspaceState } from "@/components/vendor/workspace"
import { getTransactions } from "@/lib/billing"
import { formatStripeAmount } from "@/lib/stripe-amount"

import { BillingDate, BillingError } from "./shared"

export function TransactionHistory() {
  const { profile } = useVendor()
  const [page, setPage] = useState(1)
  const history = useQuery({
    queryKey: ["vendor-transactions", profile.id, page],
    queryFn: ({ signal }) => getTransactions(page, signal),
  })

  return <section className="vendor-card billing-history" aria-labelledby="billing-history-title">
    <h2 id="billing-history-title"><UiIcon icon={ReceiptText} size="lg" /> Transaction History</h2>
    {history.isPending ? <LoadingState text="Loading transaction history…" />
      : history.isError ? <BillingError error={history.error} retry={() => void history.refetch()} />
      : <>
        {history.data.data.length === 0 ? <WorkspaceState title="No transactions yet" text="Subscription invoices appear here after Stripe reports a payment or a failed attempt." />
          : <div className="vendor-table-wrap">
            <table className="vendor-table billing-table">
              <thead><tr><th scope="col">Date</th><th scope="col">Amount</th><th scope="col">Currency</th><th scope="col">Status</th><th scope="col">Type</th></tr></thead>
              <tbody>{history.data.data.map((item) => <tr key={item.id}>
                <td><BillingDate value={item.createdAt} /></td>
                <td>{formatStripeAmount(item.amount, item.currency)}</td>
                <td>{item.currency.toUpperCase()}</td>
                <td><span className={`vendor-badge ${item.status === "paid" ? "vendor-active" : "billing-failed"}`}>{item.status === "paid" ? "Paid" : "Failed"}</span></td>
                <td>Subscription</td>
              </tr>)}</tbody>
            </table>
          </div>}
        {(page > 1 || history.data.pagination.totalPages > 1) && <nav aria-label="Transaction history pagination" className="vendor-pagination">
          <span>Page {page} of {Math.max(page, history.data.pagination.totalPages)}</span>
          <div className="vendor-actions">
            <button type="button" className="wp-button wp-button-outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button type="button" className="wp-button wp-button-outline" disabled={page >= history.data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </nav>}
      </>}
  </section>
}
