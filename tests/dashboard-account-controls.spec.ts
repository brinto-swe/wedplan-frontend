import { expect, test, type Page } from "@playwright/test"

const adminOverview = { data: {
  users: { total: 0, customers: 0, vendors: 0, admins: 0, active: 0, blocked: 0 },
  services: { total: 0, active: 0, inactive: 0, pending: 0 },
  bookings: { total: 0, pending: 0, accepted: 0, rejected: 0, cancelled: 0 },
  subscriptions: { premium: 0, free: 0, cancellationScheduled: 0 },
  revenue: { amountUnit: "minor", dateBasis: "stripe_invoice_event", paidInvoiceCount: 0, failedInvoiceCount: 0, paidByCurrency: [] },
} }

async function mockWorkspace(page: Page, role: string, failFirst = false) {
  const user = { id: "fixture-user", role, name: "Account Fixture", email: "fixture@example.test" }
  const session = { user, session: { id: "fixture-session", userId: user.id } }
  const empty = { data: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 0 } }
  let signedOut = false
  let signOutRequests = 0
  const { promise, resolve } = Promise.withResolvers<void>()
  await page.route("**/api/**", async (route) => {
    switch (new URL(route.request().url()).pathname) {
      case "/api/auth/get-session": return route.fulfill({ json: signedOut ? null : session })
      case "/api/auth/token": return route.fulfill({ status: signedOut ? 401 : 200, json: signedOut ? {} : { token: "fixture-token" } })
      case "/api/auth/sign-out":
        expect(route.request().method()).toBe("POST")
        signOutRequests++
        await promise
        if (failFirst && signOutRequests === 1) return route.fulfill({ status: 500, json: {} })
        signedOut = true
        return route.fulfill({ json: { success: true } })
      case "/api/me": return route.fulfill({ json: user })
      case "/api/admin/overview": return route.fulfill({ json: adminOverview })
      case "/api/bookings/my":
      case "/api/bookings/vendor":
      case "/api/admin/users":
      case "/api/services/manage": return route.fulfill({ json: empty })
      default: return route.fulfill({ status: 404, json: {} })
    }
  })
  return { finishSignOut: resolve, signOutRequests: () => signOutRequests }
}

for (const role of ["admin", "vendor", "customer"]) {
  const path = `/${role}/dashboard`

  test(`${role} signs out only after the session endpoint succeeds`, async ({ page }) => {
    const { finishSignOut, signOutRequests } = await mockWorkspace(page, role)
    await page.goto(path)
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible()
    await page.getByRole("button", { name: "Sign out", exact: true }).click()
    try {
      await expect(page.getByRole("button", { name: "Signing out…" })).toBeDisabled()
      await expect(page).toHaveURL(new RegExp(path + "$"))
      await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible()
      await expect.poll(signOutRequests).toBe(1)
    } finally {
      finishSignOut()
    }
    await expect(page).toHaveURL(/\/sign-in$/)
    await page.goto(path)
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0)
    await expect(page).toHaveURL(/\/sign-in\?next=/)
  })

  test(`${role} theme switch respects System and persists an explicit preference`, async ({ page }) => {
    await mockWorkspace(page, role)
    await page.emulateMedia({ colorScheme: "dark" })
    await page.addInitScript(() => {
      if (!localStorage.getItem("theme")) localStorage.setItem("theme", "system")
    })
    await page.goto(path)
    const toggle = page.getByRole("switch", { name: "Dark mode" })
    await expect(toggle).toBeChecked()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
    await page.emulateMedia({ colorScheme: "light" })
    await expect(toggle).not.toBeChecked()
    await expect(page.locator("html")).toHaveClass(/\blight\b/)
    await toggle.focus()
    await toggle.press("Space")
    await expect(toggle).toBeChecked()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
    await page.reload()
    await expect(toggle).toBeChecked()
    const section = { admin: "Users", vendor: "My Services", customer: "My Bookings" }[role]!
    await page.getByRole("navigation", { name: new RegExp(`^${role} navigation$`, "i") })
      .getByRole("link", { name: section, exact: true }).click()
    await expect(toggle).toBeChecked()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
  })
}

test("failed sign-out shows a toast and leaves the session available for retry", async ({ page }) => {
  const { finishSignOut, signOutRequests } = await mockWorkspace(page, "admin", true)
  finishSignOut()
  await page.goto("/admin/dashboard")
  const button = page.getByRole("button", { name: "Sign out", exact: true })
  await button.click()
  await expect(page.getByText("Unable to sign out. Please try again.")).toBeVisible()
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible()
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page).toHaveURL(/\/sign-in$/)
  expect(signOutRequests()).toBe(2)
})
