import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, isMobileDevice } from '../lib/supabaseClient'
import { Mail, Lock, LogIn, RefreshCw } from 'lucide-react'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      console.log('🔐 Login attempt started')
      console.log('📱 Device type:', isMobileDevice() ? 'Mobile' : 'Desktop')
      
      // DIAGNOSTIC MODE: Check Supabase configuration before login
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      console.log('🔍 Supabase Config Check:')
      console.log('  - URL exists:', !!supabaseUrl)
      console.log('  - URL starts with https://:', supabaseUrl?.startsWith('https://'))
      console.log('  - URL length:', supabaseUrl?.length || 0)
      console.log('  - Key exists:', !!supabaseKey)
      console.log('  - Key length:', supabaseKey?.length || 0)
      
      const result = await signIn(email, password)

      if (result.error) {
        console.error('❌ Login error:', result.error)
        
        // DIAGNOSTIC MODE: Log exact error object for mobile debugging
        console.error('📋 Full error object:', JSON.stringify(result.error, null, 2))
        console.error('📋 Error type:', result.error?.constructor?.name)
        console.error('📋 Error message:', result.error?.message)
        console.error('📋 Error code:', result.error?.code)
        console.error('📋 Error status:', result.error?.status)
        console.error('📋 Error name:', result.error?.name)
        console.error('📋 Error stack:', result.error?.stack)
        
        if (result.error.message?.includes('Network error') || result.error.message?.includes('Failed to fetch')) {
          setError('Cannot connect to database. Please check your connection and Vercel settings.')
        } else if (result.error.type === 'EMAIL_NOT_CONFIRMED') {
          setError('Please check your email and confirm your account before logging in.')
        } else {
          setError('Invalid email or password. Please try again.')
        }
        return
      }

      if (result.user && !result.error) {
        console.log('✅ Login successful, redirecting immediately...')
        
        // IMMEDIATE NAVIGATION: Navigate to dashboard right away
        // The onAuthStateChange listener in AuthContext will handle session updates
        setLoading(false)
        navigate('/dashboard', { replace: true })
        return
      }

      // Fallback: no user returned
      setError('Login failed. Please try again.')
    } catch (err) {
      // Silent catch for AbortError - prevents console errors during presentation
      if (err.name === 'AbortError') {
        setLoading(false)
        return
      }
      
      console.error('❌ Login exception:', err)
      // DIAGNOSTIC MODE: Log full exception details
      console.error('📋 Exception object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
      console.error('📋 Exception type:', err?.constructor?.name)
      console.error('📋 Exception message:', err?.message)
      console.error('📋 Exception stack:', err?.stack)
      
      setError('An unexpected error occurred. Please try again.')
    } finally {
      // FORCE loading off - this MUST run
      setLoading(false)
    }
  }

  const handleRetryConnection = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-teal-50 p-3 md:p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/30 hover:border-white/50 transition-all duration-300">
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">Welcome back</h1>
            <p className="text-sm sm:text-base text-gray-500">Welcome back! Please enter your details.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            {/* Error Message Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 md:p-4 mb-4">
                <p className="text-red-600 text-xs sm:text-sm font-medium">{error}</p>
                {error.includes('Cannot connect') && (
                  <button
                    onClick={handleRetryConnection}
                    className="mt-3 w-full bg-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-700 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry Connection
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 w-4 h-4" disabled={loading} />
                <span className="ml-2 text-xs sm:text-sm text-gray-600">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-xs sm:text-sm text-teal-600 hover:text-teal-700 font-medium">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-600 to-blue-600 text-white py-2.5 sm:py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Login
                </>
              )}
            </button>
          </form>

          <div className="mt-5 md:mt-6 text-center">
            <p className="text-xs sm:text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-teal-600 hover:text-teal-700 font-semibold">
                Sign up for free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
