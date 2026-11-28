import { expect, test, type Page } from "@playwright/test"

const fixture = "http://127.0.0.1:3195"
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5CYAAAAASUVORK5CYII=", "base64")
const image = (name: string, mimeType = "image/png", buffer = png) => ({ name, mimeType, buffer })

async function setup(page: Page, options: { failures?: string[]; firstUpload?: Promise<void>; single?: boolean } = {}) {
  const requests: string[] = []
  let active = 0
  let peak = 0
  await page.route("**/api/auth/token", (route) => route.fulfill({ json: { token: "fixture-token" } }))
  await page.route("https://i.ibb.co/**", (route) => route.fulfill({ body: png, contentType: "image/png" }))
  await page.route("**/api/uploads/images", async (route) => {
    const request = route.request()
    expect(request.method()).toBe("POST")
    expect(request.headers().authorization).toBe("Bearer fixture-token")
    const body = await new Response(new Uint8Array(request.postDataBuffer()!), {
      headers: { "Content-Type": request.headers()["content-type"] },
    }).formData()
    expect([...body.keys()]).toEqual(["images"])
    const file = body.get("images")
    expect(file).toBeInstanceOf(File)
    if (!(file instanceof File)) throw new Error("Missing image")
    requests.push(file.name)
    active++
    peak = Math.max(peak, active)
    const index = requests.length
    try {
      if (index === 1) await options.firstUpload
      if (options.failures?.includes(file.name)) return await route.fulfill({ status: 502, json: { error: "upstream" } })
      return await route.fulfill({ status: 201, json: { data: [{ url: `https://i.ibb.co/mock/${index}.png` }] } })
    } finally {
      active--
    }
  })
  await page.goto(fixture + (options.single ? "/?single=1" : ""))
  await expect(page.getByRole("button", { name: options.single ? "Choose image" : "Choose images", exact: true })).toBeEnabled()
  return { files: page.locator('input[type="file"]'), requests, peak: () => peak }
}

test("uploads one image, replaces its local preview and removes the result", async ({ page }) => {
  const { promise, resolve } = Promise.withResolvers<void>()
  const { files, requests } = await setup(page, { single: true, firstUpload: promise })
  await expect(files).not.toHaveAttribute("multiple")
  await files.setInputFiles(image("first.png"))
  try {
    await expect(page.getByRole("img", { name: "Preview of first.png" })).toHaveAttribute("src", /^blob:/)
    await expect(page.getByText("Uploading…")).toBeVisible()
  } finally { resolve() }
  const uploaded = page.getByRole("img", { name: "Uploaded image 1" })
  await expect(uploaded).toHaveAttribute("src", "https://i.ibb.co/mock/1.png")
  await expect.poll(() => uploaded.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)
  expect(requests).toEqual(["first.png"])
  await page.getByRole("button", { name: "Remove uploaded image 1" }).click()
  await expect(uploaded).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Choose image", exact: true })).toBeEnabled()
})

test("queues multiple files sequentially and retains failures with retry and remove controls", async ({ page }) => {
  const { promise, resolve } = Promise.withResolvers<void>()
  const failures = ["middle.png"]
  const { files, requests, peak } = await setup(page, { firstUpload: promise, failures })
  await files.setInputFiles([image("first.png"), image("middle.png"), image("last.png")])
  try {
    await expect.poll(() => requests).toEqual(["first.png"])
    await expect(page.getByText("Waiting to upload")).toHaveCount(2)
  } finally { resolve() }
  await expect(page.getByRole("img", { name: /^Uploaded image/ })).toHaveCount(2)
  expect(requests).toEqual(["first.png", "middle.png", "last.png"])
  expect(peak()).toBe(1)
  await expect(page.getByRole("img", { name: "Preview of middle.png" })).toBeVisible()
  await expect(page.getByText("middle.png: Could not upload this image. Try again.")).toBeVisible()
  failures.length = 0
  await page.getByRole("button", { name: "Retry middle.png" }).click()
  await expect(page.getByRole("img", { name: /^Uploaded image/ })).toHaveCount(3)
})

test("keeps a standalone failed file visible until removed", async ({ page }) => {
  const { files } = await setup(page, { failures: ["failed.png"] })
  await files.setInputFiles(image("failed.png"))
  await expect(page.getByRole("button", { name: "Retry failed.png" })).toBeEnabled()
  await expect(page.getByRole("img", { name: /^Uploaded image/ })).toHaveCount(0)
  await page.getByRole("button", { name: "Remove failed.png" }).click()
  await expect(page.getByRole("img", { name: "Preview of failed.png" })).toHaveCount(0)
})

test("rejects unsupported and oversized files without calling the API", async ({ page }) => {
  const { files, requests } = await setup(page)
  await files.setInputFiles(image("animated.gif", "image/gif"))
  await expect(page.getByText("animated.gif: Choose a JPEG, PNG, or WebP image.")).toBeVisible()
  await files.setInputFiles(image("large.png", "image/png", Buffer.alloc(4 * 1024 * 1024 + 1)))
  await expect(page.getByText("large.png: Images must be at most 4 MiB.")).toBeVisible()
  expect(requests).toEqual([])
})

test("limits selections to ten images and reports excess files", async ({ page }) => {
  const { files, requests } = await setup(page)
  await files.setInputFiles(Array.from({ length: 11 }, (_, index) => image(`image-${index}.png`)))
  await expect(page.getByText("You can add up to 10 images.")).toBeVisible()
  await expect(page.getByRole("img", { name: /^Uploaded image/ })).toHaveCount(10)
  expect(requests).toHaveLength(10)
  await expect(page.getByRole("button", { name: "Choose images" })).toBeDisabled()
})

test("supports the keyboard picker and removal", async ({ page }) => {
  await setup(page)
  const choose = page.getByRole("button", { name: "Choose images" })
  await page.keyboard.press("Tab")
  await expect(choose).toBeFocused()
  const chooser = page.waitForEvent("filechooser")
  await page.keyboard.press("Enter")
  await (await chooser).setFiles(image("keyboard.png"))
  const remove = page.getByRole("button", { name: "Remove uploaded image 1" })
  await expect(remove).toBeEnabled()
  await remove.focus()
  await page.keyboard.press("Space")
  await expect(remove).toHaveCount(0)
})

test("supports drag and drop and avoids duplicate selections", async ({ page }) => {
  const { requests } = await setup(page)
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File([Uint8Array.from(atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5CYAAAAASUVORK5CYII="
    ), (char) => char.charCodeAt(0))], "dropped.png", { type: "image/png", lastModified: 1 }))
    return data
  })
  const dropZone = page.getByRole("button", { name: "Choose images" }).locator("..")
  await dropZone.dispatchEvent("drop", { dataTransfer: transfer })
  await expect(page.getByRole("img", { name: "Uploaded image 1" })).toBeVisible()
  await dropZone.dispatchEvent("drop", { dataTransfer: transfer })
  await expect(page.getByText("dropped.png is already selected.")).toBeVisible()
  expect(requests).toEqual(["dropped.png"])
})
