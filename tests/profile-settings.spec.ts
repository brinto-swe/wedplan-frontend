import { expect, test, type Page } from "@playwright/test"

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5CYAAAAASUVORK5CYII=", "base64")
const original = "https://i.ibb.co/profile-test/original.png"
const uploaded = "https://i.ibb.co/profile-test/new.png"

async function fixture(page: Page, role: "customer" | "vendor", options: { wait?: Promise<void>; failUpload?: boolean; rejectSave?: boolean } = {}) {
  const user = {
    id: "507f1f77bcf86cd799439011", role, name: "Original Name", email: "fixture@example.test",
    image: original, createdAt: "2026-01-01T00:00:00.000Z", ...(role === "vendor" && { businessName: "Original Business" }),
  }
  let profile = { ...user }
  const patches: Record<string, unknown>[] = []
  await page.route("https://i.ibb.co/**", (route) => route.fulfill({ body: png, contentType: "image/png" }))
  await page.route("**/api/**", async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (path === "/api/auth/get-session") return route.fulfill({ json: { user, session: { id: "fixture" } } })
    if (path === "/api/auth/token") return route.fulfill({ json: { token: "fixture-token" } })
    if (path === "/api/me") {
      expect(req.headers().authorization).toBe("Bearer fixture-token")
      if (req.method() === "PATCH") {
        const changes = req.postDataJSON()
        patches.push(changes)
        if (options.rejectSave) return route.fulfill({ status: 400, json: { issues: [{ path: "name", message: "Please choose another name." }] } })
        profile = { ...profile, ...changes }
      }
      return route.fulfill({ json: profile })
    }
    if (path === "/api/uploads/images") {
      expect(req.headers().authorization).toBe("Bearer fixture-token")
      const form = await new Response(new Uint8Array(req.postDataBuffer()!), { headers: { "Content-Type": req.headers()["content-type"] } }).formData()
      expect([...form.keys()]).toEqual(["images"])
      expect((form.get("images") as File).name).toBe("avatar.png")
      await options.wait
      return options.failUpload ? route.fulfill({ status: 502, json: {} }) : route.fulfill({ status: 201, json: { data: [{ url: uploaded }] } })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto(`/${role}/profile`)
  return { patches, save: page.getByRole("button", { name: "Save Changes" }), photo: page.getByRole("img", { name: "Uploaded image 1" }),
    select: () => page.locator('input[type="file"]').setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png }) }
}

test("customer loads and updates their profile with only editable fields", async ({ page }) => {
  const { patches, save, photo } = await fixture(page, "customer")
  await expect(page.getByLabel("Email address")).toHaveValue("fixture@example.test")
  await expect(page.getByLabel("Email address")).toHaveAttribute("readonly", "")
  await expect(page.getByLabel("Role")).toHaveValue("Customer")
  await expect(page.getByLabel("Role")).toHaveAttribute("readonly", "")
  await expect(photo).toHaveAttribute("src", original)
  await page.getByLabel("Full name").fill("  Updated Customer  ")
  await save.click()
  await expect(page.getByText("Profile updated.")).toBeVisible()
  await expect(page.locator(".vendor-sidebar")).toContainText("Updated Customer")
  expect(patches).toEqual([{ name: "Updated Customer" }])
  await page.reload()
  await expect(page.getByLabel("Full name")).toHaveValue("Updated Customer")
})

test("vendor loads and updates name and business name on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { patches, save } = await fixture(page, "vendor")
  await expect(page.getByLabel("Business name")).toHaveValue("Original Business")
  await expect(page.getByLabel("Email address")).toHaveValue("fixture@example.test")
  await expect(page.getByLabel("Role")).toHaveValue("Vendor")
  await page.getByLabel("Full name").fill("Updated Vendor")
  await page.getByLabel("Business name").fill("  Updated Business  ")
  await save.click()
  await expect(page.getByText("Profile updated.")).toBeVisible()
  expect(patches).toEqual([{ name: "Updated Vendor", businessName: "Updated Business" }])
  await page.reload()
  await expect(page.getByLabel("Business name")).toHaveValue("Updated Business")
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test("profile photo replaces the existing photo only after upload and persists after saving", async ({ page }) => {
  const { promise, resolve } = Promise.withResolvers<void>()
  const { patches, save, photo, select } = await fixture(page, "customer", { wait: promise })
  await expect(photo).toHaveAttribute("src", original)
  await select()
  try {
    await expect(page.getByRole("button", { name: "Uploading image…" })).toBeDisabled()
    await expect(photo).toHaveAttribute("src", original)
    expect(patches).toEqual([])
  } finally { resolve() }
  await expect(photo).toHaveAttribute("src", uploaded)
  await save.click()
  await expect(page.getByText("Profile updated.")).toBeVisible()
  expect(patches).toEqual([{ name: "Original Name", image: uploaded }])
  await page.reload()
  await expect(photo).toHaveAttribute("src", uploaded)
  await page.getByRole("button", { name: "Remove uploaded image 1" }).click()
  await save.click()
  await expect(page.getByText("Profile updated.")).toBeVisible()
  expect(patches[1]).toEqual({ name: "Original Name", image: null })
  await page.reload()
  await expect(photo).toHaveCount(0)
  await expect(page.getByLabel("Full name")).toHaveValue("Original Name")
})

test("failed replacement preserves the saved image and never submits the failed selection", async ({ page }) => {
  const { patches, save, photo, select } = await fixture(page, "vendor", { failUpload: true })
  await expect(photo).toHaveAttribute("src", original)
  await select()
  await expect(page.getByRole("button", { name: "Retry avatar.png" })).toBeEnabled()
  await expect(photo).toHaveAttribute("src", original)
  await save.click()
  await expect(page.getByText("Profile updated.")).toBeVisible()
  expect(patches).toEqual([{ name: "Original Name", businessName: "Original Business" }])
})

test("shows client and API validation errors beside the affected field", async ({ page }) => {
  const { patches, save } = await fixture(page, "customer", { rejectSave: true })
  await page.getByLabel("Full name").fill("  ")
  await save.click()
  await expect(page.getByText("Enter your full name.")).toBeVisible()
  expect(patches).toEqual([])
  await page.getByLabel("Full name").fill("Proposed Name")
  await save.click()
  await expect(page.getByText("Please choose another name.")).toBeVisible()
  await expect(page.getByText("Profile updated.")).toHaveCount(0)
})
