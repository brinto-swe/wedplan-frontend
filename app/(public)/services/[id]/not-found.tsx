import { ActionLink, EmptyState } from "@/components/public/ui"

export default function ServiceNotFound() {
  return <div className="wp-wrap wp-section">
    <EmptyState title="Service not found"><p>This listing may have been removed or is no longer active.</p>
      <ActionLink href="/services">Browse services</ActionLink>
    </EmptyState>
  </div>
}
