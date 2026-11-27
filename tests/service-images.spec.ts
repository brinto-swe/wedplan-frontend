import { expect, test, type Page } from "@playwright/test"
import { cover, legacy, second, service } from "./fixtures/service-images"

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5CYAAAAASUVORK5CYII=", "base64")
const file = (name: string) => ({ name, mimeType: "image/png", buffer: png })
const uploadedUrl = (name: string) => `https://i.ibb.co/test/${name}`
const newPath = "/vendor/services/new"
const editPath = `/vendor/services/${service.id}/edit`

async function editor(page: Page, options: { wait?: Promise<void>; role?: string; foreign?: boolean; listing?: typeof service } = {}) {
  const user = { id: service.vendorId, role: options.role ?? "vendor", name: "Fixture Vendor", email: "vendor@example.test" }
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
    if (path === "/api/services/manage") return route.fulfill({ json: { data: [listing], pagination: { totalPages: 1 } } })
    if (path === `/api/services/manage/${service.id}`) {
      return route.fulfill({ json: { data: { ...listing, ...(options.foreign && { vendorId: legacy.id }) } } })
    }
    if (path === "/api/services" || path === `/api/services/${service.id}`) {
      const method = req.method()
      const body = req.postDataJSON()
      writes.push({ method, body })
      return route.fulfill({ status: method === "POST" ? 201 : 200, json: { data: { ...listing, ...body } } })
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

test("creates an active service with ordered hosted images and locks save during uploads", async ({ page }) => {
  const { promise, resolve } = Promise.withResolvers<void>()
  const { uploads, writes, files } = await editor(page, { wait: promise })
  await page.goto(newPath)
  await fillService(page)
  await page.getByLabel("Publish as active").check()
  await files.setInputFiles([file("first.png"), file("next.png")])
  try {
    await expect(page.getByRole("button", { name: "Uploading images…" })).toBeDisabled()
    expect(writes).toEqual([])
  } finally { resolve() }
  await expect(page.getByRole("img", { name: "Uploaded image 2" })).toBeVisible()
  await page.getByRole("button", { name: "Create service" }).click()
  await expect(page).toHaveURL(/\/vendor\/services$/)
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
  const create = page.getByRole("button", { name: "Create service" })
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

test("public pages show actual covers, photo selection and fallbacks", async ({ page }) => {
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
    if (path === `/api/services/${service.id}`) return route.fulfill({ json: { data: service } })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto("/customer/bookings")
  await expect(page.locator(".booking-rows img").first()).toHaveAttribute("src", cover)
})
