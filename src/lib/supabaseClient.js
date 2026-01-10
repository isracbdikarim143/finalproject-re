import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Enhanced error logging for production debugging
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = '❌ Supabase environment variables are missing!'
  console.error(errorMsg)
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing')
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel Dashboard > Settings > Environment Variables')
  
  // Show user-friendly error in production
  if (import.meta.env.PROD) {
    console.error('Production build detected. Check Vercel environment variables.')
  }
}

// Create client with fallback empty strings (will fail gracefully)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
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
  }
)

// Export a check function for debugging
export const checkSupabaseConfig = () => {
  return {
    urlConfigured: !!supabaseUrl,
    keyConfigured: !!supabaseAnonKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'Not set',
    isProduction: import.meta.env.PROD,
  }
}
