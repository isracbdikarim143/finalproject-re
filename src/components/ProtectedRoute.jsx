import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  // Additional session check for mobile browsers
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Small delay to allow AuthContext to initialize
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('ProtectedRoute: Session check error:', error)
          setHasSession(false)
        } else {
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

  // Show loading state while checking
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
