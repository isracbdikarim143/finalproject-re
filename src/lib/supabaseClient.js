import { createClient } from '@supabase/supabase-js'

// Read environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Simple logging
console.log('🔍 Supabase Client Initialization')
console.log('  - URL exists:', !!supabaseUrl)
console.log('  - Key exists:', !!supabaseAnonKey)

// MOBILE FIX: Validate URL format - ensure it starts with https://
const isValidUrl = supabaseUrl && typeof supabaseUrl === 'string' && supabaseUrl.startsWith('https://')
if (!isValidUrl && supabaseUrl) {
  console.error('⚠️ WARNING: VITE_SUPABASE_URL does not start with https://', supabaseUrl.substring(0, 50))
}

// Helper function to detect mobile user agent
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// MOBILE FIX: Force localStorage for mobile browsers (more reliable than cookies)
const storage = typeof window !== 'undefined' ? window.localStorage : null

// Standard Supabase client initialization with full session persistence for mobile
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      persistSession: true, // REQUIRED: Mobile browsers need this to hold login state
      autoRefreshToken: true, // REQUIRED: Mobile browsers need token refresh
      detectSessionInUrl: true, // REQUIRED: Mobile browsers need URL session detection
      flowType: 'pkce', // MOBILE FIX: PKCE is more reliable for mobile browsers (cross-origin auth)
      redirectTo: typeof window !== 'undefined' ? window.location.origin : 'https://finalproject-re.vercel.app',
      storage: storage, // EXPLICIT: Force localStorage for mobile reliability
      storageKey: 'sb-auth-token', // Default key, but explicit for clarity
    },
    global: {
      headers: {
        'X-Client-Info': 'healthhub@1.0.0',
      },
      // MOBILE FIX: Increase fetch timeout to 15 seconds for mobile networks
      fetch: (url, options = {}) => {
        const isMobile = isMobileDevice()
        const timeout = isMobile ? 15000 : 10000 // 15 seconds for mobile, 10 for desktop
        
        // Create AbortController for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        
        return fetch(url, {
          ...options,
          signal: controller.signal,
        })
          .then(response => {
            clearTimeout(timeoutId)
            return response
          })
          .catch(error => {
            clearTimeout(timeoutId)
            if (error.name === 'AbortError') {
              console.error('⏱️ Supabase request timeout after', timeout, 'ms')
              throw new Error(`Request timeout after ${timeout}ms. Please check your connection.`)
            }
            throw error
          })
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
    urlValid: isValidUrl,
  }
}

console.log('✅ Supabase client initialized with localStorage persistence and PKCE flow for mobile')
