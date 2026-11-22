"use client"

import { ActionLink, EmptyState } from "@/components/public/ui"

export default function ServicesError({ reset }: { reset: () => void }) {
  return <div className="wp-wrap wp-section">
    <EmptyState title="Something went wrong">
      <p>We couldn’t load the directory.</p>
      <button className="wp-button" type="button" onClick={reset}>Try again</button>{" "}
      <ActionLink href="/" secondary>Go home</ActionLink>
    </EmptyState>
  </div>
}
