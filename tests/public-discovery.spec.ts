import { expect, test, type Page } from "@playwright/test"

const catalogue = "http://127.0.0.1:3195/services"

test("sorting resets the page and carries search and filters through pagination", async ({ page }) => {
  await page.goto(catalogue + "?q=portrait&category=Discovery&location=Dhaka&page=2")
  const sort = page.getByLabel("Sort by")
  await expect(sort).toHaveValue("newest")
  await expect(page.getByRole("navigation", { name: "Results pages" })).toContainText("Page 2 of 2")
  await sort.selectOption("price-asc")
  await expect(page.getByRole("article").first()).toContainText("Discovery portrait 12")
  await expect(page.getByRole("navigation", { name: "Results pages" })).toContainText("Page 1 of 2")
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
    q: "portrait", category: "Discovery", location: "Dhaka", sort: "price-asc",
  })
  await page.getByRole("link", { name: "Next" }).click()
  await expect(sort).toHaveValue("price-asc")
  await expect(page.getByRole("article").first()).toContainText("Discovery portrait 3")
  await sort.selectOption("price-desc")
  await expect(page.getByRole("article").first().getByRole("heading")).toHaveText("Discovery portrait 1")
  await expect(page.getByRole("navigation", { name: "Results pages" })).toContainText("Page 1 of 2")
  await page.getByRole("searchbox", { name: "Search services" }).fill("portrait 12")
  await page.getByRole("button", { name: "Apply filters" }).click()
  await expect(page.getByRole("article")).toHaveCount(1)
  await expect(sort).toHaveValue("price-desc")
})

type Role = "customer" | "vendor" | "admin"
async function mockAccount(page: Page, role?: Role, options: { sessionStatus?: number } = {}) {
  let signedIn = Boolean(role)
  let account = {
    role: role ?? "customer", id: "fixture-account", name: "WedPlan Fixture", email: "fixture@example.test",
    image: "https://i.ibb.co/fixture/avatar.png",
  }
  const sessionUser = () => ({ ...account, role: account.role === "admin" ? "customer" : "admin" })
  const empty = { data: [], pagination: { totalPages: 0 } }
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === "/api/auth/get-session") return route.fulfill({ status: options.sessionStatus ?? 200,
      json: options.sessionStatus ? {} : signedIn ? { user: sessionUser(), session: { id: "fixture" } } : null })
    if (path === "/api/auth/sign-in/email") {
      signedIn = true
      return route.fulfill({ json: { user: sessionUser(), redirect: false } })
    }
    if (path === "/api/auth/sign-out") {
      signedIn = false
      return route.fulfill({ json: { success: true } })
    }
    if (path === "/api/auth/token") return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { token: "fixture-token" } : {} })
    if (path === "/api/me") {
      expect(request.headers().authorization).toBe("Bearer fixture-token")
      if (request.method() === "PATCH") account = { ...account, ...request.postDataJSON() }
      return route.fulfill({ json: account })
    }
    if (path.startsWith("/api/bookings/") || path === "/api/services/manage") return route.fulfill({ json: empty })
    return route.fulfill({ status: 404, json: {} })
  })
}

test("guest navbar and footer link to real project destinations", async ({ page }) => {
  await mockAccount(page)
  await page.goto("/")
  const header = page.getByRole("banner")
  await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in")
  await expect(header.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up")
  const footer = page.getByRole("contentinfo")
  await expect(footer.getByRole("link", { name: "Browse services" })).toHaveAttribute("href", "/services")
  await expect(footer.getByRole("link", { name: "Report a site issue" })).toHaveAttribute("href", "https://github.com/brinto-swe/wedplan-frontend/issues")
  await expect(footer.getByRole("link", { name: "WedPlan on GitHub" })).toHaveAttribute("href", "https://github.com/brinto-swe/wedplan-frontend")
})

for (const role of ["customer", "vendor", "admin"] as const) {
  test(`renders verified ${role} account actions`, async ({ page }) => {
    await mockAccount(page, role)
    await page.route("https://i.ibb.co/**", (route) => route.fulfill({ status: 404 }))
    await page.goto("/")
    await page.getByLabel("WedPlan Fixture account").click()
    const account = page.getByRole("navigation", { name: "Account navigation" })
    await expect(account.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/" + role + "/dashboard")
    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toHaveCount(0)
    if (role === "admin") await expect(account.getByRole("link", { name: "Profile Settings" })).toHaveCount(0)
    else await expect(account.getByRole("link", { name: "Profile Settings" })).toHaveAttribute("href", "/" + role + "/profile")
  })
}

test("mobile account refreshes after profile updates and logout restores guest navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockAccount(page, "customer")
  await page.route("https://i.ibb.co/**", (route) => route.fulfill({ status: 404 }))
  await page.goto("/")
  const menu = page.getByLabel("Navigation menu")
  const mobile = page.getByRole("navigation", { name: "Mobile navigation" })
  await menu.click()
  await expect(mobile.getByText("WedPlan Fixture")).toBeVisible()
  await mobile.getByRole("link", { name: "Profile Settings" }).click()
  await page.getByLabel("Full name").fill("Updated Fixture")
  await page.getByRole("button", { name: "Save Changes" }).click()
  await expect(page.getByText("Profile updated.")).toBeVisible()
  await page.getByText("Workspace", { exact: true }).click()
  await page.getByRole("navigation", { name: "Mobile customer navigation" }).getByRole("link", { name: "Browse services" }).click()
  await menu.click()
  await expect(mobile.getByText("Updated Fixture")).toBeVisible()
  await mobile.getByRole("button", { name: "Logout" }).click()
  await expect(mobile).toBeHidden()
  await menu.click()
  await expect(mobile.getByRole("link", { name: "Sign in" })).toBeVisible()
  await expect(mobile.getByRole("link", { name: "Dashboard" })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test("session failures hide account links and support retry", async ({ page }) => {
  const options: { sessionStatus?: number } = { sessionStatus: 503 }
  await mockAccount(page, "vendor", options)
  await page.route("https://i.ibb.co/**", (route) => route.fulfill({ status: 404 }))
  await page.goto("/")
  await expect(page.getByRole("banner").getByRole("status").filter({ hasText: "Account unavailable" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: "Account navigation" })).toHaveCount(0)
  delete options.sessionStatus
  await page.getByRole("banner").getByRole("button", { name: "Retry" }).click()
  await expect(page.getByLabel("WedPlan Fixture account")).toBeVisible()
})
