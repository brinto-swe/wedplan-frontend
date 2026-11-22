"use client"

import Link from "next/link"
import { useQueries, useQuery } from "@tanstack/react-query"
import { BookingApiError, bookingService, listBookings, type Booking, type BookingRole, type ServiceInfo } from "@/lib/bookings"

export const bookingKey = (role: BookingRole, userId: string) => ["bookings", role, userId]
export const detailKey = (role: BookingRole, userId: string, id: string) => [...bookingKey(role, userId), id]

export function useBookings(role: BookingRole, userId: string) {
  return useQuery({ queryKey: bookingKey(role, userId), queryFn: ({ signal }) => listBookings(role, signal) })
}

export function useServiceInfo(items: Booking[]) {
  const ids = [...new Set(items.map((item) => item.serviceId))]
  const results = useQueries({ queries: ids.map((serviceId) => ({
    queryKey: ["booking-service", serviceId], queryFn: ({ signal }) => bookingService(serviceId, signal),
    retry: false, staleTime: 60_000,
  })) })
  return new Map(ids.map((id, index) => [id, results[index].isError ? null : results[index].data]))
}

export function BookingBadge({ status }: { status: Booking["status"] }) {
  return <span className="booking-badge" data-status={status}>{status}</span>
}

export function BookingError({ error, retry }: { error: unknown; retry?: () => void }) {
  const status = error instanceof BookingApiError ? error.status : 0
  return <div className="booking-feedback" role="alert">
    <p>{error instanceof BookingApiError ? error.message : "We couldn’t load booking information. Please try again."}</p>
    {status === 401 ? <Link href="/sign-in" className="wp-text-link">Sign in</Link>
      : retry && status !== 403 && <button type="button" className="wp-button wp-button-outline" onClick={retry}>Try again</button>}
  </div>
}

export const eventDay = (date: string) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date))

export function ServiceTitle({ booking, service }: { booking: Booking; service?: ServiceInfo | null }) {
  return <><strong>{service?.title ?? "Service listing unavailable"}</strong>
    <p>{service?.vendorName ?? `Vendor reference ${booking.vendorId}`}</p></>
}
