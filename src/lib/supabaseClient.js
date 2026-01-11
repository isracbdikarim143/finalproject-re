import { createClient } from '@supabase/supabase-js'

// STRICT VALIDATION: Check environment variables FIRST before any initialization
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

// STRICT VALIDATION: Check if credentials are missing
const credentialsMissing = !supabaseUrl || !supabaseAnonKey

if (credentialsMissing) {
  const errorMsg = '❌ CRITICAL ERROR: Supabase credentials missing!'
  console.error('='.repeat(80))
  console.error(errorMsg)
  console.error('='.repeat(80))
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
  console.error('='.repeat(80))
}

// Simplified redirect URL function
const getRedirectUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://finalproject-re.vercel.app'
}

// Create Supabase client - use placeholder if credentials missing
let supabase
let isSupabaseConfigured = false

if (credentialsMissing) {
  // Create placeholder client that will fail gracefully
  console.error('⚠️ Creating placeholder Supabase client - database will NOT work!')
  supabase = createClient(
    'https://placeholder.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
  
  // Mark client as invalid
  supabase._invalid = true
  supabase._error = 'Supabase credentials missing'
  isSupabaseConfigured = false
} else {
  // Credentials are valid - create real client
  console.log('✅ Supabase credentials validated - initializing client...')
  supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
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
  supabase._invalid = false
  isSupabaseConfigured = true
  console.log('✅ Supabase client initialized successfully')
}

// Export the client
export { supabase }
export { isSupabaseConfigured }

// Test connection function
export const testConnection = async () => {
  if (credentialsMissing) {
    return {
      success: false,
      error: 'Supabase credentials missing',
      details: {
        urlConfigured: false,
        keyConfigured: false,
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

// Export validation function
export const validateSupabaseConfig = () => {
  return {
    valid: !credentialsMissing,
    urlConfigured: !!supabaseUrl,
    keyConfigured: !!supabaseAnonKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 40)}...` : 'Not set',
    error: credentialsMissing ? 'Supabase credentials missing' : null,
  }
}

// Export a check function for debugging
export const checkSupabaseConfig = () => {
  return {
    valid: !credentialsMissing,
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
