"use client"

import { authClient } from "@/lib/auth"
import { useVendor } from "@/components/vendor/workspace"
import { BookingList } from "./list"
import { BookingDetails } from "./details"

export function CustomerBookings() {
  const user = authClient.useSession().data?.user
  return user && <BookingList role="customer" userId={user.id} />
}
export function CustomerBooking({ id }: { id: string }) {
  const user = authClient.useSession().data?.user
  return user && <><h1 className="sr-only">Booking Details</h1><BookingDetails role="customer" userId={user.id} id={id} /></>
}
export function VendorBookings() {
  return <BookingList role="vendor" userId={useVendor().profile.id} />
}
