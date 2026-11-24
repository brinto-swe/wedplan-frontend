import { expect, test, type Page } from "@playwright/test"
import type { AdminTransaction } from "../lib/admin"

const path = "/admin/transactions"
const endpoint = "/api/admin/transactions"
const vendorId = "000000000000000000000001"
const fixtures: AdminTransaction[] = Array.from({ length: 9 }, (_, index) => ({
  id: "in_Fixture" + (index + 1),
  vendorId: index === 0 ? vendorId : "000000000000000000000002",
  vendor: index === 0 ? { id: vendorId, name: "Test Vendor", businessName: "Fixture Studio" } : null,
  amount: 1234, amountUnit: "minor", currency: index === 0 ? "jpy" : "usd",
  status: index === 0 ? "failed" : "paid", type: "subscription",
  createdAt: index === 0 ? "2025-01-05T23:59:00.000Z" : "2025-01-04T12:00:00.000Z",
  dateBasis: "stripe_invoice_event",
}))

async function setup(page: Page, options: { role?: string; failFirst?: boolean; empty?: boolean; denyLedger?: boolean } = {}) {
  const profile = { id: "admin-fixture", role: "admin", name: "Test Admin" }
  const lists: URLSearchParams[] = []
  let details = 0
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === "/api/auth/get-session") return route.fulfill({
      json: options.role === "anonymous" ? null : { user: profile, session: { id: "fixture" } },
    })
    if (url.pathname === "/api/auth/token") return route.fulfill({ json: { token: "fixture-token" } })
    expect(request.headers().authorization).toBe("Bearer fixture-token")
    if (url.pathname === "/api/me") return route.fulfill({
      status: options.role === "blocked" ? 403 : 200,
      json: { ...profile, role: options.role ?? "admin" },
    })
    expect(request.method()).toBe("GET")
    if (url.pathname === endpoint) {
      const params = url.searchParams
      lists.push(params)
      if (options.denyLedger) return route.fulfill({ status: 403, json: {} })
      if (options.failFirst && lists.length === 1) return route.fulfill({ status: 500, json: {} })
      const rows = (options.empty ? [] : fixtures).filter((row) =>
        row.id.startsWith(params.get("q") ?? "") &&
        (!params.has("status") || row.status === params.get("status")) &&
        (!params.has("vendorId") || row.vendorId === params.get("vendorId")) &&
        (!params.has("currency") || row.currency === params.get("currency")) &&
        (!params.has("from") || row.createdAt.slice(0, 10) >= params.get("from")!) &&
        (!params.has("to") || row.createdAt.slice(0, 10) <= params.get("to")!))
      const currentPage = Number(params.get("page"))
      const limit = Number(params.get("limit"))
      return route.fulfill({ json: { data: rows.slice((currentPage - 1) * limit, currentPage * limit),
        pagination: { page: currentPage, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) } } })
    }
    details++
    if (options.failFirst && details === 1) return route.fulfill({ status: 500, json: {} })
    const row = fixtures.find(({ id }) => url.pathname === endpoint + "/" + id)
    if (!row) return route.fulfill({ status: 404, json: {} })
    return route.fulfill({ json: { data: { ...row, invoiceCreatedAt: null, billingPeriod: null } } })
  })
  return { lists }
}

test("shows the read-only invoice ledger, exact currency scales, details and pagination", async ({ page }) => {
  await setup(page)
  await page.goto(path)
  await expect(page.getByRole("link", { name: "Transactions" })).toHaveAttribute("aria-current", "page")
  await expect(page.getByText(/JPY\s+1,234/)).toBeVisible()
  await expect(page.getByText(/USD\s+12\.34/)).toHaveCount(7)
  await expect(page.getByText("9 invoices · Page 1 of 2")).toBeVisible()
  await page.getByRole("button", { name: "View invoice in_Fixture1", exact: true }).click()
  const panel = page.getByRole("complementary", { name: "Transaction Details" })
  await expect(panel.getByText("stripe_invoice_event")).toBeVisible()
  await expect(panel.getByText("Fixture Studio")).toBeVisible()
  await expect(panel.getByText("Test Vendor")).toBeVisible()
  await expect(panel.getByText(/JPY\s+1,234/)).toBeVisible()
  await expect(panel.getByText("Unavailable")).toHaveCount(2)
  await expect(page.getByText(/Individual card payment attempts/)).toBeVisible()
  await expect(page.getByRole("button", { name: /refund|edit|delete|mark as paid/i })).toHaveCount(0)
  await panel.getByRole("button", { name: "Close transaction details" }).click()
  await expect(page.getByRole("button", { name: "View invoice in_Fixture1", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "Next" }).click()
  await expect(page.getByText("9 invoices · Page 2 of 2")).toBeVisible()
  await expect(page.getByRole("rowheader", { name: "in_Fixture9" })).toBeVisible()
})

test("applies combined server filters and resets to page one", async ({ page }) => {
  const { lists } = await setup(page)
  await page.goto(path)
  await page.getByRole("button", { name: "Next" }).click()
  await expect(page.getByText("9 invoices · Page 2 of 2")).toBeVisible()
  await page.getByLabel("Invoice ID search").fill("in_Fixture1")
  await page.getByLabel("Payment status").selectOption("failed")
  await page.getByLabel("Vendor ID").fill(vendorId)
  await page.getByLabel("Currency").fill("JPY")
  await page.getByLabel("From (UTC)").fill("2025-01-05")
  await page.getByLabel("To (UTC)").fill("2025-01-04")
  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(page.getByRole("main").getByRole("alert")).toContainText("End date")
  expect(lists).toHaveLength(2)
  await page.getByLabel("To (UTC)").fill("2025-01-05")
  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(page.getByText("1 invoice · Page 1 of 1")).toBeVisible()
  expect(Object.fromEntries(lists.at(-1)!)).toEqual({
    page: "1", limit: "8", q: "in_Fixture1", status: "failed", vendorId, currency: "jpy", from: "2025-01-05", to: "2025-01-05",
  })
  await page.getByLabel("Invoice ID search").fill("in_Unknown")
  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(page.getByText("No matching transactions")).toBeVisible()
  await page.getByRole("button", { name: "Clear filters" }).click()
  await expect(page.getByLabel("Currency")).toHaveValue("")
  await expect(page.getByText("9 invoices · Page 1 of 2")).toBeVisible()
})

test("retries list and detail failures", async ({ page }) => {
  await setup(page, { failFirst: true })
  await page.goto(path)
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Unable to load transactions")
  await page.getByRole("button", { name: "Try again" }).click()
  await page.getByRole("button", { name: "View invoice in_Fixture1", exact: true }).click()
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Unable to load transaction details")
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByText("stripe_invoice_event")).toBeVisible()
})

test("shows an empty ledger", async ({ page }) => {
  await setup(page, { empty: true })
  await page.goto(path)
  await expect(page.getByText("No transactions yet")).toBeVisible()
})

test("keeps the populated ledger and open detail within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.goto(path)
  const table = page.getByRole("region", { name: "Scrollable transactions table" })
  await expect(table).toBeVisible()
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  await page.getByRole("button", { name: "View invoice in_Fixture1", exact: true }).click()
  await expect(page.getByText("stripe_invoice_event")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test("withholds the ledger when its API denies an Admin token", async ({ page }) => {
  await setup(page, { denyLedger: true })
  await page.goto(path)
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Admin access required")
  await expect(page.getByRole("table")).toHaveCount(0)
})

for (const role of ["customer", "vendor", "blocked", "anonymous"]) {
  test(`denies ledger access to ${role}`, async ({ page }) => {
    const { lists } = await setup(page, { role })
    await page.goto(path)
    if (role === "anonymous") await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Ftransactions/)
    else await expect(page.getByRole("main").getByRole("alert")).toContainText("Admin access required")
    expect(lists).toHaveLength(0)
  })
}
