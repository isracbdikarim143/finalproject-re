import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if Supabase is configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      toast.error('Database connection failed: Environment variables missing')
      setLoading(false)
      return
    }

    // Get initial session with error handling
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
          setLoading(false)
          return
        }
        
        if (error) {
          toast.error(`Failed to get session: ${error.message || 'Unknown error'}`)
          setLoading(false)
          return
        }
        
        setUser(session?.user ?? null)
        if (session?.user) {
          loadProfile(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
          setLoading(false)
          return
        }
        toast.error(`Failed to initialize auth: ${error.message || 'Unknown error'}`)
        setLoading(false)
      })

    // Listen for auth changes with error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        setUser(session?.user ?? null)
        
        if (session?.user) {
          // Set loading to false first to allow navigation, then load profile in background
          setLoading(false)
          await loadProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      } catch (error) {
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
          setLoading(false)
          return
        }
        toast.error(`Auth state change error: ${error.message || 'Unknown error'}`)
        setLoading(false)
      }
    })

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
        setLoading(false)
        return
      }

      if (error && error.code !== 'PGRST116') {
        toast.error(`Failed to load profile: ${error.message || 'Unknown error'}`)
      } else {
        setProfile(data)
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        setLoading(false)
        return
      }
      toast.error(`Failed to load profile: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
        return { user: null, error }
      }

      if (error) {
        toast.error(`Sign up failed: ${error.message || 'Unknown error'}`)
        throw error
      }

      if (data.user) {
        // Create profile
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: fullName,
              last_sign_in_at: new Date().toISOString(),
            })

          if (profileError && !(profileError.name === 'AbortError' || profileError.message?.includes('aborted'))) {
            toast.error(`Profile creation failed: ${profileError.message || 'Unknown error'}`)
          }
        } catch (profileErr) {
          if (!(profileErr.name === 'AbortError' || profileErr.message?.includes('aborted'))) {
            toast.error(`Profile creation failed: ${profileErr.message || 'Unknown error'}`)
          }
        }

        toast.success('Welcome! ✅ Please check your email to confirm your account.')
        return { user: data.user, error: null }
      }
      
      toast.error('Sign up failed: No user returned')
      return { user: null, error: new Error('No user returned') }
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return { user: null, error }
      }
      toast.error(`Sign up failed: ${error.message || 'Unknown error'}`)
      return { user: null, error }
    }
  }

  const signIn = async (email, password) => {
    try {
      // Check if Supabase is configured before attempting login
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey) {
        const errorMsg = 'Database connection failed: Environment variables are missing. Please check Vercel settings.'
        toast.error('Database connection failed. Please contact support.', { duration: 5000 })
        return { user: null, error: new Error(errorMsg) }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
        return { user: null, error }
      }

      if (error) {
        // Handle specific error types
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.name === 'TypeError') {
          toast.error('Database connection failed. Please check your internet connection and try again.', { duration: 5000 })
          return { user: null, error: new Error('Network error: Failed to connect to database') }
        }
        
        // Handle email not confirmed
        if (error.message?.includes('Email not confirmed') || error.type === 'EMAIL_NOT_CONFIRMED') {
          toast.error('Please check your email and confirm your account before logging in.', { duration: 5000 })
          return { user: null, error: { ...error, type: 'EMAIL_NOT_CONFIRMED' } }
        }

        // Handle invalid credentials
        if (error.message?.includes('Invalid login credentials') || error.status === 400) {
          toast.error('Invalid email or password. Please try again.')
          return { user: null, error }
        }

        // Generic error
        toast.error(`Login failed: ${error.message || 'Unknown error'}`)
        throw error
      }

      if (data?.user) {
        // Update last sign in (non-blocking)
        try {
          await supabase
            .from('profiles')
            .update({ last_sign_in_at: new Date().toISOString() })
            .eq('id', data.user.id)
        } catch (profileError) {
          if (!(profileError.name === 'AbortError' || profileError.message?.includes('aborted'))) {
            // Silent fail - profile update is non-critical
          }
        }

        toast.success('Welcome back! ✅')
        return { user: data.user, error: null }
      }

      toast.error('Login failed: No user data returned')
      return { user: null, error: new Error('No user data returned') }
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return { user: null, error }
      }
      
      // Handle network/fetch errors specifically
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') || 
          error.message?.includes('fetch') ||
          error.name === 'TypeError') {
        const networkErrorMsg = 'Database connection failed. Please check: 1) Internet connection, 2) Vercel environment variables, 3) Supabase CORS settings.'
        toast.error(networkErrorMsg, { duration: 6000 })
        return { user: null, error: new Error('Network error: ' + error.message) }
      }

      toast.error(`Login failed: ${error.message || 'Unknown error'}`)
      return { user: null, error }
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      
      if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
        setLoading(false)
        return
      }
      
      if (error) {
        toast.error(`Failed to sign out: ${error.message || 'Unknown error'}`)
        setLoading(false)
        throw error
      }
      
      setUser(null)
      setProfile(null)
      toast.success('Logged out successfully')
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        setLoading(false)
        return
      }
      toast.error(`Failed to sign out: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates) => {
    if (!user?.id) {
      toast.error('You must be logged in to update profile')
      return { data: null, error: new Error('User not authenticated') }
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()

      if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
        setLoading(false)
        return { data: null, error }
      }

      if (error) {
        toast.error(`Failed to update profile: ${error.message || 'Unknown error'}`)
        setLoading(false)
        throw error
      }

      setProfile(data)
      return { data, error: null }
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        setLoading(false)
        return { data: null, error }
      }
      toast.error(`Failed to update profile: ${error.message || 'Unknown error'}`)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        loadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
