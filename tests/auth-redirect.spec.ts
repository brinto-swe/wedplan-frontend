import { expect, test, type Page } from "@playwright/test"

type Fixture = { role?: string; signedIn?: boolean; signInStatus?: number; profileStatus?: number }

async function mockAuth(page: Page, fixture: Fixture) {
  const identity = { id: "fixture-user", name: "Test Account", email: "test@example.test" }
  // Session and form roles cannot determine the destination.
  const user = { ...identity, role: fixture.role === "admin" ? "customer" : "admin" }
  let signedIn = fixture.signedIn ?? false
  let profileReads = 0
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    switch (path) {
      case "/api/auth/get-session":
        return route.fulfill({ json: signedIn ? { user, session: { id: "test-session" } } : null })
      case "/api/auth/sign-in/email":
        expect(request.postDataJSON()).toMatchObject({ email: identity.email, password: "fixture-password" })
        expect(request.postDataJSON()).not.toHaveProperty("role")
        expect(request.postDataJSON()).not.toHaveProperty("callbackURL")
        if (fixture.signInStatus) return route.fulfill({ status: fixture.signInStatus, json: {} })
        signedIn = true
        return route.fulfill({ json: { user, redirect: false } })
      case "/api/auth/sign-in/social": {
        const body = request.postDataJSON()
        const origin = new URL(request.url()).origin
        expect(["google", "github"]).toContain(body.provider)
        expect(body.callbackURL).toBe(origin + "/sign-in?oauth=return")
        expect(body.errorCallbackURL).toBe(origin + "/sign-in?oauth=failed")
        signedIn = true
        return route.fulfill({ json: { redirect: true, url: body.callbackURL } })
      }
      case "/api/auth/token":
        return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { token: "fixture-token" } : {} })
      case "/api/me":
        profileReads++
        expect(request.headers().authorization).toBe("Bearer fixture-token")
        return route.fulfill({ status: fixture.profileStatus ?? 200, json: { ...identity, role: fixture.role } })
      default:
        return route.fulfill({ status: 404, json: {} })
    }
  })
  return () => profileReads
}

async function submit(page: Page) {
  await page.getByLabel("Email address").fill("test@example.test")
  await page.getByLabel("Password", { exact: true }).fill("fixture-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
}

for (const role of ["admin", "vendor", "customer"]) {
  test(`email sign-in sends a verified ${role} to the dashboard`, async ({ page }) => {
    const reads = await mockAuth(page, { role })
    await page.goto("/sign-in?role=admin")
    await submit(page)
    await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`))
    expect(reads()).toBeGreaterThan(0)
  })
}

test("existing session can return to an allowlisted page for its verified role", async ({ page }) => {
  await mockAuth(page, { role: "admin", signedIn: true })
  await page.goto("/sign-in?next=%2Fadmin%2Ftransactions")
  await expect(page).toHaveURL(/\/admin\/transactions$/)
})

for (const next of ["/admin/users", "https://example.test/outside", "//example.test/outside"]) {
  test(`ignores unsafe or wrong-role return destination ${next}`, async ({ page }) => {
    await mockAuth(page, { role: "customer", signedIn: true })
    await page.goto("/sign-in?next=" + encodeURIComponent(next))
    await expect(page).toHaveURL(/\/customer\/dashboard$/)
  })
}

for (const provider of ["Google", "GitHub"]) {
  test(`${provider} return uses the verified profile`, async ({ page }) => {
    await mockAuth(page, { role: "admin" })
    await page.goto("/sign-in")
    await page.getByRole("button", { name: "Continue with " + provider }).click()
    await expect(page).toHaveURL(/\/admin\/dashboard$/)
  })
}

for (const role of [undefined, "owner"]) {
  test(`stays on sign-in for a ${role ? "unknown" : "missing"} server role`, async ({ page }) => {
    await mockAuth(page, { role })
    await page.goto("/sign-in")
    await submit(page)
    await expect(page.getByText("We couldn’t verify your account role. Please try again.")).toBeVisible()
    await expect(page).toHaveURL(/\/sign-in$/)
  })
}

test("blocked email sign-in preserves the error and requests no profile", async ({ page }) => {
  const reads = await mockAuth(page, { role: "admin", signInStatus: 403 })
  await page.goto("/sign-in")
  await submit(page)
  await expect(page.getByText("We couldn’t sign you in with this account.")).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in$/)
  expect(reads()).toBe(0)
})

test("a blocked existing session never navigates to a dashboard", async ({ page }) => {
  await mockAuth(page, { role: "admin", signedIn: true, profileStatus: 403 })
  await page.goto("/sign-in?oauth=return")
  await expect(page.getByText("We couldn’t sign you in with this account.")).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in\?oauth=return$/)
})
