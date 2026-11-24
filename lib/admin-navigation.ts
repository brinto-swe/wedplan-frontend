export const adminDashboardPath = "/admin/dashboard"

export function adminReturn(value: unknown) {
  return value === adminDashboardPath ? adminDashboardPath : undefined
}
