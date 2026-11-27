import { expect, test, type Page } from "@playwright/test"
import type { AdminOverview } from "../lib/admin"

const path = "/admin/dashboard"
const live: AdminOverview = {
  users: { total: 20, customers: 13, vendors: 6, admins: 1, active: 18, blocked: 2 },
  services: { total: 9, active: 7, inactive: 2 },
  bookings: { total: 8, accepted: 3, pending: 2, rejected: 2, cancelled: 1 },
  subscriptions: { premium: 2, free: 4, cancellationScheduled: 1 },
  revenue: { amountUnit: "minor", dateBasis: "stripe_invoice_event", paidInvoiceCount: 4, failedInvoiceCount: 2, paidByCurrency: [
    { amount: 2500, currency: "usd" }, { amount: 1200, currency: "jpy" },
    { amount: 2500, currency: "isk" }, { amount: 1000, currency: "kwd" },
  ] },
}
const empty: AdminOverview = {
  users: { total: 0, customers: 0, vendors: 0, admins: 0, active: 0, blocked: 0 },
  services: { total: 0, active: 0, inactive: 0 },
  bookings: { total: 0, accepted: 0, pending: 0, rejected: 0, cancelled: 0 },
  subscriptions: { premium: 0, free: 0, cancellationScheduled: 0 },
  revenue: { ...live.revenue, paidInvoiceCount: 0, failedInvoiceCount: 0, paidByCurrency: [] },
}
type Fixture = {
  role?: "admin" | "vendor" | "customer" | "anonymous"
  blocked?: boolean
  overview?: AdminOverview
  wait?: Promise<void>
  overviewStatus?: number
}

async function mockAdmin(page: Page, fixture: Fixture = {}) {
  const role = fixture.role ?? "admin"
  const user = { id: "fixture-admin", role, name: "Admin", email: "fixture@example.test" }
  let overviewRequests = 0
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname === "/api/auth/get-session")
      return route.fulfill({ json: role === "anonymous" ? null : { user, session: { id: "session", userId: user.id } } })
    if (pathname === "/api/auth/token") return route.fulfill({ json: { token: "fixture-token" } })
    if (pathname === "/api/me" || pathname === "/api/admin/overview") {
      expect(request.headers().authorization).toBe("Bearer fixture-token")
      if (pathname === "/api/me") return route.fulfill({ status: fixture.blocked ? 403 : 200, json: fixture.blocked ? {} : user })
      overviewRequests++
      await fixture.wait
      return route.fulfill({ status: fixture.overviewStatus ?? 200, json: { data: fixture.overview ?? live } })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  return () => overviewRequests
}

test.use({ locale: "en-US" })

test("shows the approved dashboard hierarchy and real overview statistics at desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const calls = await mockAdmin(page)
  await page.goto(path)
  await expect(page.getByRole("heading", { name: "Welcome back, Admin!" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Admin navigation", exact: true })).toBeVisible()
  await expect(page.getByRole("region", { name: "Workspace statistics" })).toContainText("20")
  const users = page.getByRole("region", { name: "Users Overview" })
  for (const label of ["Customers", "Vendors", "Admins", "Active users", "Blocked users"]) {
    await expect(users.getByText(label, { exact: true })).toBeVisible()
  }
  const platform = page.getByRole("region", { name: "Platform Overview" })
  for (const label of ["Active services", "Inactive services", "Free Vendors", "Premium Vendors", "Scheduled cancellations"]) {
    await expect(platform.getByText(label, { exact: true })).toBeVisible()
  }
  const booking = page.getByRole("region", { name: "Bookings by Status", exact: true })
  await expect(booking).toContainText("37.5%")
  for (const label of ["Accepted", "Pending", "Rejected", "Cancelled"]) await expect(booking.getByText(label, { exact: true })).toBeVisible()
  const revenue = page.getByRole("region", { name: "All-Time Revenue" })
  await expect(revenue.getByText("Paid invoices")).toBeVisible()
  await expect(revenue.getByText("Failed invoices")).toBeVisible()
  for (const amount of [/USD\s+25\.00/, /JPY\s+1,200/, /ISK\s+25/, /KWD\s+1\.000/]) {
    await expect(revenue.getByText(amount)).toBeVisible()
  }
  expect(calls()).toBeGreaterThan(0)
});

test("renders overview skeletons then displays zero values and empty charts and revenue", async ({ page }) => {
  let release!: () => void
  const wait = new Promise<void>((resolve) => { release = resolve })
  await mockAdmin(page, { overview: empty, wait })
  await page.goto(path)
  await expect(page.getByText("Loading dashboard overview…")).toBeVisible()
  release()
  await expect(page.getByText("No platform activity to report yet.")).toBeVisible()
  await expect(page.getByText("No bookings to visualize yet.")).toBeVisible()
  await expect(page.getByText("No paid revenue has been recorded yet.")).toBeVisible()
  await expect(page.getByRole("region", { name: "Workspace statistics" }).getByText("0", { exact: true })).toHaveCount(5)
});

test("retries rejected data requests and does not show counts until loaded", async ({ page }) => {
  const fixture: Fixture = { overviewStatus: 503 }
  await mockAdmin(page, fixture)
  await page.goto(path)
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Unable to load the dashboard")
  await expect(page.getByText("Total Users")).toHaveCount(0)
  fixture.overviewStatus = 200
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByText("Total Users")).toBeVisible()
});

test("returns anonymous users to sign-in with the Admin route allowlisted", async ({ page }) => {
  const calls = await mockAdmin(page, { role: "anonymous" })
  await page.goto(path)
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fdashboard$/)
  expect(calls()).toBe(0)
});

for (const fixture of [{ role: "vendor" }, { role: "customer" }, { role: "admin", blocked: true }] as const) {
  test(`blocks ${fixture.role} without showing dashboard data`, async ({ page }) => {
    const calls = await mockAdmin(page, fixture)
    await page.goto(path)
    await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible()
    await expect(page.getByText("Total Users")).toHaveCount(0)
    expect(calls()).toBe(0)
  });
}

test("withholds metrics if the overview independently rejects the Admin token", async ({ page }) => {
  await mockAdmin(page, { overviewStatus: 403 })
  await page.goto(path)
  await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible()
  await expect(page.getByText("Total Users")).toHaveCount(0)
});

test("keeps mobile dashboard readable in light and dark themes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark" })
  await mockAdmin(page)
  await page.goto(path)
  await expect(page.getByRole("heading", { name: "Welcome back, Admin!" })).toBeVisible()
  await expect(page.getByRole("region", { name: "All-Time Revenue" })).toBeVisible()
  await page.getByText("Workspace", { exact: true }).click()
  await expect(page.getByRole("navigation", { name: "Mobile Admin navigation" })).toBeVisible()
  const theme = page.getByRole("switch", { name: "Dark mode" })
  for (const appearance of ["dark", "light"]) {
    await theme.click()
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${appearance}\\b`))
  }
  expect(await page.locator("html").evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true)
});
