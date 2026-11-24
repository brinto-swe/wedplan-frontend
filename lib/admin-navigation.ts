export const adminDashboardPath = "/admin/dashboard"
export const adminUsersPath = "/admin/users"
export const adminServicesPath = "/admin/services"

export function adminReturn(value: unknown) {
  return value === adminDashboardPath || value === adminUsersPath || value === adminServicesPath ? value : undefined
}
