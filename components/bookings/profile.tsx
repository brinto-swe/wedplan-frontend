"use client"

import { ProfileSettings } from "@/components/profile/settings"
import { useCustomerProfile } from "./workspace"

export function CustomerProfile() {
  return <ProfileSettings profile={useCustomerProfile()} />
}
