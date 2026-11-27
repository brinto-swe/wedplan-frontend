import { z } from "zod"

export const moderationStatus = z.enum(["pending", "approved", "rejected"])
export type ModerationStatus = z.infer<typeof moderationStatus>

export const moderationLabels: Record<ModerationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
}

export const publicationFields = {
  moderationStatus,
  vendorAvailable: z.boolean(),
  isActive: z.boolean(),
}
