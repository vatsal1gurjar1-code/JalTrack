import type { User as SupabaseUser } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

export interface User {
  id: string
  username: string
  name: string
}

// Supabase Auth logs in by email; the owner types a bare username. Supabase's email
// validator rejects made-up TLDs, so accounts are created under a real domain.
const AUTH_DOMAIN = "gmail.com"
const toEmail = (username: string) =>
  username.includes("@") ? username.trim() : `${username.trim().toLowerCase()}@${AUTH_DOMAIN}`

export function toUser(u: SupabaseUser): User {
  const username = (u.email ?? "").split("@")[0]
  return { id: u.id, username, name: u.user_metadata?.name ?? username }
}

export async function login(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toEmail(username),
    password,
  })
  if (error) throw error
  return toUser(data.user)
}

export function logout() {
  return supabase.auth.signOut()
}
