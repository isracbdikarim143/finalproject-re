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
    console.log('🔐 AuthContext: Initializing auth state listener')
    
    // Check if Supabase is configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase not configured - check environment variables')
      setLoading(false)
      return
    }

    // Get initial session with error handling
    console.log('🔐 AuthContext: Getting initial session...')
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        // Silent catch for AbortError - prevents console errors during presentation
        if (error && error.name === 'AbortError') {
          setLoading(false)
          return
        }
        
        if (error) {
          console.error('❌ AuthContext: Error getting session:', error)
          setLoading(false)
          return
        }
        
        console.log('✅ AuthContext: Initial session:', session ? `User: ${session.user?.id}` : 'No session')
        setUser(session?.user ?? null)
        if (session?.user) {
          console.log('🔐 AuthContext: Loading profile for user:', session.user.id)
          loadProfile(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch((error) => {
        // Silent catch for AbortError - prevents console errors during presentation
        if (error.name === 'AbortError') {
          setLoading(false)
          return
        }
        console.error('❌ AuthContext: Failed to initialize auth:', error)
        setLoading(false)
      })

    // Listen for auth changes with error handling
    console.log('🔐 AuthContext: Setting up onAuthStateChange listener...')
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 AuthContext: Auth state changed - Event:', event, 'Session:', session ? `User: ${session.user?.id}` : 'None')
      
      try {
        setUser(session?.user ?? null)
        
        if (session?.user) {
          console.log('✅ AuthContext: User authenticated, loading profile...')
          // Set loading to false first to allow navigation, then load profile in background
          setLoading(false)
          await loadProfile(session.user.id)
        } else {
          console.log('🔓 AuthContext: User signed out')
          setProfile(null)
          setLoading(false)
        }
      } catch (error) {
        // Silent catch for AbortError - prevents console errors during presentation
        if (error.name === 'AbortError') {
          setLoading(false)
          return
        }
        console.error('❌ AuthContext: Auth state change error:', error)
        setLoading(false)
      }
    })

    return () => {
      console.log('🔐 AuthContext: Cleaning up auth listener')
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const loadProfile = async (userId) => {
    console.log('👤 AuthContext: loadProfile called for user:', userId)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      // Silent catch for AbortError - prevents console errors during presentation
      if (error && error.name === 'AbortError') {
        return
      }

      if (error && error.code !== 'PGRST116') {
        console.error('❌ AuthContext: Error loading profile:', error)
        toast.error('Failed to load profile')
      } else {
        console.log('✅ AuthContext: Profile loaded:', data ? 'Success' : 'No profile found')
        setProfile(data)
      }
    } catch (error) {
      // Silent catch for AbortError - prevents console errors during presentation
      if (error.name === 'AbortError') {
        return
      }
      console.error('❌ AuthContext: loadProfile exception:', error)
    } finally {
      // Don't set loading here - it might block navigation
      // Loading is already set to false in onAuthStateChange
      console.log('👤 AuthContext: loadProfile completed')
    }
  }

  const signUp = async (email, password, fullName) => {
    console.log('📝 AuthContext: signUp called for:', email)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      // Silent catch for AbortError - prevents console errors during presentation
      if (error && error.name === 'AbortError') {
        return { user: null, error }
      }

      if (error) {
        console.error('❌ AuthContext: signUp error:', error)
        throw error
      }

      if (data.user) {
        console.log('✅ AuthContext: User created:', data.user.id)
        // Create profile
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: fullName,
              last_sign_in_at: new Date().toISOString(),
            })

          // Silent catch for AbortError - prevents console errors during presentation
          if (profileError && profileError.name === 'AbortError') {
            // Continue - profile creation is non-critical for signup flow
          } else if (profileError) {
            console.error('❌ AuthContext: Profile creation error:', profileError)
          } else {
            console.log('✅ AuthContext: Profile created')
          }
        } catch (profileErr) {
          // Silent catch for AbortError - prevents console errors during presentation
          if (profileErr.name !== 'AbortError') {
            console.error('❌ AuthContext: Profile creation exception:', profileErr)
          }
        }

        toast.success('Welcome! ✅ Please check your email to confirm your account.')
        return { user: data.user, error: null }
      }
      
      console.warn('⚠️ AuthContext: signUp - no user returned')
      return { user: null, error: new Error('No user returned') }
    } catch (error) {
      // Silent catch for AbortError - prevents console errors during presentation
      if (error.name === 'AbortError') {
        return { user: null, error }
      }
      console.error('❌ AuthContext: Sign up error:', error)
      toast.error(error.message || 'Failed to sign up')
      return { user: null, error }
    }
  }

  const signIn = async (email, password) => {
    console.log('🔐 AuthContext: signIn called for:', email)
    
    try {
      // Check if Supabase is configured before attempting login
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey) {
        const errorMsg = 'Database connection failed: Environment variables are missing. Please check Vercel settings.'
        console.error('❌ AuthContext: Login failed:', errorMsg)
        toast.error('Database connection failed. Please contact support.', { duration: 5000 })
        return { user: null, error: new Error(errorMsg) }
      }

      console.log('🚀 AuthContext: Calling supabase.auth.signInWithPassword...')
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('📥 AuthContext: signInWithPassword response:', { 
        hasUser: !!data?.user, 
        hasError: !!error,
        errorMessage: error?.message 
      })

      // Silent catch for AbortError - prevents console errors during presentation
      if (error && error.name === 'AbortError') {
        return { user: null, error }
      }

      if (error) {
        console.error('❌ AuthContext: Login error:', error)
        
        // Handle specific error types
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.name === 'TypeError') {
          console.error('❌ AuthContext: Network error during login:', error)
          toast.error('Database connection failed. Please check your internet connection and try again.', { duration: 5000 })
          return { user: null, error: new Error('Network error: Failed to connect to database') }
        }
        throw error
      }

      if (data?.user) {
        console.log('✅ AuthContext: Login successful, user ID:', data.user.id)
        
        // Update last sign in (non-blocking)
        try {
          await supabase
            .from('profiles')
            .update({ last_sign_in_at: new Date().toISOString() })
            .eq('id', data.user.id)
          console.log('✅ AuthContext: Last sign in updated')
        } catch (profileError) {
          // Silent catch for AbortError - prevents console errors during presentation
          if (profileError.name === 'AbortError') {
            // Continue - profile update is non-critical
          } else {
            console.warn('⚠️ AuthContext: Could not update last sign in:', profileError)
          }
        }

        toast.success('Welcome back! ✅')
        console.log('✅ AuthContext: Returning user from signIn')
        return { user: data.user, error: null }
      }

      console.warn('⚠️ AuthContext: No user data returned from signIn')
      return { user: null, error: new Error('No user data returned') }
    } catch (error) {
      // Silent catch for AbortError - prevents console errors during presentation
      if (error.name === 'AbortError') {
        return { user: null, error }
      }
      
      console.error('❌ AuthContext: Sign in error:', error)
      
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
    console.log('🔓 AuthContext: signOut called')
    try {
      const { error } = await supabase.auth.signOut()
      
      // Silent catch for AbortError - prevents console errors during presentation
      if (error && error.name === 'AbortError') {
        return
      }
      
      if (error) throw error
      toast.success('Signed out successfully')
      console.log('✅ AuthContext: Sign out successful')
    } catch (error) {
      // Silent catch for AbortError - prevents console errors during presentation
      if (error.name === 'AbortError') {
        return
      }
      console.error('❌ AuthContext: Sign out error:', error)
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

      // Silent catch for AbortError - prevents console errors during presentation
      if (error && error.name === 'AbortError') {
        return { data: null, error }
      }

      if (error) throw error

      setProfile(data)
      toast.success('Profile updated! ✅')
      return { data, error: null }
    } catch (error) {
      // Silent catch for AbortError - prevents console errors during presentation
      if (error.name === 'AbortError') {
        return { data: null, error }
      }
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
