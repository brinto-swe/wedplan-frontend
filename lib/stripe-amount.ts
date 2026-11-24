const wholeUnitStripeCharges = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "VND", "VUV", "XAF", "XOF", "XPF",
])
const threeDecimalStripeCharges = new Set(["BHD", "JOD", "KWD", "OMR", "TND"])

export function formatStripeAmount(amount: number, currency: string, currencyDisplay?: "code") {
  const code = currency.toUpperCase()
  const scale = wholeUnitStripeCharges.has(code) ? 0 : threeDecimalStripeCharges.has(code) ? 3 : 2
  // Stripe reports ISK and UGX with two minor-unit digits even for whole-unit charges.
  const digits = code === "ISK" || code === "UGX" ? 0 : scale
  return new Intl.NumberFormat(undefined, {
    ...(currencyDisplay && { style: "currency", currency: code, currencyDisplay }),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / 10 ** scale)
}
