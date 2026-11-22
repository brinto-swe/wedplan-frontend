export default function ServicesLoading() {
  return <div className="wp-wrap wp-section" role="status">
    <p className="wp-kicker">Loading wedding services…</p>
    <div className="wp-service-grid" aria-hidden="true">
      <div className="wp-skeleton" /><div className="wp-skeleton" /><div className="wp-skeleton" />
    </div>
  </div>
}
