import { createClient } from '@supabase/supabase-js'

// Explicitly read environment variables using import.meta.env (Vite standard)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Comprehensive environment variable check
console.log('🔍 Environment Check:', {
  mode: import.meta.env.MODE,
  prod: import.meta.env.PROD,
  dev: import.meta.env.DEV,
  urlExists: !!supabaseUrl,
  keyExists: !!supabaseAnonKey,
  urlLength: supabaseUrl?.length || 0,
  keyLength: supabaseAnonKey?.length || 0,
})

// Enhanced error logging for production debugging
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = '❌ Supabase environment variables are missing!'
  console.error(errorMsg)
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? `✅ Set (${supabaseUrl.substring(0, 30)}...)` : '❌ Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set (hidden for security)' : '❌ Missing')
  console.error('📍 Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in:')
  console.error('   Vercel Dashboard > Project > Settings > Environment Variables')
  console.error('   Make sure to enable for: Production, Preview, and Development')
  
  if (import.meta.env.PROD) {
    console.error('⚠️ Production build detected. Environment variables MUST be set in Vercel.')
  }
} else {
  console.log('✅ Supabase environment variables are configured correctly')
}

// Create client with fallback (will show errors in console but won't crash)
// This allows the app to render and show error messages to users
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // Recommended for production
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Export a check function for debugging
export const checkSupabaseConfig = () => {
  return {
    urlConfigured: !!supabaseUrl,
    keyConfigured: !!supabaseAnonKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'Not set',
    urlLength: supabaseUrl?.length || 0,
    keyLength: supabaseAnonKey?.length || 0,
    isProduction: import.meta.env.PROD,
    mode: import.meta.env.MODE,
  }
}
