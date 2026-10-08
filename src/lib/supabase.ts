import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * The one connection to Supabase (database, sign-in and photograph files), or null when the
 * app has not been given a project and so runs as the demo.
 */
export const supabase = url && key ? createClient(url, key) : null
