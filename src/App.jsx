import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { checkSupabaseConfig, supabase } from './lib/supabaseClient'

// Pages
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Workouts from './pages/Workouts'
import Nutrition from './pages/Nutrition'
import Progress from './pages/Progress'
import Profile from './pages/Profile'

// Inner App component that can use hooks
const AppContent = () => {
  const navigate = useNavigate()

  // Comprehensive debug logging - ALWAYS runs in production too
  // This helps diagnose blank screen issues on Vercel
  useEffect(() => {
    console.log('🚀 App Component Mounted')
    console.log('📍 Environment Information:')
    console.log('  - MODE:', import.meta.env.MODE)
    console.log('  - PROD:', import.meta.env.PROD)
    console.log('  - DEV:', import.meta.env.DEV)
    
    const config = checkSupabaseConfig()
    console.log('🔧 Supabase Configuration Check:')
    console.log('  - URL Configured:', config.urlConfigured ? '✅ YES' : '❌ NO')
    console.log('  - Key Configured:', config.keyConfigured ? '✅ YES' : '❌ NO')
    console.log('  - URL Preview:', config.url)
    console.log('  - URL Length:', config.urlLength, 'characters')
    console.log('  - Key Length:', config.keyLength, 'characters')
    console.log('  - Production Mode:', config.isProduction ? 'YES' : 'NO')
    
    // Direct environment variable check
    console.log('🔍 Direct Env Variable Check:')
    console.log('  - VITE_SUPABASE_URL exists:', !!import.meta.env.VITE_SUPABASE_URL)
    console.log('  - VITE_SUPABASE_ANON_KEY exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
    console.log('  - VITE_SUPABASE_URL value:', import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL.substring(0, 40)}...` : 'undefined')
    
    if (!config.urlConfigured || !config.keyConfigured) {
      console.error('❌ CRITICAL: Supabase environment variables are missing!')
      console.error('📋 Action Required:')
      console.error('   1. Go to Vercel Dashboard')
      console.error('   2. Select your project: final-project-recat')
      console.error('   3. Navigate to: Settings > Environment Variables')
      console.error('   4. Add: VITE_SUPABASE_URL (your Supabase project URL)')
      console.error('   5. Add: VITE_SUPABASE_ANON_KEY (your Supabase anon key)')
      console.error('   6. Enable for: Production, Preview, and Development')
      console.error('   7. Redeploy your application')
    } else {
      console.log('✅ Environment variables are properly configured!')
    }

    // Clean Global Auth Listener: Redirect on SIGNED_IN event
    console.log('🔐 App: Setting up onAuthStateChange listener for redirect...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        // Silent catch for AbortError - prevents console errors during presentation
        if (event === 'SIGNED_IN' && session) {
          console.log('✅ App: SIGNED_IN event detected, redirecting to dashboard...')
          // Force redirect to dashboard when user signs in
          if (window.location.pathname !== '/dashboard') {
            window.location.href = '/dashboard'
          }
        }
      } catch (error) {
        // Silent catch for AbortError - prevents console errors during presentation
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
          return
        }
        console.error('❌ App: Auth state change error:', error)
      }
    })

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [navigate])

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/workouts"
          element={
            <ProtectedRoute>
              <Layout>
                <Workouts />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/nutrition"
          element={
            <ProtectedRoute>
              <Layout>
                <Nutrition />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <Layout>
                <Progress />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#333',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          },
          success: {
            iconTheme: {
              primary: '#14b8a6',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
