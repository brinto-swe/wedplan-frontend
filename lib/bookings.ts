"use client"

import { z } from "zod"
import { authClient } from "@/lib/auth"

const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
const id = z.string().regex(/^[a-f0-9]{24}$/i)
export const statuses = ["pending", "accepted", "rejected", "cancelled"] as const
export const utcToday = () => new Date().toISOString().slice(0, 10)
const text = (label: string, max: number) => z.string().trim().min(1, `${label} is required.`).max(max)
const contact = z.object({
  name: text("Name", 120),
  email: z.email("Enter a valid email address.").max(254),
  phone: text("Phone number", 32).refine((value) => /^\+?[\d ().-]+$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7, "Enter a valid phone number."),
})
const base = z.object({ serviceId: id, eventDate: z.iso.date(), eventLocation: text("Event location", 200), customerContact: contact, notes: z.string().trim().max(2000).optional() })
export const bookingInput = base.refine((value) => value.eventDate >= utcToday(), { path: ["eventDate"], message: "Choose today or a future date." })
const record = base.extend({
  id, customerId: z.string(), vendorId: z.string(), status: z.enum(statuses), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
})
const list = z.object({ data: z.array(record), pagination: z.object({ totalPages: z.number().int().min(0).max(10000) }) })
const listing = z.object({ data: z.object({ title: z.string(), category: z.string(), vendorName: z.string().optional() }) })
const profile = z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.string() })
const errorBody = z.object({ issues: z.array(z.object({ path: z.string(), message: z.string() })).optional() })
export type Booking = z.infer<typeof record>
export type BookingInput = z.infer<typeof bookingInput>
export type BookingRole = "customer" | "vendor"
export type BookingAction = "cancel" | "accept" | "reject"
export type ServiceInfo = z.infer<typeof listing>["data"]

export class BookingApiError extends Error {
  constructor(public status: number, message: string, public issues: Record<string, string> = {}) { super(message) }
}

async function request(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(new URL(path, origin), {
    ...options, credentials: "omit", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
    signal: AbortSignal.any([AbortSignal.timeout(10000), ...(options.signal ? [options.signal] : [])]),
  })
  if (response.ok) return response.json()
  const parsed = errorBody.safeParse(await response.json().catch(() => null))
  const messages: Record<number, string> = {
    400: "Check the booking information and try again.",
    401: "Sign in again to continue.",
    403: "Your account cannot perform this action.",
    404: path === "/api/bookings" ? "This service is no longer available." : "This booking could not be found.",
    409: path === "/api/bookings" ? "You already have an active booking for this service and date." : "This booking is no longer eligible for that action.",
    429: "Too many requests. Please wait and try again.",
  }
  throw new BookingApiError(response.status, messages[response.status] ?? "The booking service is unavailable. Please try again.",
    Object.fromEntries(parsed.success ? (parsed.data.issues ?? []).map(({ path, message }) => [path, message]) : []))
}

export async function bookingAccess(role: BookingRole, signal?: AbortSignal) {
  const { data, error } = await authClient.token({ fetchOptions: { signal, timeout: 10000 } })
  if (!data?.token) throw new BookingApiError(error?.status ?? 401, error?.status === 403 ? "Your account cannot access bookings." : error?.status && error.status !== 401 ? "We couldn't verify your session." : "Sign in again to continue.")
  const current = profile.parse(await request("/api/me", data.token, { signal }))
  if (current.role !== role) throw new BookingApiError(403, `This action requires a ${role} account.`)
  return { profile: current, token: data.token }
}

export async function listBookings(role: BookingRole, signal?: AbortSignal) {
  const { token } = await bookingAccess(role, signal)
  const data = new Map<string, Booking>()
  const path = role === "customer" ? "my" : "vendor"
  for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
    const result = list.parse(await request(`/api/bookings/${path}?page=${page}&limit=100`, token, { signal }))
    for (const booking of result.data) data.set(booking.id, booking)
    totalPages = result.pagination.totalPages
  }
  return [...data.values()]
}

export async function getBooking(role: BookingRole, bookingId: string, signal?: AbortSignal) {
  if (!id.safeParse(bookingId).success) throw new BookingApiError(404, "This booking could not be found.")
  const { token } = await bookingAccess(role, signal)
  return z.object({ data: record }).parse(await request(`/api/bookings/${bookingId}`, token, { signal })).data
}

export async function createBooking(input: BookingInput) {
  const { token } = await bookingAccess("customer")
  return z.object({ data: record }).parse(await request("/api/bookings", token, {
    method: "POST", body: JSON.stringify(bookingInput.parse(input)),
  })).data
}

export async function updateBooking(role: BookingRole, bookingId: string, action: BookingAction) {
  const { token } = await bookingAccess(role)
  return z.object({ data: record }).parse(await request(`/api/bookings/${id.parse(bookingId)}/${action}`, token, { method: "PATCH" })).data
}

export async function bookingService(serviceId: string, signal?: AbortSignal) {
  const response = await fetch(new URL(`/api/services/${id.parse(serviceId)}`, origin), {
    signal: AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])]), cache: "no-store", credentials: "omit",
  })
  if (!response.ok) return null
  return listing.parse(await response.json()).data
}

export function canCancel(booking: Booking) {
  return booking.status === "pending" && booking.eventDate >= utcToday()
}
