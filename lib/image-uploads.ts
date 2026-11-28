"use client"

import { z } from "zod"
import { apiOrigin, authClient } from "@/lib/auth"
import { hostedImageUrl } from "@/lib/service-image-urls"

export const maxImageBytes = 4 * 1024 * 1024
export const imageTypes = ["image/jpeg", "image/png", "image/webp"] as const
const uploadResult = z.object({
  data: z.tuple([z.object({ url: hostedImageUrl, displayUrl: hostedImageUrl.optional() })]),
})
const messages: Record<number, string> = {
  400: "Select one image and try again.",
  401: "Sign in again to upload images.",
  403: "Your account cannot upload images.",
  413: "The image exceeds the 4 MiB limit.",
  415: "Use a valid JPEG, PNG, or WebP image.",
  429: "Too many requests. Wait a moment before retrying.",
  504: "Image hosting timed out. Try again.",
}

export async function uploadImage(file: File, signal: AbortSignal) {
  const { data, error } = await authClient.token({ fetchOptions: { signal, timeout: 10_000 } })
  if (!data?.token) throw new Error(messages[error?.status ?? 401] ?? "Could not verify your session.")

  return postImage("/api/uploads/images", file, signal, { Authorization: `Bearer ${data.token}` })
}

export function uploadSignupImage(file: File, signal: AbortSignal) {
  return postImage("/api/uploads/signup-profile-image", file, signal, { "X-WedPlan-Upload": "signup-profile" })
}

async function postImage(path: string, file: File, signal: AbortSignal, headers: Record<string, string>) {
  const body = new FormData()
  body.append("images", file)
  const response = await fetch(new URL(path, apiOrigin), {
    method: "POST", body, credentials: "omit", cache: "no-store",
    headers,
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
  })
  if (response.status !== 201) throw new Error(messages[response.status] ?? "Could not upload this image. Try again.")
  const result = uploadResult.safeParse(await response.json().catch(() => null))
  if (!result.success) throw new Error("Image hosting returned an invalid response. Try again.")
  return result.data.data[0].url
}
