import { adminDashboardPath, adminReturn } from "@/lib/admin-navigation"
import { billingReturn } from "@/lib/billing-navigation"

export function serviceReturn(value: unknown) {
  return typeof value === "string" && value === value.trim() &&
    /^\/services\/(?:[0-9a-fA-F]{24}|demo-(?:villa|photography|florals|catering))(?:\?book=1)?$/.test(value)
    ? value : undefined
}

export function customerReturn(value: unknown) {
  return typeof value === "string" && value === value.trim() &&
    /^\/customer\/(?:dashboard|profile|bookings(?:\/[0-9a-fA-F]{24})?)$/.test(value) ? value : undefined
}

export function vendorReturn(value: unknown) {
  return billingReturn(value) ?? (typeof value === "string" && value === value.trim() &&
    /^\/vendor\/(?:dashboard|profile|bookings|services(?:\/new|\/[0-9a-fA-F]{24}\/edit)?)$/.test(value) ? value : undefined)
}

export function safeReturn(value: unknown) {
  return serviceReturn(value) ?? customerReturn(value) ?? vendorReturn(value) ?? adminReturn(value)
}

export function signInFor(destination?: string) {
  const next = safeReturn(destination)
  return next ? "/sign-in?next=" + encodeURIComponent(next) : "/sign-in"
}

export function postLoginPath(role: unknown, destination?: string) {
  const service = serviceReturn(destination)
  switch (role) {
    case "admin": return service ?? adminReturn(destination) ?? adminDashboardPath
    case "vendor": return service ?? vendorReturn(destination) ?? "/vendor/dashboard"
    case "customer": return service ?? customerReturn(destination) ?? "/customer/dashboard"
  }
}
