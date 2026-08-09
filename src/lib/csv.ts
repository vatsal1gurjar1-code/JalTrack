import type { CustomerCreate } from "@/api/customers"

/**
 * RFC4180-ish parser. Hand-rolled rather than split(",") because addresses
 * routinely contain commas inside quotes - "12 MG Road, Flat 3B".
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c !== '"') field += c
      else if (text[i + 1] === '"') (field += '"'), i++
      else quoted = false
    } else if (c === '"') quoted = true
    else if (c === ",") (row.push(field), (field = ""))
    else if (c === "\n") (row.push(field), rows.push(row), (row = []), (field = ""))
    else if (c !== "\r") field += c
  }
  if (field !== "" || row.length) (row.push(field), rows.push(row))

  return rows.filter((r) => r.some((v) => v.trim() !== ""))
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n")
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  // BOM so Excel detects UTF-8 on double-click instead of mangling it.
  const url = URL.createObjectURL(new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const COLUMNS: Record<string, keyof CustomerCreate> = {
  name: "name", customer: "name", "customer name": "name",
  phone: "phone", mobile: "phone", "phone number": "phone", contact: "phone", number: "phone",
  address: "address",
  area: "area", route: "area", locality: "area",
  price: "default_jug_price", rate: "default_jug_price", "price per jug": "default_jug_price",
  default_jug_price: "default_jug_price",
  notes: "notes", note: "notes", remarks: "notes",
}

export const TEMPLATE_HEADERS = ["name", "phone", "address", "area", "price", "notes"]

export interface ParsedImport {
  customers: CustomerCreate[]
  skipped: number
  error?: string
  warning?: string
}

export function rowsToCustomers(rows: string[][]): ParsedImport {
  if (!rows.length) return { customers: [], skipped: 0, error: "That file is empty." }

  const [header, ...body] = rows
  const cols = header.map((h) => COLUMNS[h.trim().toLowerCase()] ?? null)

  if (!cols.includes("name")) {
    return {
      customers: [],
      skipped: 0,
      error: `No "name" column found. The first row must be headers - one of: ${TEMPLATE_HEADERS.join(", ")}.`,
    }
  }

  const customers: CustomerCreate[] = []
  let skipped = 0

  for (const row of body) {
    const c: CustomerCreate = { name: "" }
    cols.forEach((col, i) => {
      const v = (row[i] ?? "").trim()
      if (!col || !v) return
      if (col === "default_jug_price") {
        const n = Number(v.replace(/[^\d.]/g, ""))
        if (Number.isFinite(n) && n > 0) c.default_jug_price = n
      } else c[col] = v
    })
    if (c.name) customers.push(c)
    else skipped++
  }

  // Excel's plain "CSV" writes the Windows codepage, which turns every Gujarati
  // letter into "?" at save time. The characters are already gone by the time we
  // read the file, so the best we can do is spot the wreckage and say so.
  // ponytail: crude "??" heuristic; a real encoding sniff would need the raw bytes.
  const garbled = customers.filter((c) => /\?{2,}/.test(c.name)).length
  const warning = garbled
    ? `${garbled} name${garbled === 1 ? "" : "s"} came through as "????". Non-English text was lost when the file was saved. In Excel use File → Save As → "CSV UTF-8 (Comma delimited)", not plain "CSV".`
    : undefined

  return { customers, skipped, warning }
}

if (import.meta.env.DEV) {
  const tricky = [
    ["name", "address"],
    ["Ramesh", "12 MG Road, Flat 3B"],
    ['O"Brien', "line1\nline2"],
    ["રમેશ પટેલ", "વિસ્તાર ૪, અમદાવાદ"],
  ]
  const round = parseCsv(toCsv(tricky))
  console.assert(JSON.stringify(round) === JSON.stringify(tricky), "csv round-trip lost data")

  const p = rowsToCustomers([
    ["Name", "Phone", "Rate"],
    ["Ramesh", "9876543210", "Rs. 35"],
    ["", "999", "20"],
  ])
  console.assert(p.customers.length === 1 && p.skipped === 1, "rows without a name must be skipped")
  console.assert(p.customers[0].default_jug_price === 35, "price should survive currency prefixes")
  console.assert(rowsToCustomers([["foo"], ["bar"]]).error !== undefined, "missing name column must error")

  const gu = rowsToCustomers([["name"], ["રમેશ પટેલ"]])
  console.assert(gu.customers[0].name === "રમેશ પટેલ", "Gujarati names must survive parsing")
  console.assert(gu.warning === undefined, "valid Gujarati must not trip the encoding warning")
  console.assert(rowsToCustomers([["name"], ["????? ?????"]]).warning !== undefined, "mojibake must warn")
}
