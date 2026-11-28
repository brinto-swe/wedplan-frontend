import { expect, test, type Page } from "@playwright/test"
import type { AdminServiceRow } from "../lib/admin"

const vendorId = "000000000000000000000001"
const timestamp = "2025-01-05T12:00:00.000Z"
const path = "/admin/services"
type Options = { role?: string; listStatus?: number; activationStatus?: number; moderation?: boolean; moderationStatus?: number }

async function setup(page: Page, options: Options = {}) {
  const profile = { id: "admin-fixture", role: "admin", name: "Test Admin" }
  const fixtures: AdminServiceRow[] = Array.from({ length: 9 }, (_, index) => ({
    id: (index + 2).toString(16).padStart(24, "0"), title: "Service " + (index + 1),
    vendorId: index === 0 ? vendorId : "000000000000000000000010",
    category: index === 0 ? "Photography" : "Venue", description: index === 0 ? "Reception portraits" : "Wedding space",
    vendorAvailable: index !== 0, moderationStatus: options.moderation && index < 2 ? "pending" : "approved",
    isActive: index !== 0 && !(options.moderation && index < 2), price: 100.5, location: "Dhaka", createdAt: timestamp, updatedAt: timestamp,
    vendor: index === 0 ? { id: vendorId, name: "Test Vendor", businessName: "Fixture Studio" } : null,
  }))
  let writes = 0
  let lists = 0
  let details = 0
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === "/api/auth/get-session") return route.fulfill({ json: options.role === "anonymous" ? null : { user: profile, session: { id: "fixture" } } })
    if (url.pathname === "/api/auth/token") return route.fulfill({ json: { token: "fixture-token" } })
    expect(request.headers().authorization).toBe("Bearer fixture-token")
    if (url.pathname === "/api/me") return route.fulfill({ status: options.role === "blocked" ? 403 : 200,
      json: { ...profile, role: options.role ?? "admin" } })
    if (url.pathname === "/api/admin/overview") return route.fulfill({ status: 404, json: {} })
    if (url.pathname === "/api/admin/services") {
      lists++
      if (options.listStatus) return route.fulfill({ status: options.listStatus, json: {} })
      const params = url.searchParams
      const q = params.get("q")?.toLowerCase()
      const records = fixtures.filter((row) =>
        (!q || (row.title + " " + row.description).toLowerCase().includes(q)) &&
        (!params.has("vendorId") || row.vendorId === params.get("vendorId")) &&
        (!params.has("category") || row.category === params.get("category")) &&
        (!params.has("moderationStatus") || row.moderationStatus === params.get("moderationStatus")) &&
        (!params.has("visibility") || row.isActive === (params.get("visibility") === "active")))
      const currentPage = Number(params.get("page"))
      const limit = Number(params.get("limit"))
      return route.fulfill({ json: { data: records.slice((currentPage - 1) * limit, currentPage * limit),
        pagination: { page: currentPage, limit, total: records.length, totalPages: Math.ceil(records.length / limit) } } })
    }
    const index = fixtures.findIndex((row) => ["/api/admin/services/" + row.id, "/api/admin/services/" + row.id + "/moderation"].includes(url.pathname))
    if (url.pathname.endsWith("/moderation") && index >= 0 && request.method() === "PATCH") {
      writes++
      const body = request.postDataJSON()
      expect(Object.keys(body)).toEqual(["status"])
      if (options.moderationStatus) return route.fulfill({ status: options.moderationStatus, json: {} })
      const row = fixtures[index]
      row.moderationStatus = body.status
      row.isActive = body.status === "approved" && row.vendorAvailable
      return route.fulfill({ json: { data: row } })
    }
    if (index < 0) return route.fulfill({ status: 404, json: {} })
    if (request.method() === "DELETE") {
      writes++
      fixtures.splice(index, 1)
      return route.fulfill({ status: 204 })
    }
    if (request.method() === "PATCH") {
      writes++
      const patch = request.postDataJSON()
      expect(Object.keys(patch).sort()).toEqual("isActive" in patch ? ["isActive"] : ["category", "description", "location", "price", "title"])
      if (patch.isActive === true && options.activationStatus) return route.fulfill({ status: options.activationStatus, json: {} })
      Object.assign(fixtures[index], patch)
      if (typeof patch.isActive === "boolean") fixtures[index].vendorAvailable = patch.isActive
    } else details++
    return route.fulfill({ json: { data: fixtures[index] } })
  })
  return { writes: () => writes, lists: () => lists, details: () => details }
}

test("uses server-side search, category, vendor, visibility and pagination with a details panel", async ({ page }) => {
  const calls = await setup(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(path)
  await expect(page.getByRole("heading", { name: "Manage Services" })).toBeVisible()
  await page.getByRole("button", { name: "Next" }).click()
  await expect(page.getByRole("navigation", { name: "Service pagination" })).toContainText("9 services · Page 2 of 2")
  await expect(page.getByRole("row").filter({ hasText: "Service 9" })).toBeVisible()
  await page.getByRole("searchbox", { name: "Search title or description" }).fill("portraits")
  await page.getByLabel("Category", { exact: true }).fill("Photography")
  await page.getByLabel("Vendor ID").fill(vendorId)
  const filtered = page.waitForRequest((request) => {
    const params = new URL(request.url()).searchParams
    return params.get("q") === "portraits" && params.get("category") === "Photography" && params.get("vendorId") === vendorId
  })
  await page.getByRole("button", { name: "Apply filters" }).click()
  await filtered
  await page.getByRole("button", { name: "Active", exact: true }).click()
  await expect(page.getByRole("heading", { name: "No matching services" })).toBeVisible()
  await page.getByRole("button", { name: "Inactive", exact: true }).click()
  await page.getByRole("button", { name: "View Service 1" }).click()
  const details = page.getByRole("complementary", { name: "Service Details" })
  await expect(details).toContainText("Reception portraits")
  await expect(details).toContainText("Fixture Studio · Test Vendor")
  expect(calls.details()).toBe(1)
})

test("edits, activates, deactivates and deletes after confirmation", async ({ page }) => {
  const calls = await setup(page)
  await page.goto(path)
  const original = page.getByRole("row").filter({ hasText: "Service 1" })
  await original.getByRole("button", { name: "Edit Service 1" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Service title").fill("Updated portraits")
  await dialog.getByRole("button", { name: "Save changes" }).click()
  await expect(dialog).toBeHidden()
  const row = page.getByRole("row").filter({ hasText: "Updated portraits" })
  await row.getByRole("button", { name: "Enable availability for Updated portraits" }).click()
  await dialog.getByRole("button", { name: "Enable availability" }).click()
  await expect(row.getByText("Active", { exact: true })).toBeVisible()
  await row.getByRole("button", { name: "Pause availability for Updated portraits" }).click()
  await dialog.getByRole("button", { name: "Pause availability" }).click()
  await expect(row.getByText("Inactive", { exact: true })).toBeVisible()
  await row.getByRole("button", { name: "Delete Updated portraits" }).click()
  await expect(dialog.getByText(/Permanently delete/)).toBeVisible()
  expect(calls.writes()).toBe(3)
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "Delete Updated portraits" }).click()
  await dialog.getByRole("button", { name: "Delete service" }).click()
  await expect(row).toHaveCount(0)
  expect(calls.writes()).toBe(4)
})

test("retries listing errors and explains the server availability conflict", async ({ page }) => {
  const options: Options = { listStatus: 503, activationStatus: 409 }
  await setup(page, options)
  await page.goto(path)
  await expect(page.getByRole("heading", { name: "Unable to load services" })).toBeVisible()
  options.listStatus = 0
  await page.getByRole("button", { name: "Try again" }).click()
  const row = page.getByRole("row").filter({ hasText: "Service 1" })
  await row.getByRole("button", { name: "Enable availability for Service 1" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Enable availability" }).click()
  await expect(dialog.getByRole("alert")).toContainText("Availability can only change after approval")
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(row.getByText("Inactive", { exact: true })).toBeVisible()
})

test("keeps populated services view within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.goto(path)
  const table = page.getByRole("region", { name: "Scrollable services table" })
  await expect(table).toBeVisible()
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

for (const role of ["customer", "vendor", "blocked", "anonymous"]) {
  test(`rejects the ${role} actor before requesting service records`, async ({ page }) => {
    const calls = await setup(page, { role })
    await page.goto(path)
    if (role === "anonymous") await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fservices$/)
    else await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible()
    expect(calls.lists()).toBe(0)
  })
}

test("opens the Pending filter and confirms approval and rejection before sending decisions", async ({ page }) => {
  const options: Options = { moderation: true }
  const calls = await setup(page, options)
  await page.goto(path + "?moderationStatus=pending")
  const filters = page.getByRole("group", { name: "Moderation filters" })
  await expect(filters.getByRole("button", { name: "Pending" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("row").filter({ hasText: "Service 3" })).toHaveCount(0)
  const dialog = page.getByRole("dialog")
  await page.getByRole("button", { name: "Approve Service 1" }).click()
  await expect(dialog).toBeVisible()
  expect(calls.writes()).toBe(0)
  await dialog.getByRole("button", { name: "Approve service" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Service approved.", { exact: true })).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: "Service 1" })).toHaveCount(0)

  options.moderationStatus = 409
  await page.getByRole("button", { name: "Reject Service 2" }).click()
  await dialog.getByRole("button", { name: "Reject service" }).click()
  await expect(dialog.getByRole("alert")).toContainText("no longer pending")
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("row").filter({ hasText: "Service 2" })).toContainText("Pending")
  options.moderationStatus = 0
  await page.getByRole("button", { name: "Reject Service 2" }).click()
  await dialog.getByRole("button", { name: "Reject service" }).click()
  await expect(page.getByText("Service rejected.", { exact: true })).toBeVisible()
  await filters.getByRole("button", { name: "Rejected" }).click()
  await expect(page.getByRole("row").filter({ hasText: "Service 2" })).toContainText("Inactive")
  await expect(page.getByRole("button", { name: "Enable availability for Service 2" })).toHaveCount(0)
})
