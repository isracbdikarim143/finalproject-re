import { createClient } from '@supabase/supabase-js'

// Read environment variables
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// STEP 1: Env Var Check - Friendly error instead of crashing
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ CRITICAL: Supabase environment variables are missing!')
  console.error('   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file or Vercel settings.')
  console.error('   The app will continue but database features will not work.')
  // Don't throw - allow app to render with placeholder values
}

// MOBILE FIX: Force HTTPS protocol - mobile browsers sometimes strip the protocol
if (supabaseUrl && typeof supabaseUrl === 'string') {
  // Remove any existing protocol
  supabaseUrl = supabaseUrl.replace(/^https?:\/\//, '')
  // Force HTTPS
  supabaseUrl = `https://${supabaseUrl}`
  console.log('🔒 MOBILE FIX: Forced HTTPS protocol for Supabase URL')
}

// Simple logging
console.log('🔍 Supabase Client Initialization')
console.log('  - URL exists:', !!supabaseUrl)
console.log('  - Key exists:', !!supabaseAnonKey)
console.log('  - URL starts with https://:', supabaseUrl?.startsWith('https://'))

// Helper function to detect mobile user agent
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// MOBILE FIX: Force localStorage for mobile browsers (more reliable than cookies)
const storage = typeof window !== 'undefined' ? window.localStorage : null

// Standard Supabase client initialization with robust configuration
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      redirectTo: typeof window !== 'undefined' ? window.location.origin : 'https://finalproject-re.vercel.app',
      storage: storage,
      storageKey: 'sb-auth-token',
    },
    global: {
      headers: {
        'X-Client-Info': 'healthhub@1.0.0',
        'x-my-custom-header': 'my-app', // MOBILE FIX: Custom header can bypass mobile ISP 'transparent proxies' that interfere with database traffic
      },
      // EMERGENCY FIX: Global fetch wrapper with complete AbortError silence
      fetch: async (url, options = {}) => {
        try {
          const isMobile = isMobileDevice()
          const timeout = isMobile ? 15000 : 10000
          
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeout)
          
          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
            })
            
            clearTimeout(timeoutId)
            return response
          } catch (fetchError) {
            clearTimeout(timeoutId)
            // EMERGENCY FIX: Complete AbortError silence - ignore completely to prevent UI freeze
            if (fetchError?.name === 'AbortError' || fetchError?.message?.includes('aborted')) {
              // Return empty response that Supabase handles gracefully
              return new Response(null, { status: 408, statusText: 'Request Timeout' })
            }
            throw fetchError
          }
        } catch (error) {
          // EMERGENCY FIX: Double-layer AbortError protection
          if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
            return new Response(null, { status: 408, statusText: 'Request Timeout' })
          }
          throw error
        }
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
    isMobile: isMobileDevice(),
    urlValid: supabaseUrl?.startsWith('https://'),
  }
}

console.log('✅ Supabase client initialized with implicit flow and mobile optimizations')
