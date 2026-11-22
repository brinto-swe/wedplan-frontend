import { LoadingLabel } from "@/components/ui/loading-label"

export default function ServicesLoading() {
  return <div className="wp-wrap wp-section">
    <LoadingLabel>Loading wedding services…</LoadingLabel>
    <div className="wp-service-grid" aria-hidden="true">
      <div className="wp-skeleton" /><div className="wp-skeleton" /><div className="wp-skeleton" />
    </div>
  </div>
}
