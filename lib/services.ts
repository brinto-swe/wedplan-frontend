import { z } from "zod"
import { moderationStatus } from "@/lib/service-publication"
import { serviceImageUrls } from "@/lib/service-image-urls"

const serviceSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  price: z.number().nonnegative(),
  location: z.string(),
  vendorId: z.string(),
  images: serviceImageUrls.optional(),
  moderationStatus: moderationStatus.optional(),
  isActive: z.boolean().optional(),
})

function isPublicService(service: z.infer<typeof serviceSchema>) {
  return service.isActive === true && service.moderationStatus === "approved"
}

export type Service = z.infer<typeof serviceSchema> & { vendorName?: string; demo?: true }
export const serviceSortLabels = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
} as const
export type ServiceSort = keyof typeof serviceSortLabels
export type Filters = { q?: string; category?: string; location?: string; sort?: ServiceSort; page: number }

const listSchema = z.object({
  data: z.array(serviceSchema),
  pagination: z.object({
    page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number(),
  }),
})
const detailSchema = z.object({ data: serviceSchema })
type ServiceList = Omit<z.infer<typeof listSchema>, "data"> & { data: Service[]; demo: boolean }

export const categories = [
  { name: "Venues", image: "/weddings/venues.webp", alt: "Garden ceremony at a historic villa" },
  { name: "Photography", image: "/weddings/photography.webp", alt: "Newlyweds on a stone staircase" },
  { name: "Florals", image: "/weddings/florals.webp", alt: "Garden roses and hydrangeas arranged for a wedding" },
  { name: "Catering", image: "/weddings/catering.webp", alt: "Champagne and porcelain on a reception table" },
]

export function serviceImages(category: string, images?: readonly string[], title = "Service") {
  const image = categories.find((item) => category.toLowerCase().includes(item.name.toLowerCase().replace(/s$/, "")))
    ?? { image: "/weddings/hero.webp", alt: "An outdoor wedding reception at a stone villa" }
  if (images?.length) return [...new Set(images)].map((url, index) => ({
    image: url, alt: `${title}, image ${index + 1}`, fallback: image.image,
  }))
  return [image, ...categories.filter((item) => item.image !== image.image).slice(0, 2)]
    .map((item) => ({ image: item.image, alt: item.alt, fallback: item.image }))
}

const demos: Service[] = [
  { id: "demo-villa", title: "The Willow House", category: "Venues", location: "Hudson Valley, NY", price: 8500, vendorId: "willow-house", vendorName: "Willow House Events", demo: true, description: "Exchange vows in a private garden, then welcome your guests to a candlelit dinner in a restored country house. The grounds offer space for an outdoor ceremony and a separate reception, with an indoor option for wet weather." },
  { id: "demo-photography", title: "Lumière Wedding Studio", category: "Photography", location: "New York, NY", price: 3200, vendorId: "lumiere", vendorName: "Lumière Wedding Studio", demo: true, description: "Natural, documentary wedding photography with an editorial eye. This full-day package covers the quiet moments before the ceremony, portraits, speeches, and the first dance." },
  { id: "demo-florals", title: "Petal & Stem Atelier", category: "Florals", location: "Brooklyn, NY", price: 1800, vendorId: "petal-and-stem", vendorName: "Petal & Stem Atelier", demo: true, description: "Seasonal, garden-inspired flowers designed around your venue and palette. The package includes a bridal bouquet, ceremony flowers, and arrangements for the reception tables." },
  { id: "demo-catering", title: "Gathered Table Catering", category: "Catering", location: "Hudson Valley, NY", price: 2400, vendorId: "gathered-table", vendorName: "Gathered Table Catering", demo: true, description: "A seasonal menu with family-style dishes, crafted around the rhythm of your reception. Choose a dinner and cocktail service shaped by locally sourced ingredients." },
]

function queryParams(filters: Filters) {
  const params = new URLSearchParams()
  for (const key of ["q", "category", "location"] as const) {
    if (filters[key]) params.set(key, filters[key])
  }
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort)
  if (filters.page > 1) params.set("page", String(filters.page))
  return params
}

export function browseUrl(filters: Filters) {
  const query = queryParams(filters).toString()
  return query ? `/services?${query}` : "/services"
}

export function parseFilters(query: Record<string, string | string[] | undefined>) {
  const field = (name: string, max: number) => {
    const value = query[name]
    return typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined
  }
  const rawPage = query.page
  const page = typeof rawPage === "string" && /^[1-9]\d{0,4}$/.test(rawPage) ? Math.min(Number(rawPage), 10_000) : 1
  const sort = query.sort === "price-asc" || query.sort === "price-desc" ? query.sort : "newest"
  return { q: field("q", 120), category: field("category", 80), location: field("location", 120), page, sort } satisfies Filters
}

async function request(path: string, token?: string, signal?: AbortSignal) {
  const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
  return fetch(new URL(path, origin), {
    cache: "no-store", credentials: "omit",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.any([AbortSignal.timeout(3000), ...(signal ? [signal] : [])]),
  })
}

export async function listServices(filters: Filters, limit = 9): Promise<ServiceList> {
  const params = queryParams(filters)
  params.set("limit", String(limit))
  try {
    const response = await request(`/api/services?${params}`)
    if (!response.ok) throw new Error("Service catalog unavailable")
    const result = listSchema.parse(await response.json())
    return { ...result, data: result.data.filter(isPublicService), demo: false }
  } catch {
    const data = demos.filter((item) =>
      (!filters.category || item.category.toLowerCase() === filters.category.toLowerCase()) &&
      (!filters.location || item.location.toLowerCase() === filters.location.toLowerCase()) &&
      (!filters.q || [item.title, item.description].some((text) => text.toLowerCase().includes(filters.q!.toLowerCase())))
    )
    if (filters.sort === "price-asc") data.sort((first, second) => first.price - second.price)
    if (filters.sort === "price-desc") data.sort((first, second) => second.price - first.price)
    const offset = (filters.page - 1) * limit
    return { data: data.slice(offset, offset + limit), demo: true,
      pagination: { page: filters.page, limit, total: data.length, totalPages: Math.ceil(data.length / limit) } }
  }
}

export async function getService(id: string, token: string, signal?: AbortSignal): Promise<{ kind: "found"; service: Service } | { kind: "missing" | "unauthorized" | "forbidden" | "unavailable" }> {
  const demo = demos.find((service) => service.id === id)
  if (demo) {
    const catalog = await listServices({ page: 1 }, 1)
    return catalog.demo ? { kind: "found", service: demo } : { kind: "missing" }
  }
  if (!/^[a-f0-9]{24}$/i.test(id)) return { kind: "missing" }
  try {
    const response = await request(`/api/services/${encodeURIComponent(id)}`, token, signal)
    if (response.status === 401) return { kind: "unauthorized" }
    if (response.status === 403) return { kind: "forbidden" }
    if (response.status === 404) return { kind: "missing" }
    if (!response.ok) return { kind: "unavailable" }
    const { data } = detailSchema.parse(await response.json())
    return isPublicService(data) ? { kind: "found", service: data } : { kind: "missing" }
  } catch {
    return { kind: "unavailable" }
  }
}

export function formattedPrice(service: Service) {
  return new Intl.NumberFormat("en-US", service.demo
    ? { style: "currency", currency: "USD", maximumFractionDigits: 2 }
    : { maximumFractionDigits: 2 }).format(service.price)
}
