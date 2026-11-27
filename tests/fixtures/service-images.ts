export const cover = "https://i.ibb.co/test/cover.png"
export const second = "https://i.ibb.co/test/second.png"
export const service = {
  id: "100000000000000000000001", vendorId: "100000000000000000000002",
  title: "Garden Photography", description: "Full day photography with a wedding portrait session.",
  category: "Photography", location: "Dhaka", price: 500, isActive: true, vendorAvailable: true, moderationStatus: "approved" as const,
  images: [cover, second], createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z",
}
export const legacy = { ...service, id: "100000000000000000000003", title: "Legacy Photography", images: [] }
