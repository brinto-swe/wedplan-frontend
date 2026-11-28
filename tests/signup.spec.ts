import { expect, test } from "@playwright/test"

const firstPhoto = "https://i.ibb.co/test/signup-first.png"
const secondPhoto = "https://i.ibb.co/test/signup-second.png"
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5CYAAAAASUVORK5CYII=", "base64")
const photoFile = { name: "profile.png", mimeType: "image/png", buffer: png }

for (const withPhoto of [false, true]) {
  for (const [role, password] of [["Customer", "Abc123"], ["Vendor", "Abcdef"]]) {
    test(`signs up a ${role} ${withPhoto ? "with" : "without"} a photo using a six-character password`, async ({ page }) => {
      let signupBody: unknown
      const user = { id: "signup-fixture", name: "Signup Fixture", email: "signup@example.test" }
      let signedUp = false
      await page.route("**/api/**", (route) => {
        switch (new URL(route.request().url()).pathname) {
          case "/api/uploads/signup-profile-image":
            expect(withPhoto).toBe(true)
            expect(route.request().headers()["x-wedplan-upload"]).toBe("signup-profile")
            expect(route.request().headers().authorization).toBeUndefined()
            return route.fulfill({ status: 201, json: { data: [{ url: firstPhoto }] } })
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
      if (withPhoto) {
        await page.locator('input[type="file"]').setInputFiles(photoFile)
        await expect(page.getByRole("img", { name: "Uploaded image 1" })).toHaveAttribute("src", firstPhoto)
      }
      await page.getByRole("button", { name: "Create account" }).click()
      await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}/dashboard$`))
      expect(signupBody).toEqual({ name: user.name, email: user.email, password, role: role.toLowerCase(), ...(withPhoto && { image: firstPhoto }) })
    })
  }

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

test("blocks signup on a failed upload and supports retry, replacement, and removal", async ({ page }) => {
  let uploads = 0
  let signups = 0
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }))
  await page.route("**/api/auth/sign-up/email", (route) => {
    signups++
    return route.fulfill({ status: 400, json: {} })
  })
  await page.route("**/api/uploads/signup-profile-image", (route) => {
    uploads++
    return uploads === 1 ? route.fulfill({ status: 502, json: {} })
      : route.fulfill({ status: 201, json: { data: [{ url: uploads === 2 ? firstPhoto : secondPhoto }] } })
  })
  await page.goto("/sign-up")
  const picker = page.locator('input[type="file"]')
  const submit = page.getByRole("button", { name: "Create account" })
  await picker.setInputFiles(photoFile)
  const retry = page.getByRole("button", { name: "Retry profile.png" })
  await expect(retry).toBeVisible()
  await expect(submit).toBeDisabled()
  expect(signups).toBe(0)
  await retry.click()
  await expect(page.getByRole("img", { name: "Uploaded image 1" })).toHaveAttribute("src", firstPhoto)
  await picker.setInputFiles({ ...photoFile, name: "replacement.png" })
  await expect(page.getByRole("img", { name: "Uploaded image 1" })).toHaveAttribute("src", secondPhoto)
  await page.getByRole("button", { name: "Remove uploaded image 1" }).click()
  await expect(page.getByRole("list", { name: "Image previews" })).toHaveCount(0)
  await expect(submit).toBeEnabled()
})

test("Google signup keeps the original OAuth callback", async ({ page }) => {
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }))
  await page.route("**/api/auth/sign-in/social", (route) => route.fulfill({ status: 400, json: {} }))
  await page.goto("/sign-up")
  const socialRequest = page.waitForRequest("**/api/auth/sign-in/social")
  await page.getByRole("button", { name: "Continue with Google" }).click()
  const body = (await socialRequest).postDataJSON()
  expect(body.provider).toBe("google")
  expect(new URL(body.callbackURL).pathname + new URL(body.callbackURL).search).toBe("/sign-up?oauth=return")
  expect(body).not.toHaveProperty("image")
})
