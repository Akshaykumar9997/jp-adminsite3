import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { publicConfigurationError } from './public-config'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigurationError = publicConfigurationError(
  supabaseUrl,
  supabasePublishableKey,
)

export const supabase = supabaseConfigurationError
  ? null
  : createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        persistSession: true,
      },
    })
