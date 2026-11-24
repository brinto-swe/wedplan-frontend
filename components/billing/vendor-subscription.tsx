"use client"

import { useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { ArrowRight, Check, Crown, Gift, Layers3, Scale } from "lucide-react"
import { toast } from "sonner"

import { UiIcon } from "@/components/ui/icon"
import { VendorBanner } from "@/components/vendor/presentation"
import { LoadingState } from "@/components/vendor/workspace"
import { scheduleCancellation, startCheckout } from "@/lib/billing"
import { activeLimit, VendorApiError } from "@/lib/vendor-services"

import { BillingDate, BillingError, canUpgrade, subscriptionStatus, useSubscription } from "./shared"
import { TransactionHistory } from "./transaction-history"

const features = [
  ["Active services", `Up to ${activeLimit}`, "Unlimited"],
  ["Vendor profile and service management", "Included", "Included"],
  ["Manage booking requests", "Included", "Included"],
]

export function VendorSubscription() {
  const query = useSubscription()
  const current = query.data
  const dialog = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const [cancellationSent, setCancellationSent] = useState(false)

  const checkout = useMutation({
    mutationFn: startCheckout,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: () => { submitting.current = false },
  })
  const cancellation = useMutation({
    mutationFn: scheduleCancellation,
    onSuccess: async () => {
      setCancellationSent(true)
      dialog.current?.close()
      toast.success("Cancellation requested.")
      await query.refetch()
    },
    onSettled: () => { submitting.current = false },
  })

  function redirectToCheckout() {
    if (submitting.current) return
    submitting.current = true
    checkout.mutate()
  }

  function confirmCancellation() {
    if (submitting.current) return
    submitting.current = true
    cancellation.mutate()
  }

  const scheduled = current?.cancelAtPeriodEnd || Boolean(current?.cancelAt)
  const allowCancel = current && !scheduled && ["active", "unpaid_or_expired", "past_due", "unpaid", "trialing", "paused"].includes(current.status)
  const busy = cancellation.isPending || checkout.isPending || checkout.isSuccess

  return <div className="vendor-stack">
    <VendorBanner title="Subscription Plans" description="Compare plans, manage your subscription, and review payments." />
    <div className="billing-layout">
      <article className="vendor-card billing-plan">
        <div className="billing-card-heading"><span className="vendor-stat-icon"><UiIcon icon={Gift} size="lg" /></span>
          <div><h2>Free Plan</h2><p className="vendor-muted">Manage your wedding business at no cost.</p></div>
        </div>
        {current?.plan === "free" && <span className="vendor-badge">Current plan</span>}
        <ul>{[`Publish up to ${activeLimit} active services`, "Manage your vendor profile", "Receive and manage booking requests"].map((feature) =>
          <li key={feature}><UiIcon icon={Check} size="sm" />{feature}</li>)}</ul>
      </article>
      <article className="vendor-card billing-plan billing-premium">
        <div className="billing-card-heading"><span className="vendor-stat-icon"><UiIcon icon={Crown} size="lg" /></span>
          <div><h2>Premium Plan</h2><p className="vendor-muted">Publish without an active service limit.</p></div>
        </div>
        {current?.plan === "premium" && <span className="vendor-badge vendor-active">Current plan</span>}
        {current && !query.isError && canUpgrade(current) && <button className="wp-button" type="button" disabled={busy} onClick={redirectToCheckout}>
          {checkout.isPending || checkout.isSuccess ? "Opening Stripe Checkout…" : "Upgrade to Premium"} <UiIcon icon={ArrowRight} size="sm" />
        </button>}
        {checkout.isError && <p className="billing-failed billing-inline" role="alert">{checkout.error instanceof VendorApiError ? checkout.error.message : "Could not open Stripe Checkout. Please try again."}</p>}
        <ul>{["Unlimited active services", "Manage your vendor profile", "Receive and manage booking requests"].map((feature) =>
          <li key={feature}><UiIcon icon={Check} size="sm" />{feature}</li>)}</ul>
        <p className="vendor-muted">Stripe Checkout shows your price and billing interval before you pay.</p>
      </article>
      <section className="vendor-card billing-status" aria-labelledby="subscription-status-title">
        <h2 id="subscription-status-title"><UiIcon icon={Layers3} size="lg" /> Your Subscription</h2>
        {query.isPending ? <LoadingState text="Loading your subscription…" />
          : query.isError ? <BillingError error={query.error} retry={() => void query.refetch()} />
          : <>
            <div className={`billing-current ${query.data.plan === "premium" ? "vendor-active" : ""}`}>
              <strong>{query.data.plan === "premium" ? "Premium" : "Free"} plan</strong>
              <span>{subscriptionStatus(query.data.status)}</span>
            </div>
            <dl className="billing-details">
              <div><dt>Service limit</dt><dd>{query.data.plan === "premium" ? "Unlimited" : `${activeLimit} active services`}</dd></div>
              <div><dt>Paid through</dt><dd><BillingDate value={query.data.expiresAt} /></dd></div>
              <div><dt>Next renewal</dt><dd><BillingDate value={query.data.renewsAt} fallback="Not scheduled" /></dd></div>
              <div><dt>Cancellation</dt><dd>{scheduled ? <>
                {query.data.cancelAtPeriodEnd ? "At period end" : "Scheduled"}
                {(query.data.cancelAt ?? query.data.expiresAt) && <> · <BillingDate value={query.data.cancelAt ?? query.data.expiresAt} /></>}
              </> : "Not scheduled"}</dd></div>
            </dl>
            {scheduled && query.data.plan === "premium" && <p className="vendor-muted">Your Premium access continues through the paid period.</p>}
            {cancellationSent && !scheduled && <p className="billing-inline" role="status">Cancellation requested. Waiting for the billing status to update.</p>}
            <div className="vendor-actions billing-actions">
              {allowCancel && !cancellationSent && <button type="button" className="wp-button wp-button-outline" disabled={busy} onClick={() => {
                cancellation.reset()
                dialog.current?.showModal()
              }}>Cancel Subscription</button>}
              {cancellationSent && !scheduled && <button type="button" className="wp-button wp-button-outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh status</button>}
              <a className="wp-text-link" href="#billing-history-title">View Transaction History</a>
            </div>
          </>}
      </section>
      <section className="vendor-card billing-comparison" aria-labelledby="plan-comparison-title">
        <h2 id="plan-comparison-title"><UiIcon icon={Scale} size="lg" /> Plan Comparison</h2>
        <div className="vendor-table-wrap"><table className="vendor-table billing-table">
          <thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Premium</th></tr></thead>
          <tbody>{features.map(([feature, free, premium]) => <tr key={feature}><th scope="row">{feature}</th><td>{free}</td><td>{premium}</td></tr>)}</tbody>
        </table></div>
      </section>
      <TransactionHistory />
    </div>
    <dialog ref={dialog} className="vendor-confirm" aria-labelledby="cancel-subscription-title" onCancel={(event) => {
      if (cancellation.isPending) event.preventDefault()
    }}>
      <h2 id="cancel-subscription-title">Cancel subscription?</h2>
      <p>Cancellation is scheduled for the end of the billing period. Any current Premium access continues until <BillingDate value={current?.expiresAt ?? null} fallback="your paid-through date" />.</p>
      {cancellation.isError && <p className="billing-failed billing-inline" role="alert">{cancellation.error instanceof VendorApiError ? cancellation.error.message : "Could not schedule cancellation. Please try again."}</p>}
      <div className="vendor-actions">
        <button type="button" className="wp-button wp-button-outline" disabled={cancellation.isPending} onClick={() => dialog.current?.close()}>Keep Subscription</button>
        <button type="button" className="wp-button" disabled={cancellation.isPending} onClick={confirmCancellation}>{cancellation.isPending ? "Scheduling…" : "Confirm Cancellation"}</button>
      </div>
    </dialog>
  </div>
}
