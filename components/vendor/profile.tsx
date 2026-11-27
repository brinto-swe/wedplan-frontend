"use client"

import { ProfileSettings } from "@/components/profile/settings"
import { useVendor } from "./workspace"

export function VendorProfileSettings() {
  const { profile, plan } = useVendor()
  return <ProfileSettings profile={profile} plan={plan} />
}
