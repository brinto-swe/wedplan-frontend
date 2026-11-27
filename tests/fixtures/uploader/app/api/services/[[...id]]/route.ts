import { legacy, service } from "@/tests/fixtures/service-images"

export async function GET(_request: Request, context: { params: Promise<{ id?: string[] }> }) {
  const { id } = await context.params
  if (!id) return Response.json({ data: [service, legacy], pagination: { page: 1, limit: 9, total: 2, totalPages: 1 } })
  const data = [service, legacy].find((listing) => listing.id === id[0])
  return data ? Response.json({ data }) : Response.json({ error: "Not found" }, { status: 404 })
}
