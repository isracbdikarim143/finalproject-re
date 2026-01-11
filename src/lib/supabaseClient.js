import { createClient } from '@supabase/supabase-js'

// Strictly read environment variables using import.meta.env (Vite standard)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// EMERGENCY DEBUG: Log environment variables
console.log('🔍 EMERGENCY DEBUG: Environment Variable Check')
console.log('  - import.meta.env.VITE_SUPABASE_URL exists:', !!import.meta.env.VITE_SUPABASE_URL)
console.log('  - import.meta.env.VITE_SUPABASE_ANON_KEY exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
console.log('  - supabaseUrl value:', supabaseUrl ? `${supabaseUrl.substring(0, 50)}...` : 'UNDEFINED')
console.log('  - supabaseAnonKey length:', supabaseAnonKey?.length || 0)
console.log('  - import.meta.env.MODE:', import.meta.env.MODE)
console.log('  - import.meta.env.PROD:', import.meta.env.PROD)
console.log('  - import.meta.env.DEV:', import.meta.env.DEV)

// Simplified redirect URL function - returns window.location.origin if available
const getRedirectUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://finalproject-re.vercel.app'
}

// Comprehensive environment variable check with detailed logging
const envCheck = {
  mode: import.meta.env.MODE,
  prod: import.meta.env.PROD,
  dev: import.meta.env.DEV,
  urlExists: !!supabaseUrl,
  keyExists: !!supabaseAnonKey,
  urlLength: supabaseUrl?.length || 0,
  keyLength: supabaseAnonKey?.length || 0,
  urlValue: supabaseUrl ? `${supabaseUrl.substring(0, 40)}...` : 'undefined',
  redirectUrl: typeof window !== 'undefined' ? window.location.origin : getRedirectUrl(),
}

console.log('🔍 Supabase Environment Check:', envCheck)

// Strict environment variable validation
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = '❌ CRITICAL: Supabase environment variables are missing!'
  console.error('='.repeat(60))
  console.error(errorMsg)
  console.error('='.repeat(60))
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? `✅ Set (${supabaseUrl.substring(0, 40)}...)` : '❌ MISSING')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set (hidden for security)' : '❌ MISSING')
  console.error('')
  console.error('📍 ACTION REQUIRED:')
  console.error('   1. Go to: https://vercel.com/dashboard')
  console.error('   2. Select your project')
  console.error('   3. Navigate to: Settings → Environment Variables')
  console.error('   4. Add: VITE_SUPABASE_URL (your Supabase project URL)')
  console.error('   5. Add: VITE_SUPABASE_ANON_KEY (your Supabase anon key)')
  console.error('   6. Enable for: Production, Preview, AND Development')
  console.error('   7. Click "Save" and redeploy your application')
  console.error('')
  console.error('Current redirect URL:', getRedirectUrl())
  console.error('Current origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A (SSR)')
  console.error('='.repeat(60))
  
  if (import.meta.env.PROD) {
    console.error('⚠️ Production build detected. Database connection will FAIL without these variables!')
  }
} else {
  console.log('✅ Supabase environment variables are configured correctly')
  console.log('📍 Supabase URL:', supabaseUrl.substring(0, 40) + '...')
  console.log('📍 Redirect URL:', typeof window !== 'undefined' ? window.location.origin : getRedirectUrl())
}

// Validate URL format
if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
  console.error('❌ Invalid Supabase URL format. Must start with https://')
  console.error('Current URL:', supabaseUrl)
}

// Validate key format (should be a JWT token)
if (supabaseAnonKey && !supabaseAnonKey.startsWith('eyJ')) {
  console.warn('⚠️ Supabase anon key format may be incorrect. Expected JWT token starting with "eyJ"')
}

// Create Supabase client with fallback (TEMPORARY - for debugging)
const finalSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co'
const finalSupabaseKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Cannot initialize Supabase client: Missing required environment variables')
  console.error('⚠️ Using placeholder values - database will NOT work!')
}

export const supabase = createClient(
  finalSupabaseUrl,
  finalSupabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      redirectTo: typeof window !== 'undefined' ? window.location.origin : getRedirectUrl(),
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
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      error: 'Environment variables are missing',
      details: {
        urlConfigured: !!supabaseUrl,
        keyConfigured: !!supabaseAnonKey,
      },
    }
  }

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
    redirectUrl: typeof window !== 'undefined' ? window.location.origin : getRedirectUrl(),
    urlValid: supabaseUrl?.startsWith('https://') || false,
    keyValid: supabaseAnonKey?.startsWith('eyJ') || false,
    envUrl: import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing',
    envKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
  }
}
