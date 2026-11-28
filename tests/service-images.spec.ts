import { expect, test, type Page } from "@playwright/test"
import { cover, legacy, second, service } from "./fixtures/service-images"

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5CYAAAAASUVORK5CYII=", "base64")
const file = (name: string) => ({ name, mimeType: "image/png", buffer: png })
const uploadedUrl = (name: string) => `https://i.ibb.co/test/${name}`
const newPath = "/vendor/services/new"
const editPath = `/vendor/services/${service.id}/edit`

async function editor(page: Page, options: { wait?: Promise<void>; role?: string; foreign?: boolean; listing?: Omit<typeof service, "moderationStatus"> & { moderationStatus: "pending" | "approved" | "rejected" }; services?: object[]; plan?: "free" | "premium" } = {}) {
  const user = { subscriptionPlan: options.plan ?? "free", subscriptionExpiresAt: "2099-01-01T00:00:00.000Z", id: service.vendorId, role: options.role ?? "vendor", name: "Fixture Vendor", email: "vendor@example.test" }
  const uploads: string[] = []
  const writes: Array<{ method: string; body: Record<string, unknown> }> = []
  const listing = options.listing ?? service
  await page.route("https://i.ibb.co/**", (route) => route.fulfill({ body: png, contentType: "image/png" }))
  await page.route("**/api/**", async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (path === "/api/auth/get-session") return route.fulfill({ json: { user, session: { id: "fixture" } } })
    if (path === "/api/auth/token") return route.fulfill({ json: { token: "fixture-token" } })
    expect(req.headers().authorization).toBe("Bearer fixture-token")
    if (path === "/api/me") return route.fulfill({ json: user })
    if (path === "/api/uploads/images") {
      const data = await new Response(new Uint8Array(req.postDataBuffer()!), { headers: { "Content-Type": req.headers()["content-type"] } }).formData()
      const image = data.get("images") as File
      expect([...data.keys()]).toEqual(["images"])
      uploads.push(image.name)
      await options.wait
      if (image.name.startsWith("fail")) return route.fulfill({ status: 502, json: {} })
      return route.fulfill({ status: 201, json: { data: [{ url: uploadedUrl(image.name) }] } })
    }
    if (path === "/api/services/manage") return route.fulfill({ json: { data: options.services ?? [listing], pagination: { totalPages: 1 } } })
    if (path === `/api/services/manage/${service.id}`) {
      return route.fulfill({ json: { data: { ...listing, ...(options.foreign && { vendorId: legacy.id }) } } })
    }
    if (path === "/api/services" || path === `/api/services/${service.id}`) {
      const method = req.method()
      const body = req.postDataJSON()
      writes.push({ method, body })
      return route.fulfill({ status: method === "POST" ? 201 : 200, json: { data: { ...listing, ...body, ...(method === "POST" && { isActive: false, vendorAvailable: body.isActive, moderationStatus: "pending" }) } } })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  return { uploads, writes, files: page.locator('input[type="file"]') }
}

async function fillService(page: Page) {
  await page.getByLabel("Service title").fill(service.title)
  await page.getByLabel("Category", { exact: true }).fill(service.category)
  await page.getByLabel("Location", { exact: true }).fill(service.location)
  await page.getByLabel("Price", { exact: true }).fill(String(service.price))
  await page.getByLabel("Description", { exact: true }).fill(service.description)
}

test("submits a pending service with ordered hosted images and locks save during uploads", async ({ page }) => {
  const { promise, resolve } = Promise.withResolvers<void>()
  const { uploads, writes, files } = await editor(page, { wait: promise })
  await page.goto(newPath)
  await fillService(page)
  await page.getByLabel("Enable availability").check()
  await files.setInputFiles([file("first.png"), file("next.png")])
  try {
    await expect(page.getByRole("button", { name: "Uploading images…" })).toBeDisabled()
    expect(writes).toEqual([])
  } finally { resolve() }
  await expect(page.getByRole("img", { name: "Uploaded image 2" })).toBeVisible()
  await page.getByRole("button", { name: "Submit for review" }).click()
  await expect(page).toHaveURL(/\/vendor\/services$/)
  await expect(page.getByText("Service submitted and pending Admin review.")).toBeVisible()
  expect(uploads).toEqual(["first.png", "next.png"])
  expect(writes).toEqual([{ method: "POST", body: {
    title: service.title, description: service.description, category: service.category, price: service.price,
    location: service.location, isActive: true, images: [uploadedUrl("first.png"), uploadedUrl("next.png")],
  } }])
})

test("requires an uploaded image and excludes failed uploads from a partially successful selection", async ({ page }) => {
  const { writes, files } = await editor(page)
  await page.goto(newPath)
  await fillService(page)
  await page.getByLabel("Keep paused").check()
  const create = page.getByRole("button", { name: "Submit for review" })
  await create.click()
  await expect(page.getByText("Upload at least one service image.", { exact: true })).toBeVisible()
  await files.setInputFiles(file("fail.png"))
  await expect(page.getByRole("button", { name: "Retry fail.png" })).toBeEnabled()
  await create.click()
  expect(writes).toEqual([])
  await files.setInputFiles([file("safe.png"), file("fail-partial.png"), file("other.png")])
  await expect(page.getByRole("img", { name: "Uploaded image 2" })).toBeVisible()
  await expect(page.getByRole("img", { name: "Preview of fail.png" })).toBeVisible()
  await expect(page.getByRole("img", { name: "Preview of fail-partial.png" })).toBeVisible()
  await create.click()
  await expect(page).toHaveURL(/\/vendor\/services$/)
  expect(writes[0].body).toMatchObject({ images: [uploadedUrl("safe.png"), uploadedUrl("other.png")], isActive: false })
})

test("editing other fields preserves the existing images and order", async ({ page }) => {
  const { writes, uploads } = await editor(page)
  await page.goto(editPath)
  await expect(page.getByRole("img", { name: "Uploaded image 1" })).toHaveAttribute("src", cover)
  await page.getByLabel("Service title").fill("Updated photography")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page).toHaveURL(/\/vendor\/services$/)
  expect(writes).toEqual([{ method: "PATCH", body: expect.objectContaining({ title: "Updated photography", images: [cover, second], isActive: true }) }])
  expect(uploads).toEqual([])
})

test("editing adds, removes and reorders photos before saving", async ({ page }) => {
  const { writes, files } = await editor(page)
  await page.goto(editPath)
  await expect(page.getByRole("img", { name: "Uploaded image 2" })).toHaveAttribute("src", second)
  await files.setInputFiles(file("new.png"))
  await expect(page.getByRole("img", { name: "Uploaded image 3" })).toHaveAttribute("src", uploadedUrl("new.png"))
  await page.getByRole("button", { name: "Remove uploaded image 2" }).click()
  await page.getByRole("button", { name: "Move image 2 earlier" }).click()
  await expect(page.getByRole("img", { name: "Uploaded image 1" })).toHaveAttribute("src", uploadedUrl("new.png"))
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page).toHaveURL(/\/vendor\/services$/)
  expect(writes[0].body.images).toEqual([uploadedUrl("new.png"), cover])
})

test("legacy edits can save without images and foreign services cannot be edited", async ({ page }) => {
  const { writes } = await editor(page, { listing: { ...service, images: [] } })
  await page.goto(editPath)
  await expect(page.getByRole("button", { name: "Choose images" })).toBeEnabled()
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page).toHaveURL(/\/vendor\/services$/)
  expect(writes[0].body.images).toEqual([])
  await page.unroute("**/api/**")
  const foreign = await editor(page, { foreign: true })
  await page.goto(editPath)
  await expect(page.getByRole("heading", { name: "Service not found" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0)
  expect(foreign.writes).toEqual([])
})

test("Customer accounts cannot use the Vendor service editor", async ({ page }) => {
  await editor(page, { role: "customer" })
  await page.goto(newPath)
  await expect(page.getByRole("heading", { name: "Vendor access required" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Choose images" })).toHaveCount(0)
})

async function mockCatalogueSession(page: Page, signedIn: boolean) {
  const user = { id: legacy.id, role: "customer", name: "Fixture Customer", email: "customer@example.test" }
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: signedIn ? { user, session: { id: "fixture" } } : null }))
  await page.route("**/api/auth/token", (route) => route.fulfill({ json: { token: "fixture-token" } }))
  await page.route("**/api/me", (route) => {
    expect(route.request().headers().authorization).toBe("Bearer fixture-token")
    return route.fulfill({ json: user })
  })
}

test("public pages and authenticated details show actual covers, photo selection and fallbacks", async ({ page }) => {
  await mockCatalogueSession(page, true)
  await page.route("https://i.ibb.co/**", (route) => route.request().url() === second
    ? route.fulfill({ status: 404 }) : route.fulfill({ body: png, contentType: "image/png" }))
  await page.route("**/_next/image?*", (route) => route.fulfill({ body: png, contentType: "image/png" }))
  const origin = "http://127.0.0.1:3195"
  for (const path of ["/catalogue", "/services"]) {
    await page.goto(origin + path)
    await expect(page.getByRole("article").filter({ hasText: service.title }).locator("img")).toHaveAttribute("src", cover)
    await expect(page.getByRole("article").filter({ hasText: legacy.title }).locator("img")).toHaveAttribute("src", /photography.webp/)
  }
  await page.goto(`${origin}/services/${service.id}`)
  await expect(page.getByRole("img", { name: service.title + ", image 1" })).toHaveAttribute("src", cover)
  const gallery = page.locator(".wp-gallery-main")
  const initialHeight = await gallery.evaluate((element) => element.clientHeight)
  expect(initialHeight).toBeGreaterThan(0)
  await page.getByRole("button", { name: service.title + ", image 2" }).click()
  await expect(page.getByRole("img", { name: "Illustrative wedding photography" })).toHaveAttribute("src", /photography.webp/)
  expect(await gallery.evaluate((element) => element.clientHeight)).toBe(initialHeight)
  await page.goto(`${origin}/services/${legacy.id}`)
  await expect(page.locator(".wp-gallery-main img")).toHaveAttribute("src", /photography.webp/)
})

test("Premium Vendor badges match the API on Home, Browse, and Service Details", async ({ page }) => {
  await mockCatalogueSession(page, true)
  const origin = "http://127.0.0.1:3195"
  const badge = (name: string) => page.getByRole("article").filter({ hasText: name }).getByText("Premium Vendor", { exact: true })
  for (const path of ["/catalogue", "/services"]) {
    await page.goto(origin + path)
    await expect(badge(service.title)).toBeVisible()
    await expect(badge(legacy.title)).toHaveCount(0)
  }
  await page.goto(`${origin}/services/${service.id}`)
  await expect(page.getByText("Premium Vendor", { exact: true })).toBeVisible()
  await page.goto(`${origin}/services/${legacy.id}`)
  await expect(page.getByRole("heading", { name: legacy.title })).toBeVisible()
  await expect(page.getByText("Premium Vendor", { exact: true })).toHaveCount(0)
})

test("Customer booking summaries use the listing cover", async ({ page }) => {
  const user = { id: legacy.id, role: "customer", name: "Fixture Customer", email: "customer@example.test" }
  const booking = {
    id: "100000000000000000000004", customerId: user.id, vendorId: service.vendorId, serviceId: service.id,
    status: "accepted", eventDate: "2099-01-01", eventLocation: service.location,
    customerContact: { name: user.name, email: user.email, phone: "123456789" },
    createdAt: service.createdAt, updatedAt: service.updatedAt,
  }
  await page.route("https://i.ibb.co/**", (route) => route.fulfill({ body: png, contentType: "image/png" }))
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/auth/get-session") return route.fulfill({ json: { user, session: { id: "fixture" } } })
    if (path === "/api/auth/token") return route.fulfill({ json: { token: "fixture-token" } })
    if (path === "/api/me") return route.fulfill({ json: user })
    if (path === "/api/bookings/my") return route.fulfill({ json: { data: [booking], pagination: { totalPages: 1 } } })
    if (path === `/api/services/${service.id}`) {
      expect(route.request().headers().authorization).toBe("Bearer fixture-token")
      return route.fulfill({ json: { data: service } })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto("/customer/bookings")
  await expect(page.locator(".booking-rows img").first()).toHaveAttribute("src", cover)
})

test("Vendor service list separates moderation, saved availability and effective publication", async ({ page }) => {
  await editor(page, { services: [
    { ...service, title: "Pending listing", moderationStatus: "pending", isActive: false },
    { ...legacy, title: "Rejected listing", moderationStatus: "rejected", isActive: false },
    { ...service, id: "100000000000000000000004", title: "Older approved listing", isActive: false },
    { ...service, id: "100000000000000000000005", title: "Published listing" },
    { ...service, id: "100000000000000000000006", title: "Paused listing", vendorAvailable: false, isActive: false },
  ] })
  await page.goto("/vendor/services")
  await expect(page.getByRole("region", { name: "Service limit" })).toContainText("3 newest approved services")
  const row = (title: string) => page.getByRole("row").filter({ hasText: title })
  await expect(row("Pending listing")).toContainText("Awaiting Admin review")
  await expect(row("Rejected listing")).toContainText("Ineligible for public display")
  await expect(row("Older approved listing")).toContainText("Approved")
  await expect(row("Older approved listing")).toContainText("Enabled")
  await expect(row("Older approved listing")).toContainText("Still saved")
  await expect(row("Published listing").getByText("Active", { exact: true })).toBeVisible()
  await expect(row("Paused listing").getByText("Paused", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /^(approve|reject)\b/i })).toHaveCount(0)
})

test("Vendor can edit pending content without submitting a moderation or availability field", async ({ page }) => {
  const { writes } = await editor(page, { listing: { ...service, moderationStatus: "pending", isActive: false } })
  await page.goto(editPath)
  await expect(page.getByText("Awaiting Admin review. Availability is locked.")).toBeVisible()
  await expect(page.getByLabel("Enable availability")).toHaveCount(0)
  await page.getByLabel("Service title").fill("Updated pending service")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page).toHaveURL(/\/vendor\/services$/)
  expect(writes[0].body).toMatchObject({ title: "Updated pending service", images: [cover, second] })
  expect(writes[0].body).not.toHaveProperty("moderationStatus")
  expect(writes[0].body).not.toHaveProperty("isActive")
})

test("public catalogue and private detail omit unpublished and unapproved service records", async ({ page }) => {
  await mockCatalogueSession(page, true)
  const origin = "http://127.0.0.1:3195"
  await page.goto(origin + "/services")
  await expect(page.getByRole("article").filter({ hasText: service.title })).toBeVisible()
  for (const [id, title] of [
    ["100000000000000000000007", "Pending fixture"],
    ["100000000000000000000008", "Rejected fixture"],
    ["100000000000000000000009", "Inactive fixture"],
  ]) {
    await expect(page.getByText(title, { exact: true })).toHaveCount(0)
    const response = await page.goto(origin + "/services/" + id)
    // Streamed Next.js not-found pages may retain HTTP 200.
    expect([200, 404]).toContain(response?.status())
    await expect(page.getByRole("heading", { name: title })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: /service not found|this page could not be found/i })).toBeVisible()
  }
})

test("Premium keeps approved paused availability separate from publication", async ({ page }) => {
  const paused = { ...service, title: "Paused Premium Service", isActive: false, vendorAvailable: false }
  await editor(page, { plan: "premium", listing: paused })
  await page.goto("/vendor/services")
  await expect(page.getByRole("region", { name: "Service limit" })).toContainText("Manually paused services stay off.")
  const row = page.getByRole("row").filter({ hasText: paused.title })
  await expect(row.getByText("Approved", { exact: true })).toBeVisible()
  await expect(row.getByText("Paused", { exact: true })).toBeVisible()
  await expect(row.getByText("Inactive", { exact: true })).toBeVisible()
  await row.getByRole("link", { name: "Edit " + paused.title }).click()
  await expect(page.getByLabel("Keep paused")).toBeChecked()
})

test("a guest can browse the catalogue but is redirected when opening a service card", async ({ page }) => {
  await mockCatalogueSession(page, false)
  let privateReads = 0
  await page.route("**/api/services/" + service.id, (route) => {
    privateReads++
    return route.fulfill({ status: 401, json: {} })
  })
  await page.goto("http://127.0.0.1:3195/services")
  await page.getByRole("article").filter({ hasText: service.title }).getByRole("link").click()
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fservices%2F100000000000000000000001$/)
  expect(privateReads).toBe(0)
})
