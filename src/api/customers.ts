import { supabase } from "@/lib/supabase"

export interface Customer {
  id: number
  name: string
  phone?: string | null
  address?: string | null
  area?: string | null
  /** This customer's standing rate. Never null - a DB trigger copies the global default in. */
  default_jug_price: number
  is_active: boolean
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const COLLATOR = new Intl.Collator("gu", { sensitivity: "base", numeric: true })

export interface CustomerCreate {
  name: string
  phone?: string
  address?: string
  area?: string
  default_jug_price?: number
  notes?: string
}

export async function fetchCustomers(params?: {
  search?: string
  area?: string
  active?: boolean
  page?: number
  limit?: number
}) {
  const limit = params?.limit ?? 200
  const page = params?.page ?? 1

  let q = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .order("name")
    .range((page - 1) * limit, page * limit - 1)

  if (params?.active !== undefined) q = q.eq("is_active", params.active)
  if (params?.area) q = q.eq("area", params.area)
  if (params?.search) q = q.ilike("name", `%${params.search}%`)

  const { data, error, count } = await q
  if (error) throw error

  // Postgres' collation groups all Gujarati names after the Latin ones. Re-sort with a
  // Gujarati-aware collator so a mixed list reads naturally.
  // ponytail: sorts within the fetched page only - fine at ~150, revisit if `limit` is ever hit.
  const customers = ((data ?? []) as Customer[]).sort((a, b) => COLLATOR.compare(a.name, b.name))

  return { customers, total: count ?? 0 }
}

export async function fetchCustomer(id: number) {
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).single()
  if (error) throw error
  return data as Customer
}

export async function createCustomer(payload: CustomerCreate) {
  const { data, error } = await supabase.from("customers").insert(payload).select().single()
  if (error) throw error
  return data as Customer
}

export async function updateCustomer(id: number, payload: Partial<CustomerCreate>) {
  const { data, error } = await supabase
    .from("customers")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data as Customer
}

/** Reprice every customer, including ones with a negotiated rate. Deliberately blunt. */
export async function applyPriceToAll(price: number) {
  const { error } = await supabase
    .from("customers")
    .update({ default_jug_price: price, updated_at: new Date().toISOString() })
    .gt("id", 0)
  if (error) throw error
}

export async function bulkCreateCustomers(rows: CustomerCreate[]) {
  const { error } = await supabase.from("customers").insert(rows)
  if (error) throw error
  return rows.length
}

/** Lowercased names of every customer, active or not - used to skip re-imports. */
export async function fetchCustomerNames() {
  const { data, error } = await supabase.from("customers").select("name").limit(5000)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.name.trim().toLowerCase()))
}

/** Soft delete - keeps delivery history intact. */
export async function deleteCustomer(id: number) {
  const { error } = await supabase.from("customers").update({ is_active: false }).eq("id", id)
  if (error) throw error
}
