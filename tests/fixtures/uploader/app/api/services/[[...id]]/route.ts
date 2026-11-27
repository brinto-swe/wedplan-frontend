import { legacy, service } from "@/tests/fixtures/service-images"


const listings = [
  service, legacy,
  { ...service, id: "100000000000000000000007", title: "Pending fixture", moderationStatus: "pending" },
  { ...service, id: "100000000000000000000008", title: "Rejected fixture", moderationStatus: "rejected" },
  { ...service, id: "100000000000000000000009", title: "Inactive fixture", isActive: false },
]

export async function GET(_request: Request, context: { params: Promise<{ id?: string[] }> }) {
  const { id } = await context.params
  if (!id) return Response.json({ data: listings, pagination: { page: 1, limit: 9, total: listings.length, totalPages: 1 } })
  const data = listings.find((listing) => listing.id === id[0])
  return data ? Response.json({ data }) : Response.json({ error: "Not found" }, { status: 404 })
}
