import { expect, test } from "@playwright/test"

for (const [role, password] of [["Customer", "Abc123"], ["Vendor", "Abcdef"]]) {
  test(`signs up a ${role} without a photo using a six-character password`, async ({ page }) => {
    let signupBody: unknown
    const user = { id: "signup-fixture", name: "Signup Fixture", email: "signup@example.test" }
    let signedUp = false
    await page.route("**/api/**", (route) => {
      switch (new URL(route.request().url()).pathname) {
        case "/api/auth/sign-up/email":
          signupBody = route.request().postDataJSON()
          signedUp = true
          return route.fulfill({ json: { user } })
        case "/api/auth/get-session":
          return route.fulfill({ json: signedUp ? { user, session: {} } : null })
        case "/api/auth/token":
          return route.fulfill({ json: { token: "fixture" } })
        case "/api/me":
          return route.fulfill({ json: { ...user, role: role.toLowerCase() } })
        default:
          return route.fulfill({ status: 404, json: {} })
      }
    })
    await page.goto("/sign-up?role=admin")
    await expect(page.getByRole("radio")).toHaveCount(2)
    await page.getByRole("radio", { name: new RegExp(role) }).check()
    await page.getByLabel("Full name").fill(user.name)
    await page.getByLabel("Email address").fill(user.email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByLabel("Confirm password").fill(password)
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}/dashboard$`))
    expect(signupBody).toEqual({ name: user.name, email: user.email, password, role: role.toLowerCase() })
  })
}

for (const password of ["abcdef", "ABCDEF", "Ab123"]) {
  test(`rejects signup password ${password} before sending it`, async ({ page }) => {
    let requests = 0
    await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }))
    await page.route("**/api/auth/sign-up/email", (route) => {
      requests++
      return route.fulfill({ status: 400, json: {} })
    })
    await page.goto("/sign-up")
    await page.getByLabel("Full name").fill("Signup Fixture")
    await page.getByLabel("Email address").fill("signup@example.test")
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByLabel("Confirm password").fill(password)
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page.locator("#password-error")).toHaveText(/at least 6 characters.*uppercase.*lowercase/)
    expect(requests).toBe(0)
  })
}
