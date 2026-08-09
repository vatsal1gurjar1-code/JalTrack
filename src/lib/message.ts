export const PLACEHOLDERS = ["name", "month", "jugs", "rate", "total"] as const

export type Lang = "en" | "gu"

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "gu", label: "ગુજરાતી" },
]

export const DEFAULT_TEMPLATES: Record<Lang, string> = {
  en: `Namaste {name} 🙏

Water jug bill for {month}
Jugs delivered: {jugs}
Rate: Rs. {rate} per jug
*Total: Rs. {total}*

Thank you!`,
  gu: `નમસ્તે {name} 🙏

{month} નું પાણીના જગનું બિલ
જગ આપ્યા: {jugs}
ભાવ: રૂ. {rate} પ્રતિ જગ
*કુલ: રૂ. {total}*

આભાર!`,
}

export const templateKey = (lang: Lang) => `whatsapp_template_${lang}`

/** Fills {placeholders}. Anything unrecognised is left alone rather than blanked. */
export function renderTemplate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}

/**
 * wa.me wants digits only, including a country code.
 * ponytail: bare 10-digit numbers are assumed Indian - add a country-code setting if
 * you ever serve customers outside India.
 */
export function waLink(phone: string | null | undefined, text: string) {
  let d = (phone ?? "").replace(/\D/g, "")
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1)
  if (d.length === 10) d = "91" + d
  if (d.length < 11 || d.length > 15) return null
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}

if (import.meta.env.DEV) {
  const out = renderTemplate("Hi {name}, {jugs} jugs = Rs. {total}. {unknown}", {
    name: "રમેશ",
    jugs: 12,
    total: 360,
  })
  console.assert(out === "Hi રમેશ, 12 jugs = Rs. 360. {unknown}", "template fill is wrong")

  for (const lang of ["en", "gu"] as Lang[]) {
    const filled = renderTemplate(DEFAULT_TEMPLATES[lang], {
      name: "A", month: "M", jugs: 1, rate: 2, total: 3,
    })
    console.assert(!/\{\w+\}/.test(filled), `${lang} template has an unfillable placeholder`)
  }

  console.assert(waLink("9876543210", "x")?.startsWith("https://wa.me/919876543210?"), "10-digit needs +91")
  console.assert(waLink("+91 98765 43210", "x")?.startsWith("https://wa.me/919876543210?"), "formatting must be stripped")
  console.assert(waLink("09876543210", "x")?.startsWith("https://wa.me/919876543210?"), "leading 0 must be dropped")
  console.assert(waLink("123", "x") === null, "too-short numbers have no link")
  console.assert(waLink(null, "x") === null, "missing phone has no link")
  console.assert(waLink("9876543210", "a b&c")!.includes("a%20b%26c"), "text must be url-encoded")
}
