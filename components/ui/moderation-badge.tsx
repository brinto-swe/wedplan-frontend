import { moderationLabels, type ModerationStatus } from "@/lib/service-publication"

export function ModerationBadge({ status }: { status: ModerationStatus }) {
  return <span className={`vendor-badge${status === "approved" ? " vendor-active" : ""}`} data-moderation={status}>{moderationLabels[status]}</span>
}
