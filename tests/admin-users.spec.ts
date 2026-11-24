import { expect, test, type Page } from "@playwright/test"
import type { AdminUser } from "../lib/admin"

const viewer = "000000000000000000000001"
const vendor = "000000000000000000000002"
const timestamp = "2025-01-05T12:00:00.000Z"
function user(id: string, name: string, role: AdminUser["role"]): AdminUser {
  return { id, name, role, email: name.toLowerCase().replaceAll(" ", ".") + "@example.test",
    status: "active", emailVerified: true, createdAt: timestamp, updatedAt: timestamp }
}
const setup = async (page: Page, options: { role?: string; updateStatus?: number; listStatus?: number; empty?: boolean } = {}) => {
  const profile = user(viewer, "Test Admin", "admin")
  const accounts = options.empty ? [] : [profile, user(vendor, "Test Vendor", "vendor"), ...Array.from({ length: 7 }, (_, index) =>
    user((index + 3).toString(16).padStart(24, "0"), "Customer " + (index + 1), "customer"))]
  let mutations = 0
  let lists = 0
  let details = 0
  await page.route("**/api/**", async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    if (path === "/api/auth/get-session") return route.fulfill({ json: options.role === "anonymous" ? null : { user: profile, session: { id: "fixture" } } })
    if (path === "/api/auth/token") return route.fulfill({ json: { token: "fixture-token" } })
    expect(req.headers().authorization).toBe("Bearer fixture-token")
    if (path === "/api/me") return route.fulfill({ json: { ...profile, role: options.role ?? "admin" } })
    if (path === "/api/admin/overview") return route.fulfill({ status: 404, json: {} })
    if (path === "/api/admin/users") {
      lists++
      if (options.listStatus) return route.fulfill({ status: options.listStatus, json: {} })
      const query = url.searchParams
      const search = query.get("q")?.toLowerCase()
      const results = accounts.filter((account) =>
        (!search || [account.name, account.email].some((value) => value.toLowerCase().includes(search))) &&
        (!query.has("role") || account.role === query.get("role")) && (!query.has("status") || account.status === query.get("status")))
      const currentPage = Number(query.get("page"))
      const limit = Number(query.get("limit"))
      return route.fulfill({ json: { data: results.slice((currentPage - 1) * limit, currentPage * limit),
        pagination: { page: currentPage, limit, total: results.length, totalPages: Math.ceil(results.length / limit) } } })
    }
    const account = accounts.find(({ id }) => path.startsWith("/api/admin/users/" + id))
    if (!account) return route.fulfill({ status: 404, json: {} })
    if (req.method() === "PATCH") {
      mutations++
      expect(path).toBe("/api/admin/users/" + vendor + "/status")
      expect(req.postDataJSON()).toEqual({ status: account.status === "active" ? "blocked" : "active" })
      if (options.updateStatus) return route.fulfill({ status: options.updateStatus, json: {} })
      account.status = req.postDataJSON().status
    } else details++
    return route.fulfill({ json: { data: { ...account, seedMarker: "hidden-fixture" } } })
  })
  return { mutations: () => mutations, lists: () => lists, details: () => details }
}

const route = "/admin/users"

test("lists paginated users, filters using the server, and retrieves details", async ({ page }) => {
  const calls = await setup(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(route)
  await expect(page.getByRole("heading", { name: "Users Management" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Block Test Admin" })).toBeDisabled()
  await page.getByRole("button", { name: "Next" }).click()
  await expect(page.getByRole("row").filter({ hasText: "Customer 7" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "User pagination" })).toContainText("9 users · Page 2 of 2")
  await page.getByLabel("Role", { exact: true }).selectOption("vendor")
  await expect(page.getByRole("row").filter({ hasText: "Test Vendor" })).toBeVisible()
  await page.getByLabel("Account status", { exact: true }).selectOption("blocked")
  await expect(page.getByText("No matching users")).toBeVisible()
  await page.getByRole("button", { name: "Clear filters" }).click()
  await page.getByRole("searchbox", { name: "Search by name or email" }).fill("test.vendor@example.test")
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await expect(page.getByRole("row")).toHaveCount(2)
  await page.getByRole("button", { name: "View Test Vendor" }).click()
  const details = page.getByRole("complementary", { name: "User Details" })
  await expect(details).toContainText("test.vendor@example.test")
  await expect(details).toContainText("Email verified")
  await expect(details).not.toContainText("hidden-fixture")
  expect(calls.details()).toBe(1)
});

test("confirms block and unblock, then refreshes the current listing", async ({ page }) => {
  const calls = await setup(page)
  await page.goto(route)
  const row = page.getByRole("row").filter({ hasText: "Test Vendor" })
  await row.getByRole("button", { name: "Block Test Vendor" }).click()
  const confirmation = page.getByRole("dialog")
  await expect(confirmation).toHaveAccessibleName("Block Test Vendor?")
  expect(calls.mutations()).toBe(0)
  await confirmation.getByRole("button", { name: "Cancel" }).click()
  await expect(confirmation).toBeHidden()
  expect(calls.mutations()).toBe(0)
  await row.getByRole("button", { name: "Block Test Vendor" }).click()
  await confirmation.getByRole("button", { name: "Confirm block" }).click()
  await expect(row.getByText("Blocked", { exact: true })).toBeVisible()
  await expect(confirmation).toBeHidden()
  await row.getByRole("button", { name: "Unblock Test Vendor" }).click()
  await confirmation.getByRole("button", { name: "Confirm unblock" }).click()
  await expect(row.getByText("Active", { exact: true })).toBeVisible()
  expect(calls.mutations()).toBe(2)
  expect(calls.lists()).toBeGreaterThanOrEqual(3)
});

test("shows listing and mutation errors without showing a successful status change", async ({ page }) => {
  const options = { listStatus: 503, updateStatus: 403 }
  await setup(page, options)
  await page.goto(route)
  await expect(page.getByRole("heading", { name: "Unable to load users" })).toBeVisible()
  options.listStatus = 0
  await page.getByRole("button", { name: "Try again" }).click()
  const row = page.getByRole("row").filter({ hasText: "Test Vendor" })
  await row.getByRole("button", { name: "Block Test Vendor" }).click()
  const confirmation = page.getByRole("dialog")
  await confirmation.getByRole("button", { name: "Confirm block" }).click()
  await expect(confirmation.getByRole("alert")).toHaveText("The server denied this status change.")
  await confirmation.getByRole("button", { name: "Cancel" }).click()
  await expect(row.getByText("Active", { exact: true })).toBeVisible()
});

test("users page fits mobile and displays a genuine empty list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark" })
  await setup(page, { empty: true })
  await page.goto(route)
  await expect(page.getByRole("heading", { name: "No users yet" })).toBeVisible()
  await page.getByLabel("Color theme").selectOption("dark")
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)
  expect(await page.locator("html").evaluate((node) => node.scrollWidth <= window.innerWidth)).toBe(true)
});

for (const role of ["customer", "vendor", "anonymous"]) {
  test(`denies users management to ${role}`, async ({ page }) => {
    const calls = await setup(page, { role })
    await page.goto(route)
    if (role === "anonymous") await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fusers$/)
    else await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible()
    expect(calls.lists()).toBe(0)
  })
}
