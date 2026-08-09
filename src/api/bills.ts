import { supabase } from "@/lib/supabase"

/** customer_id -> when their bill for this month was last sent. */
export async function fetchSentBills(month: string) {
  const { data, error } = await supabase
    .from("bill_sends")
    .select("customer_id, sent_at")
    .eq("month", month)
    .limit(5000)
  if (error) throw error
  return new Map<number, string>((data ?? []).map((r) => [r.customer_id, r.sent_at]))
}

/** Idempotent per (customer, month) - re-sending just refreshes the timestamp. */
export async function markBillSent(customerId: number, month: string) {
  const { error } = await supabase
    .from("bill_sends")
    .upsert(
      { customer_id: customerId, month, sent_at: new Date().toISOString() },
      { onConflict: "customer_id,month" }
    )
  if (error) throw error
}

export async function unmarkBillSent(customerId: number, month: string) {
  const { error } = await supabase
    .from("bill_sends")
    .delete()
    .eq("customer_id", customerId)
    .eq("month", month)
  if (error) throw error
}
