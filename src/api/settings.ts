import { supabase } from "@/lib/supabase"

export async function fetchSettings() {
  const { data, error } = await supabase.from("settings").select("key, value")
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>
}

export async function updateSettings(values: Record<string, string | number>) {
  const rows = Object.entries(values).map(([key, value]) => ({ key, value: String(value) }))
  const { error } = await supabase.from("settings").upsert(rows)
  if (error) throw error
}
