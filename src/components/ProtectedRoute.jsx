import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, isMobileDevice } from '../lib/supabaseClient'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  // Session check with mobile-specific delay, but render immediately once session is found
  useEffect(() => {
    const checkSession = async () => {
      try {
        const isMobile = isMobileDevice()
        const delay = isMobile ? 1000 : 300 // 1 second for mobile, 300ms for desktop
        console.log(`🔍 ProtectedRoute: Checking session after ${delay}ms delay (${isMobile ? 'Mobile' : 'Desktop'})`)
        
        // Check session immediately first (no delay for initial check)
        let { data: { session }, error } = await supabase.auth.getSession()
        
        if (session) {
          // INSTANT RENDER: If session exists immediately, render children right away
          console.log('✅ ProtectedRoute: Session found immediately, rendering children')
          setHasSession(true)
          setSessionChecked(true)
          return // Exit early - no need to wait
        }
        
        // Only wait if no session found initially (might still be loading)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // Check again after delay
        const { data: { session: delayedSession }, error: delayedError } = await supabase.auth.getSession()
        if (delayedError) {
          console.error('ProtectedRoute: Session check error:', delayedError)
          setHasSession(false)
        } else {
          console.log('ProtectedRoute: Session check result after delay:', !!delayedSession)
          setHasSession(!!delayedSession)
        }
      } catch (err) {
        console.error('ProtectedRoute: Session check exception:', err)
        setHasSession(false)
      } finally {
        setSessionChecked(true)
      }
    }

    checkSession()
  }, [])

  // If we have a session immediately, render children without waiting
  if (hasSession && sessionChecked) {
    return children
  }

  // Show loading state only if we haven't checked yet AND AuthContext is still loading
  if (loading && !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Check both user from context AND session from Supabase (for mobile)
  if (!user && !hasSession && sessionChecked) {
    return <Navigate to="/login" replace />
  }

  // If we have user from context, render immediately (don't wait for session check)
  if (user) {
    return children
  }

  // Still checking, show loading
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return children
}

export default ProtectedRoute
