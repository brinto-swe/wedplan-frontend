import { expect, test } from "@playwright/test"

const fixture = "http://127.0.0.1:3195"
const homepage = fixture + "/catalogue"
const categories = [
  "Photography & Videography", "Wedding Venues", "Decoration & Florist",
  "Catering Services", "Makeup & Styling", "Wedding Fashion",
]

test.afterEach(async ({ request }) => {
  await request.post(fixture + "/api/services")
})

test("shows the assignment categories, platform benefits, and category navigation", async ({ page }) => {
  await page.goto(homepage)
  await expect(page.getByRole("heading", { name: "Why Choose WedPlan" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Plan Your Wedding in Three Steps" })).toBeVisible()
  const choices = page.locator("#categories .wp-category-grid").getByRole("link")
  await expect(choices).toHaveText(categories)
  await choices.first().click()
  await expect(page).toHaveURL((url) => url.searchParams.get("category") === categories[0])
  await expect(page.getByRole("heading", { name: "Garden Photography" })).toBeVisible()
})

test("limits an API-backed list to six records and shows Vendor, image and details link", async ({ page, request }) => {
  await request.post(fixture + "/api/services?scenario=six")
  await page.goto(homepage)
  const cards = page.locator(".wp-featured article")
  await expect(cards).toHaveCount(6)
  await expect(cards.first()).toContainText("Fixture Wedding Studio")
  await expect(cards.first().locator("img")).toHaveAttribute("src", /i\.ibb\.co/)
  await expect(cards.first().getByRole("link")).toHaveAttribute("href", /^\/services\/[a-f0-9]{24}$/)
})

test("shows fewer listings without filling the grid with ineligible services", async ({ page }) => {
  await page.goto(homepage)
  const featured = page.locator(".wp-featured")
  await expect(featured.locator("article")).toHaveCount(2)
  for (const title of ["Pending fixture", "Rejected fixture", "Inactive fixture"]) {
    await expect(featured.getByText(title)).toHaveCount(0)
  }
})

test("shows an honest empty state and retries API failure without sample services", async ({ page, request }) => {
  await request.post(fixture + "/api/services?scenario=empty")
  await page.goto(homepage)
  await expect(page.getByText("No services listed yet")).toBeVisible()
  await request.post(fixture + "/api/services?scenario=failure")
  await page.reload()
  await expect(page.getByText("Popular services are temporarily unavailable")).toBeVisible()
  await expect(page.locator(".wp-featured article")).toHaveCount(0)
  await expect(page.getByText("sample listings")).toHaveCount(0)
  await request.post(fixture + "/api/services")
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.locator(".wp-featured article")).toHaveCount(2)
})

test("reveals sections on scroll and removes movement when reduced motion is requested", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 })
  await page.goto(homepage)
  const benefits = page.locator(".wp-benefit-grid")
  await expect(benefits).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 10)")
  await benefits.scrollIntoViewIfNeeded()
  await expect(benefits).toHaveCSS("transform", "none")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.reload()
  for (const entrance of await page.locator(".wp-home-entrance").all()) {
    await expect(entrance).toHaveCSS("transform", "none")
  }
  await page.goto("/")
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.getByRole("link", { name: "Become a Vendor" })).toHaveAttribute("href", "/sign-up")
})
