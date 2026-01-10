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
      console.error('❌ Supabase not configured - check environment variables')
      setLoading(false)
      return
    }

    // Get initial session with error handling
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('Error getting session:', error)
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
        console.error('Failed to initialize auth:', error)
        setLoading(false)
      })

    // Listen for auth changes with error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      } catch (error) {
        console.error('Auth state change error:', error)
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

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error)
        toast.error('Failed to load profile')
      } else {
        setProfile(data)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
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

      if (error) throw error

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            full_name: fullName,
            last_sign_in_at: new Date().toISOString(),
          })

        if (profileError) {
          console.error('Profile creation error:', profileError)
        }

        toast.success('Welcome! ✅ Please check your email to confirm your account.')
        return { user: data.user, error: null }
      }
    } catch (error) {
      console.error('Sign up error:', error)
      toast.error(error.message || 'Failed to sign up')
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
        console.error('❌ Login failed:', errorMsg)
        toast.error('Database connection failed. Please contact support.', { duration: 5000 })
        return { user: null, error: new Error(errorMsg) }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Handle specific error types
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.name === 'TypeError') {
          console.error('❌ Network error during login:', error)
          toast.error('Database connection failed. Please check your internet connection and try again.', { duration: 5000 })
          return { user: null, error: new Error('Network error: Failed to connect to database') }
        }
        throw error
      }

      if (data.user) {
        // Update last sign in
        try {
          await supabase
            .from('profiles')
            .update({ last_sign_in_at: new Date().toISOString() })
            .eq('id', data.user.id)
        } catch (profileError) {
          // Non-critical error, just log it
          console.warn('Could not update last sign in:', profileError)
        }

        toast.success('Welcome back! ✅')
        return { user: data.user, error: null }
      }

      return { user: null, error: new Error('No user data returned') }
    } catch (error) {
      console.error('Sign in error:', error)
      
      // Handle network/fetch errors specifically
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') || 
          error.message?.includes('fetch') ||
          error.name === 'TypeError') {
        const networkErrorMsg = 'Database connection failed. Please check: 1) Internet connection, 2) Vercel environment variables, 3) Supabase CORS settings.'
        toast.error(networkErrorMsg, { duration: 6000 })
        return { user: null, error: new Error('Network error: ' + error.message) }
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
      toast.error(error.message || 'Failed to sign in. Please try again.')
      return { user: null, error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      toast.success('Signed out successfully')
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    }
  }

  const updateProfile = async (updates) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      toast.success('Profile updated! ✅')
      return { data, error: null }
    } catch (error) {
      console.error('Update profile error:', error)
      toast.error('Failed to update profile')
      return { data: null, error }
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
