"use client"

import { CircleCheck, CircleX, Clock3, Layers3 } from "lucide-react"
import { ActionLink } from "@/components/public/ui"
import { UiIcon } from "@/components/ui/icon"
import { LoadingState } from "@/components/vendor/workspace"

import { BillingDate, BillingError, subscriptionHref, useSubscription } from "./shared"

export function PaymentSuccess() {
  const subscription = useSubscription()
  const confirmed = subscription.isSuccess && subscription.data.plan === "premium"

  return <section className="billing-result" aria-labelledby="billing-result-title">
    <span className={`billing-result-icon ${confirmed ? "vendor-active" : ""}`}><UiIcon icon={confirmed ? CircleCheck : Clock3} size="xl" /></span>
    <h1 id="billing-result-title" aria-live="polite">{confirmed ? "Premium is active" : subscription.isError ? "Payment status unavailable" : "Payment confirmation pending"}</h1>
    <p className="billing-result-intro">{confirmed ? "WedPlan has confirmed your current Premium subscription." : "Your plan updates after WedPlan receives Stripe’s payment confirmation."}</p>
    {subscription.isPending ? <LoadingState text="Checking your subscription…" />
      : subscription.isError ? <BillingError error={subscription.error} retry={() => void subscription.refetch()} />
      : <div className="vendor-card billing-result-card">
        <h2><UiIcon icon={Layers3} size="lg" /> Subscription status</h2>
        {confirmed ? <><p>You can now publish unlimited active services.</p><p>Paid through <BillingDate value={subscription.data.expiresAt} />.</p></>
          : <p>WedPlan hasn’t confirmed Premium yet. Check again in a moment to see whether Stripe has confirmed your payment.</p>}
      </div>}
    <div className="vendor-actions billing-actions">
      {!confirmed && !subscription.isError && <button className="wp-button" type="button" disabled={subscription.isFetching} onClick={() => void subscription.refetch()}>{subscription.isFetching ? "Checking status…" : "Check again"}</button>}
      <ActionLink href={subscriptionHref} secondary={!confirmed}>View Subscription</ActionLink>
      {confirmed && <ActionLink href="/vendor/dashboard" secondary>Go to Dashboard</ActionLink>}
    </div>
  </section>
}

export function PaymentCancel() {
  return <section className="billing-result" aria-labelledby="billing-result-title">
    <span className="billing-result-icon billing-failed"><UiIcon icon={CircleX} size="xl" /></span>
    <h1 id="billing-result-title">Checkout cancelled</h1>
    <p className="billing-result-intro">You left Stripe Checkout before completing the upgrade. This checkout did not upgrade your plan.</p>
    <div className="vendor-card billing-result-card">
      <h2><UiIcon icon={Layers3} size="lg" /> Your subscription</h2>
      <p>You can review your current plan and start Checkout again from your subscription page.</p>
    </div>
    <div className="vendor-actions billing-actions">
      <ActionLink href={subscriptionHref}>Back to Subscription</ActionLink>
      <ActionLink href="/vendor/dashboard" secondary>Go to Dashboard</ActionLink>
    </div>
  </section>
}
