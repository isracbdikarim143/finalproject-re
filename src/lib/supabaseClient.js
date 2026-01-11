import { createClient } from '@supabase/supabase-js'

// Read environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Simple logging
console.log('🔍 Supabase Client Initialization')
console.log('  - URL exists:', !!supabaseUrl)
console.log('  - Key exists:', !!supabaseAnonKey)

// Standard Supabase client initialization with session persistence enabled for mobile
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      persistSession: true, // ENABLED: Required for mobile browsers to remember session
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      redirectTo: typeof window !== 'undefined' ? window.location.origin : 'https://finalproject-re.vercel.app',
    },
    global: {
      headers: {
        'X-Client-Info': 'healthhub@1.0.0',
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)

// Test connection function
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1)
    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message, code: error.code }
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Connection failed',
      type: error.name,
    }
  }
}

// Export a check function for debugging
export const checkSupabaseConfig = () => {
  return {
    urlConfigured: !!supabaseUrl,
    keyConfigured: !!supabaseAnonKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 40)}...` : 'Not set',
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabaseAnonKey?.length || 0,
    isProduction: import.meta.env.PROD,
    mode: import.meta.env.MODE,
  }
}

console.log('✅ Supabase client initialized with session persistence enabled')
