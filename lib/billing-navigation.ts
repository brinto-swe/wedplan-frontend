export function billingReturn(value: unknown) {
  return value === "/vendor/subscription" || value === "/payment/success" || value === "/payment/cancel"
    ? value : undefined
}
