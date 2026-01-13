import { Component } from 'react'
import { AlertCircle } from 'lucide-react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full border border-white/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <h1 className="text-2xl font-bold text-white">Application Error</h1>
            </div>
            
            <div className="bg-black/20 rounded-lg p-4 mb-4">
              <p className="text-red-300 font-semibold mb-2">Something went wrong:</p>
              <p className="text-white/80 text-sm font-mono break-all">
                {this.state.error?.message || 'Unknown error occurred'}
              </p>
            </div>

            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="bg-black/20 rounded-lg p-4 mb-4">
                <summary className="text-white/80 cursor-pointer text-sm font-semibold mb-2">
                  Stack Trace (Dev Mode Only)
                </summary>
                <pre className="text-xs text-white/60 overflow-auto max-h-64 font-mono">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="space-y-2 text-sm text-white/80">
              <p className="font-semibold">Common fixes:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Check if Supabase environment variables are set in Vercel Dashboard</li>
                <li>Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct</li>
                <li>Check browser console for more details (F12)</li>
                <li>Check Vercel Function Logs for build errors</li>
              </ul>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
