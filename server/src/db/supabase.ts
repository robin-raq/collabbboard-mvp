import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

if (!supabase) {
  console.warn('[DB] Supabase not configured — persistence disabled. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
}
