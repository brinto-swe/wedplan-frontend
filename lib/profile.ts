import { z } from "zod"
import { apiOrigin, authClient } from "@/lib/auth"
import { hostedImageUrl } from "@/lib/service-image-urls"

const httpsAvatar = z.string().refine((value) => {
  const url = URL.parse(value)
  return url?.protocol === "https:" && !url.username && !url.password
})

export const accountProfile = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["customer", "vendor", "admin"]),
  image: httpsAvatar.nullable().default(null),
  emailVerified: z.boolean().optional(),
  createdAt: z.iso.datetime().optional(),
  businessName: z.string().optional(),
})
export type AccountProfile = z.infer<typeof accountProfile>
export const profileKey = (role: "customer" | "vendor", id?: string) => ["workspace-profile", role, id]

export const profileChanges = z.strictObject({
  name: z.string().trim().min(1, "Enter your full name.").max(120, "Use no more than 120 characters."),
  image: hostedImageUrl.nullable().optional(),
  businessName: z.string().trim().max(120, "Use no more than 120 characters.").optional(),
})
const fieldIssues = z.object({ issues: z.array(z.object({ path: z.string(), message: z.string() })).optional() })
const errors: Record<number, string> = {
  400: "Review the highlighted fields and try again.",
  401: "Your session expired. Sign in again to save changes.",
  403: "This account cannot update its profile.",
}

export class ProfileError extends Error {
  constructor(readonly status: number, readonly fields: Record<string, string> = {}) {
    super(errors[status] ?? "We couldn’t save your profile. Please try again.")
  }
}

export async function updateProfile(values: z.input<typeof profileChanges>) {
  const { data, error } = await authClient.token({ fetchOptions: { timeout: 10_000 } })
  if (!data?.token) throw new ProfileError(error?.status ?? 401)
  const response = await fetch(new URL("/api/me", apiOrigin), {
    method: "PATCH", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(profileChanges.parse(values)),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const parsed = fieldIssues.safeParse(payload)
    const issues = parsed.success ? parsed.data.issues ?? [] : []
    throw new ProfileError(response.status, Object.fromEntries(issues.map(({ path, message }) => [path, message])))
  }
  return accountProfile.parse(payload)
}
