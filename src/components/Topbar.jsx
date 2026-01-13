import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Search, Bell, User, X, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { workouts } from '../data/workouts'
import { somaliFoods } from '../data/somaliFoods'
import toast from 'react-hot-toast'

const Topbar = () => {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileDrawer, setShowProfileDrawer] = useState(false)
  const searchRef = useRef(null)
  const notificationRef = useRef(null)

  useEffect(() => {
    if (profile?.avatar_url) {
      loadAvatar(profile.avatar_url)
    }
  }, [profile])

  // CORE REBUILD: Fetch last activity from activity_logs
  useEffect(() => {
    if (!user?.id) return

    const loadLastActivity = async () => {
      try {
        // Try activity_logs first
        const { data: activityData } = await supabase
          .from('activity_logs')
          .select('activity_type, activity_name, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (activityData) {
          setLastActivity({
            type: activityData.activity_type,
            name: activityData.activity_name,
            time: new Date(activityData.created_at),
          })
          return
        }
      } catch (error) {
        // Fallback to workout_logs
        try {
          const { data: workoutData } = await supabase
            .from('workout_logs')
            .select('workout_type, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (workoutData) {
            setLastActivity({
              type: 'workout',
              name: workoutData.workout_type || 'Workout',
              time: new Date(workoutData.created_at),
            })
            return
          }
        } catch (workoutError) {
          // Silent fail
        }
      }
    }

    loadLastActivity()
    
    // Refresh last activity every 30 seconds
    const interval = setInterval(loadLastActivity, 30000)
    return () => clearInterval(interval)
  }, [user?.id])

  const loadAvatar = async (path) => {
    try {
      const { data } = await supabase.storage.from('avatars').getPublicUrl(path)
      if (data?.publicUrl) {
        setAvatarUrl(data.publicUrl)
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return
      }
      // Silent fail for avatar loading
    }
  }

  // CORE LOGIC: Track session time from login
  const [sessionTime, setSessionTime] = useState(0)
  const [loginTime, setLoginTime] = useState(null)
  const [lastLogin, setLastLogin] = useState('')
  const [lastLogout, setLastLogout] = useState('')
  const [lastActivity, setLastActivity] = useState(null)

  useEffect(() => {
    if (profile?.last_sign_in_at) {
      const lastLoginDate = new Date(profile.last_sign_in_at)
      setLoginTime(lastLoginDate)
      setLastLogin(lastLoginDate.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }))
    }
    
    if (profile?.logout_time) {
      const lastLogoutDate = new Date(profile.logout_time)
      setLastLogout(lastLogoutDate.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }))
    }

    // Update session time every minute
    const interval = setInterval(() => {
      if (loginTime) {
        const now = new Date()
        const diff = Math.floor((now - loginTime) / 1000 / 60) // minutes
        setSessionTime(diff)
      }
    }, 60000) // Update every minute

    // Initial calculation
    if (loginTime) {
      const now = new Date()
      const diff = Math.floor((now - loginTime) / 1000 / 60)
      setSessionTime(diff)
    }

    return () => clearInterval(interval)
  }, [profile?.last_sign_in_at, profile?.logout_time, loginTime])

  // Global search functionality
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    const query = searchQuery.toLowerCase().trim()
    const results = []

    // Search workouts
    workouts
      .filter((workout) =>
        workout.name.toLowerCase().includes(query) ||
        workout.description.toLowerCase().includes(query) ||
        workout.category.toLowerCase().includes(query)
      )
      .slice(0, 5)
      .forEach((workout) => {
        results.push({
          type: 'workout',
          id: workout.id,
          name: workout.name,
          description: workout.description,
          category: workout.category,
          data: workout,
        })
      })

    // Search foods
    somaliFoods
      .filter(
        (food) =>
          food.name.toLowerCase().includes(query) ||
          food.nameEn.toLowerCase().includes(query) ||
          food.category.toLowerCase().includes(query)
      )
      .slice(0, 5)
      .forEach((food) => {
        results.push({
          type: 'food',
          id: food.id,
          name: food.name,
          description: food.nameEn,
          category: food.category,
          data: food,
        })
      })

    setSearchResults(results)
    setShowResults(results.length > 0)
  }, [searchQuery])

  const profileRef = useRef(null)

  // Close search results and profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileDrawer(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSearchResultClick = (result) => {
    if (result.type === 'workout') {
      navigate('/workouts')
      toast.success(`Found workout: ${result.name}`)
    } else if (result.type === 'food') {
      navigate('/nutrition')
      toast.success(`Found food: ${result.name}`)
    }
    setSearchQuery('')
    setShowResults(false)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
  }

  return (
    <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-20 lg:ml-64">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Global Search */}
          <div className="flex-1 flex items-center max-w-lg relative" ref={searchRef}>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
              <input
                type="text"
                placeholder="Search workouts, foods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim().length > 0 && setShowResults(true)}
                className="w-full pl-10 pr-10 py-2 bg-white/80 backdrop-blur-lg border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-sm shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-lg border border-gray-200 rounded-xl shadow-xl max-h-96 overflow-y-auto z-50">
                <div className="p-2">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}-${index}`}
                      onClick={() => handleSearchResultClick(result)}
                      className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition-colors mb-1"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-700">
                              {result.type === 'workout' ? '💪 Workout' : '🍎 Food'}
                            </span>
                            <span className="text-sm font-bold text-gray-900">{result.name}</span>
                          </div>
                          <p className="text-xs text-gray-600 mb-1">{result.description}</p>
                          <span className="text-xs text-gray-500">{result.category}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {searchResults.length >= 10 && (
                  <div className="p-3 text-center text-xs text-gray-500 border-t border-gray-200">
                    Showing first 10 results. Refine your search for more specific results.
                  </div>
                )}
              </div>
            )}
            {showResults && searchResults.length === 0 && searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-lg border border-gray-200 rounded-xl shadow-xl p-4 z-50">
                <p className="text-sm text-gray-500 text-center">No results found for "{searchQuery}"</p>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4 ml-4">
            {/* Session Timer */}
            {sessionTime > 0 && (
              <div className="hidden md:block text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                <span className="font-medium">Active:</span> {sessionTime} min
              </div>
            )}

            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Notification Panel */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white/95 backdrop-blur-lg border border-gray-200 rounded-xl shadow-xl z-50 max-h-[400px] overflow-y-auto">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
                  </div>
                  <div className="p-4">
                    <div className="text-center text-gray-500 py-8">
                      <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">No new notifications</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setShowProfileDrawer(!showProfileDrawer)}
                className="flex items-center gap-3 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile?.full_name || 'User'}
                    className="w-10 h-10 rounded-full object-cover border-2 border-teal-500"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900">{profile?.full_name || user?.email || 'User'}</p>
                  {lastLogin && (
                    <p className="text-xs text-gray-500">Last login: {lastLogin}</p>
                  )}
                </div>
              </button>

              {/* Clean Dropdown Menu */}
              {showProfileDrawer && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white/95 backdrop-blur-lg border border-gray-200 rounded-xl shadow-xl z-50">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={profile?.full_name || 'User'}
                          className="w-12 h-12 rounded-full object-cover border-2 border-teal-500"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {profile?.full_name || user?.email || 'User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs text-gray-600 space-y-1.5 border-b border-gray-200 mb-2">
                      {lastLogin && (
                        <p className="flex justify-between">
                          <span className="font-semibold text-gray-700">Login Time:</span>
                          <span className="text-gray-600">{lastLogin}</span>
                        </p>
                      )}
                      {lastLogout && (
                        <p className="flex justify-between">
                          <span className="font-semibold text-gray-700">Logout Time:</span>
                          <span className="text-gray-600">{lastLogout}</span>
                        </p>
                      )}
                      {sessionTime > 0 && (
                        <p className="flex justify-between">
                          <span className="font-semibold text-gray-700">Session Duration:</span>
                          <span className="text-gray-600">{sessionTime} min</span>
                        </p>
                      )}
                      {lastActivity && (
                        <p className="pt-1 border-t border-gray-200 mt-1">
                          <span className="font-semibold text-gray-700 block mb-1">Last Activity:</span>
                          <span className="text-gray-600 text-xs">
                            {lastActivity.name} ({lastActivity.type})<br />
                            {lastActivity.time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setShowProfileDrawer(false)
                          // CORE REBUILD: Use AuthContext signOut which handles logout_time and redirect
                          await signOut()
                          // Redirect to login after successful logout
                          navigate('/login')
                        } catch (error) {
                          if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                            return
                          }
                          toast.error(`Failed to logout: ${error.message || 'Unknown error'}`)
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </header>
  )
}

export default Topbar
