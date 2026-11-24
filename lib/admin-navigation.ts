export const adminDashboardPath = "/admin/dashboard"
export const adminUsersPath = "/admin/users"
export const adminServicesPath = "/admin/services"
export const adminTransactionsPath = "/admin/transactions"

export function adminReturn(value: unknown) {
  return value === adminDashboardPath || value === adminUsersPath || value === adminServicesPath || value === adminTransactionsPath ? value : undefined
}
