import { format } from "date-fns"
import { supabase } from "@/lib/supabase"

export interface Delivery {
  id: number
  customer_id: number
  customer_name?: string | null
  jug_count: number
  delivered_at?: string | null
  delivery_date?: string | null
  notes?: string | null
}

export interface DashboardData {
  total_customers: number
  customers_served_today: number
  total_jugs_today: number
  recent_entries: Delivery[]
}

/** Local calendar day - the delivery person's "today", not UTC's. */
export const today = () => format(new Date(), "yyyy-MM-dd")

export async function createDelivery(customer_id: number, jug_count: number) {
  const { data, error } = await supabase
    .from("deliveries")
    .insert({ customer_id, jug_count, delivery_date: today() })
    .select()
    .single()
  if (error) throw error
  return data as Delivery
}

export async function fetchDeliveries(params?: {
  delivery_date?: string
  from?: string
  to?: string
  customer_id?: number
  limit?: number
}) {
  let q = supabase
    .from("deliveries")
    .select("*, customers(name)", { count: "exact" })
    .order("delivered_at", { ascending: false })
    .limit(params?.limit ?? 500)

  if (params?.delivery_date) q = q.eq("delivery_date", params.delivery_date)
  if (params?.from) q = q.gte("delivery_date", params.from)
  if (params?.to) q = q.lte("delivery_date", params.to)
  if (params?.customer_id) q = q.eq("customer_id", params.customer_id)

  const { data, error, count } = await q
  if (error) throw error

  const deliveries = (data ?? []).map(({ customers, ...d }) => ({
    ...d,
    customer_name: customers?.name ?? null,
  })) as Delivery[]

  return { deliveries, total: count ?? 0 }
}

export async function deleteDelivery(id: number) {
  const { error } = await supabase.from("deliveries").delete().eq("id", id)
  if (error) throw error
}

export async function fetchDashboard(): Promise<DashboardData> {
  const [customers, { deliveries }] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
    fetchDeliveries({ delivery_date: today(), limit: 1000 }),
  ])
  if (customers.error) throw customers.error

  return {
    total_customers: customers.count ?? 0,
    customers_served_today: new Set(deliveries.map((d) => d.customer_id)).size,
    total_jugs_today: deliveries.reduce((s, d) => s + d.jug_count, 0),
    recent_entries: deliveries.slice(0, 20),
  }
}
