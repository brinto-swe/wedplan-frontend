import { expect, test, type Page } from "@playwright/test"
import type { Subscription } from "../lib/billing"

const subscriptionPath = "/vendor/subscription"
const vendorToken = "mock-vendor-bearer-token"
const stripeURL = "https://checkout.stripe.com/c/pay/mock-session"
const expiry = "2030-12-20T12:00:00.000Z"
const free: Subscription = { plan: "free", status: "none", expiresAt: null, renewsAt: null, cancelAtPeriodEnd: false, cancelAt: null }
const premium: Subscription = { ...free, plan: "premium", status: "active", expiresAt: expiry, renewsAt: expiry }
const history = (page: number) => ({
  data: [{ id: "invoice-" + page, amount: page === 1 ? 3500 : 1200, currency: "usd", status: page === 1 ? "paid" : "failed", type: "subscription", createdAt: expiry }],
  pagination: { page, totalPages: 2 },
})

type Fixture = {
  role?: "vendor" | "customer" | "admin" | "anonymous"
  current?: Subscription
  subscriptionWait?: Promise<void>
  history?: ReturnType<typeof history> | { data: []; pagination: { page: number; totalPages: number } }
  checkoutStatus?: number
  checkoutURL?: string
  cancelStatus?: number
  checkoutWait?: Promise<void>
}

async function mockBilling(page: Page, fixture: Fixture = {}) {
  const role = fixture.role ?? "vendor"
  const user = { id: "mock-user", name: "WedPlan Test Vendor", email: "vendor@example.test", emailVerified: true, role }
  const session = role === "anonymous" ? null : { user, session: { id: "mock-session", userId: user.id, expiresAt: expiry } }
  const calls: string[] = []
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (path === "/api/auth/get-session") return route.fulfill({ json: session })
    if (path === "/api/auth/token") return route.fulfill({ json: { token: vendorToken } })
    if (path === "/api/me") {
      expect(request.headers().authorization).toBe("Bearer " + vendorToken)
      return route.fulfill({ json: user })
    }
    if (!path.startsWith("/api/payments/")) return route.fulfill({ status: 404, json: {} })
    expect(request.headers().authorization).toBe("Bearer " + vendorToken)
    calls.push(path)
    if (path.endsWith("/subscription")) {
      await fixture.subscriptionWait
      return route.fulfill({ json: fixture.current ?? free })
    }
    if (path.endsWith("/transactions")) {
      expect(url.searchParams.get("limit")).toBe("5")
      return route.fulfill({ json: fixture.history ?? history(Number(url.searchParams.get("page"))) })
    }
    expect(request.method()).toBe("POST")
    expect(request.postData()).toBeNull()
    if (path.endsWith("/create-checkout-session")) {
      await fixture.checkoutWait
      return route.fulfill({ status: fixture.checkoutStatus ?? 201, json: { url: fixture.checkoutURL ?? stripeURL } })
    }
    if (path.endsWith("/cancel-subscription")) {
      if (fixture.cancelStatus) return route.fulfill({ status: fixture.cancelStatus, json: {} })
      fixture.current = { ...premium, cancelAtPeriodEnd: true, cancelAt: expiry, renewsAt: null }
      return route.fulfill({ json: { cancelAtPeriodEnd: true, cancelAt: expiry } })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({ body: "Mock Stripe Checkout" }))
  return calls
}

test("renders Free billing, a loading state, and empty history", async ({ page }) => {
  let release!: () => void
  const subscriptionWait = new Promise<void>((resolve) => { release = resolve })
  await mockBilling(page, { subscriptionWait, history: { data: [], pagination: { page: 1, totalPages: 0 } } })
  await page.goto(subscriptionPath)
  await expect(page.getByText("Loading your subscription…")).toBeVisible()
  release()
  await expect(page.getByRole("heading", { name: "Subscription Plans" })).toBeVisible()
  await expect(page.getByText("No paid subscription")).toBeVisible()
  await expect(page.getByText("No transactions yet")).toBeVisible()
  await expect(page.getByRole("button", { name: "Upgrade to Premium" })).toBeEnabled()
})

test("sends one authenticated Checkout request and redirects to the hosted page", async ({ page }) => {
  let release!: () => void
  const checkoutWait = new Promise<void>((resolve) => { release = resolve })
  const calls = await mockBilling(page, { checkoutWait })
  await page.goto(subscriptionPath)
  await page.getByRole("button", { name: "Upgrade to Premium" }).click()
  await expect(page.getByRole("button", { name: "Opening Stripe Checkout…" })).toBeDisabled()
  release()
  await expect(page).toHaveURL(stripeURL)
  expect(calls.filter((path) => path.endsWith("/create-checkout-session"))).toHaveLength(1)
})

test("shows a Checkout error and enables retry", async ({ page }) => {
  await mockBilling(page, { checkoutStatus: 503 })
  await page.goto(subscriptionPath)
  const upgrade = page.getByRole("button", { name: "Upgrade to Premium" })
  await upgrade.click()
  await expect(page.getByRole("alert").filter({ hasText: "billing service is unavailable" })).toBeVisible()
  await expect(upgrade).toBeEnabled()
})

test("rejects a Checkout redirect outside Stripe", async ({ page }) => {
  await mockBilling(page, { checkoutURL: "https://checkout.stripe.com.example.test/checkout" })
  await page.goto(subscriptionPath)
  await page.getByRole("button", { name: "Upgrade to Premium" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Could not open Stripe Checkout" })).toBeVisible()
  await expect(page).toHaveURL(subscriptionPath)
})

test("billing fits on mobile and follows light and dark themes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: "dark" })
  await mockBilling(page, { current: premium })
  await page.goto(subscriptionPath)
  await expect(page.getByRole("heading", { name: "Subscription Plans" })).toBeVisible()
  const theme = page.getByRole("switch", { name: "Dark mode" })
  const html = page.locator("html")
  for (const appearance of ["dark", "light"]) {
    await theme.click()
    await expect(html).toHaveClass(new RegExp(`\\b${appearance}\\b`))
  }
  expect(await html.evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true)
})

test("shows pending after the Checkout redirect and confirms only after an API refresh", async ({ page }) => {
  const fixture: Fixture = { current: free }
  await mockBilling(page, fixture)
  await page.goto("/payment/success?session_id=mock-checkout-id")
  await expect(page.getByRole("heading", { name: "Payment confirmation pending" })).toBeVisible()
  await expect(page.getByText(/WedPlan hasn’t confirmed Premium yet/)).toBeVisible()
  fixture.current = premium
  await page.getByRole("button", { name: "Check again" }).click()
  await expect(page.getByRole("heading", { name: "Premium is active" })).toBeVisible()
  await expect(page.getByText("You can now publish unlimited active services.")).toBeVisible()
})

test("shows cancellation confirmation, keeps paid access, and refreshes billing status", async ({ page }) => {
  const calls = await mockBilling(page, { current: premium })
  await page.goto(subscriptionPath)
  await page.getByRole("button", { name: "Cancel Subscription", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Cancel subscription?" })
  await expect(dialog.getByText(/end of the billing period/)).toBeVisible()
  expect(calls.filter((path) => path.endsWith("/cancel-subscription"))).toHaveLength(0)
  await dialog.getByRole("button", { name: "Confirm Cancellation" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Your Premium access continues through the paid period.")).toBeVisible()
  expect(calls.filter((path) => path.endsWith("/cancel-subscription"))).toHaveLength(1)
  expect(calls.filter((path) => path.endsWith("/subscription")).length).toBeGreaterThanOrEqual(2)
})

test("keeps the dialog open and reports cancellation failures", async ({ page }) => {
  await mockBilling(page, { current: premium, cancelStatus: 503 })
  await page.goto(subscriptionPath)
  await page.getByRole("button", { name: "Cancel Subscription", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Confirm Cancellation" }).click()
  await expect(dialog.getByRole("alert")).toContainText("billing service is unavailable")
  await expect(dialog.getByRole("button", { name: "Confirm Cancellation" })).toBeEnabled()
})

test("paginates transactions and displays amount, currency, date, status, and type", async ({ page }) => {
  await mockBilling(page)
  await page.goto(subscriptionPath)
  const table = page.getByRole("region", { name: "Transaction History" }).getByRole("table")
  for (const cell of ["35.00", "USD", "Paid", "Subscription"]) await expect(table.getByRole("cell", { name: cell, exact: true })).toBeVisible()
  await expect(table.locator("time")).toHaveAttribute("datetime", expiry)
  await page.getByRole("button", { name: "Next" }).click()
  await expect(table.getByRole("cell", { name: "12.00" })).toBeVisible()
  await expect(table.getByRole("cell", { name: "Failed" })).toBeVisible()
})

test("Checkout cancel page returns to subscription without a billing mutation", async ({ page }) => {
  const calls = await mockBilling(page)
  await page.goto("/payment/cancel")
  await expect(page.getByRole("heading", { name: "Checkout cancelled" })).toBeVisible()
  expect(calls).toHaveLength(0)
  await page.getByRole("link", { name: "Back to Subscription" }).click()
  await expect(page).toHaveURL(subscriptionPath)
})

test("redirects anonymous visits to existing sign-in with a safe return path", async ({ page }) => {
  const calls = await mockBilling(page, { role: "anonymous" })
  await page.goto("/payment/success?session_id=mock-checkout-id")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fpayment%2Fsuccess$/)
  expect(calls).toHaveLength(0)
})

for (const role of ["customer", "admin"] as const) {
  test(`denies ${role} access to vendor billing and payment results`, async ({ page }) => {
    const calls = await mockBilling(page, { role })
    for (const path of [subscriptionPath, "/payment/cancel"]) {
      await page.goto(path)
      await expect(page.getByRole("heading", { name: "Vendor access required" })).toBeVisible()
      expect(calls).toHaveLength(0)
    }
  })
}
