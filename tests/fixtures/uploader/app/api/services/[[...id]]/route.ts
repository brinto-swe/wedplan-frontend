import { legacy, service } from "@/tests/fixtures/service-images"


const listings = [
  service, legacy,
  { ...service, id: "100000000000000000000007", title: "Pending fixture", moderationStatus: "pending" },
  { ...service, id: "100000000000000000000008", title: "Rejected fixture", moderationStatus: "rejected" },
  { ...service, id: "100000000000000000000009", title: "Inactive fixture", isActive: false },
]

let scenario: "six" | "empty" | "failure" | undefined

export async function POST(request: Request) {
  const mode = new URL(request.url).searchParams.get("scenario")
  scenario = mode === "six" || mode === "empty" || mode === "failure" ? mode : undefined
  return new Response(null, { status: 204 })
}

export async function GET(request: Request, context: { params: Promise<{ id?: string[] }> }) {
  const { id } = await context.params
  if (!id) {
    if (scenario === "failure") return new Response(null, { status: 503 })
    const query = new URL(request.url).searchParams
    const page = Number(query.get("page") ?? 1)
    const limit = Number(query.get("limit") ?? 9)
    const sort = query.get("sort")
    const records = scenario === "empty" ? []
      : scenario === "six" ? Array.from({ length: 7 }, (_, index) => ({
        ...service, id: (200 + index).toString(16).padStart(24, "0"),
        title: "Featured wedding service " + (index + 1), vendorName: "Fixture Wedding Studio",
      }))
      : query.get("category") === "Discovery"
      ? Array.from({ length: 12 }, (_, index) => ({
        ...service, id: (100 + index).toString(16).padStart(24, "0"),
        category: "Discovery", title: "Discovery portrait " + (index + 1), price: 1200 - index * 100,
      }))
      : [...listings]
    const data = records.filter((listing) =>
      (!query.get("category") || listing.category === query.get("category")
        || (query.get("category") === "Photography & Videography" && listing.category === "Photography")) &&
      (!query.get("q") || listing.title.toLowerCase().includes(query.get("q")!.toLowerCase())) &&
      (!query.get("location") || listing.location === query.get("location")))
    if (sort === "price-asc") data.sort((a, b) => a.price - b.price)
    if (sort === "price-desc") data.sort((a, b) => b.price - a.price)
    return Response.json({ data: data.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total: data.length, totalPages: Math.ceil(data.length / limit) } })
  }
  const data = listings.find((listing) => listing.id === id[0])
  return data ? Response.json({ data }) : Response.json({ error: "Not found" }, { status: 404 })
}
