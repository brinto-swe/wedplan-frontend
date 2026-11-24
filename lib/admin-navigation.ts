export const adminDashboardPath = "/admin/dashboard"
export const adminUsersPath = "/admin/users"

export function adminReturn(value: unknown) {
  return value === adminDashboardPath || value === adminUsersPath ? value : undefined
}
