import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, checkSupabaseConfig } from '../lib/supabaseClient'
import { Mail, Lock, LogIn } from 'lucide-react'
import { motion } from 'framer-motion'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()
  const navigate = useNavigate()

  // Check Supabase configuration on mount
  useEffect(() => {
    const config = checkSupabaseConfig()
    if (!config.valid) {
      console.error('❌ Login: Supabase not configured')
      setError('Database connection failed. Please check Vercel environment variables.')
      setLoading(false)
    } else {
      console.log('✅ Login: Supabase configured correctly')
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('🔐 Login form submitted')
    
    // Check Supabase configuration before attempting login
    const config = checkSupabaseConfig()
    if (!config.valid || !isSupabaseConfigured) {
      console.error('❌ Login: Supabase credentials missing')
      setError('Database connection failed. Please check Vercel environment variables.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    // Check environment variables before attempting login
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Environment variables missing')
      setError('Database connection configuration is missing. Please check Vercel environment variables.')
      setLoading(false)
      return
    }

    console.log('✅ Environment variables found, attempting login...')
    console.log('📧 Email:', email)

    try {
      console.log('🚀 Calling signIn function...')
      const result = await signIn(email, password)
      console.log('📥 signIn result:', { user: !!result.user, error: result.error?.message })

      if (result.error) {
        console.error('❌ Login error:', result.error)
        // Error is already shown via toast in AuthContext
        if (result.error.message?.includes('Network error') || result.error.message?.includes('Failed to fetch')) {
          setError('Cannot connect to database. Please check your connection and Vercel settings.')
        } else if (result.error.message?.includes('credentials missing') || result.error.code === 'ENV_MISSING') {
          setError('Database connection failed. Please check Vercel environment variables.')
        } else if (result.error.type === 'EMAIL_NOT_CONFIRMED') {
          setError('Please check your email and confirm your account before logging in.')
        } else {
          setError('Invalid email or password. Please try again.')
        }
        setLoading(false)
        return
      }

      if (result.user && !result.error) {
        console.log('✅ Login successful, user:', result.user.id)
        console.log('🧭 Navigating to /dashboard...')
        
        // Small delay to ensure session is established
        setTimeout(() => {
          console.log('🧭 Navigation triggered')
          navigate('/dashboard', { replace: true })
        }, 100)
        
        // Ensure loading is set to false
        setLoading(false)
        return
      }

      // Fallback: no user returned
      console.warn('⚠️ No user returned from signIn')
      setError('Login failed. Please try again.')
      setLoading(false)
    } catch (err) {
      console.error('❌ Login form exception:', err)
      
      // Check if it's a Supabase config error
      if (err?.message?.includes('credentials missing') || err?.code === 'ENV_MISSING') {
        setError('Database connection failed. Please check Vercel environment variables.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-teal-50 p-3 md:p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
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
                {error.includes('Database connection') && (
                  <p className="text-red-500 text-xs mt-2">
                    Check browser console (F12) for detailed error information.
                  </p>
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

            <motion.button
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
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
            </motion.button>
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
      </motion.div>
    </div>
  )
}

export default Login
