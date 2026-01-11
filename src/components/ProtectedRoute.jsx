import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, isMobileDevice } from '../lib/supabaseClient'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  // Additional session check with mobile-specific delay
  useEffect(() => {
    const checkSession = async () => {
      try {
        // MOBILE FIX: 1000ms delay for mobile devices, 300ms for desktop
        // This ensures mobile browsers have enough time to initialize Supabase client
        // and retrieve the token from localStorage before we check
        const isMobile = isMobileDevice()
        const delay = isMobile ? 1000 : 300 // 1 second for mobile, 300ms for desktop
        console.log(`🔍 ProtectedRoute: Checking session after ${delay}ms delay (${isMobile ? 'Mobile' : 'Desktop'})`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('ProtectedRoute: Session check error:', error)
          setHasSession(false)
        } else {
          console.log('ProtectedRoute: Session check result:', !!session)
          setHasSession(!!session)
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

  // Show loading state while checking (including the delay)
  if (loading || !sessionChecked) {
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
  if (!user && !hasSession) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
