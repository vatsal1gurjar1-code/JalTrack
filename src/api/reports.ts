import { supabase } from "@/lib/supabase"
import { downloadCsv } from "@/lib/csv"

export interface CustomerMonthlySummary {
  customer_id: number
  customer_name: string
  area?: string | null
  phone?: string | null
  total_jugs: number
  price_per_jug: number
  amount_due: number
}

export interface MonthlySummary {
  month: string
  /** Non-null only when billing deliberately ignored every customer's own rate. */
  override_price: number | null
  customers: CustomerMonthlySummary[]
  grand_total_jugs: number
  grand_total_amount: number
}

interface MonthlyRow {
  customer_id: number
  customer_name: string
  area?: string | null
  phone?: string | null
  default_jug_price?: number | string | null
  total_jugs: number
}

/**
 * Billing math. Each customer bills at their own stored rate; `override` is an
 * explicit "charge everyone this instead" escape hatch, off unless asked for.
 */
export function summarize(rows: MonthlyRow[], month: string, override: number | null): MonthlySummary {
  const customers = rows.map((r) => {
    const rate = override && override > 0 ? override : Number(r.default_jug_price ?? 0)
    return {
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      area: r.area,
      phone: r.phone,
      total_jugs: r.total_jugs,
      price_per_jug: rate,
      amount_due: r.total_jugs * rate,
    }
  })
  return {
    month,
    override_price: override && override > 0 ? override : null,
    customers,
    grand_total_jugs: customers.reduce((s, c) => s + c.total_jugs, 0),
    grand_total_amount: customers.reduce((s, c) => s + c.amount_due, 0),
  }
}

export async function fetchMonthlySummary(month: string, override: number | null) {
  const { data, error } = await supabase
    .from("monthly_totals")
    .select("*")
    .eq("month", month)
    .order("customer_name")
  if (error) throw error
  return summarize((data ?? []) as MonthlyRow[], month, override)
}

export function exportCsv(s: MonthlySummary) {
  downloadCsv(`jaltrack-${s.month}.csv`, [
    ["#", "Customer", "Area", "Jugs", "Rate", "Amount"],
    ...s.customers.map((c, i) => [i + 1, c.customer_name, c.area ?? "", c.total_jugs, c.price_per_jug, c.amount_due]),
    ["", "TOTAL", "", s.grand_total_jugs, "", s.grand_total_amount],
  ])
}

if (import.meta.env.DEV) {
  const rows: MonthlyRow[] = [
    { customer_id: 1, customer_name: "A", total_jugs: 10, default_jug_price: "30.00" },
    { customer_id: 2, customer_name: "B", total_jugs: 5, default_jug_price: "25.00" },
  ]
  const normal = summarize(rows, "2026-08", null)
  console.assert(normal.customers[0].amount_due === 300, "customer A should bill at its own 30")
  console.assert(normal.customers[1].amount_due === 125, "customer B should bill at its own 25")
  console.assert(normal.grand_total_amount === 425, "grand total should sum per-customer rates")

  const forced = summarize(rows, "2026-08", 40)
  console.assert(forced.grand_total_amount === 600, "override must replace every customer rate")
  console.assert(forced.override_price === 40, "override should be reported back")
}
