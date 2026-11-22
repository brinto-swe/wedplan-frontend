export function bookingReturn(value: unknown) {
  return typeof value === "string" && /^\/services\/[a-f0-9]{24}\?book=1$/i.test(value) ? value : undefined
}
