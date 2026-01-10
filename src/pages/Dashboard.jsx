import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Flame, Droplet, Activity, Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({
    calories: 0,
    water: 0,
    workouts: 0,
  })
  const [activityData, setActivityData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Use refs to track component mount status and abort controllers
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef(null)
  const channelsRef = useRef([])

  useEffect(() => {
    isMountedRef.current = true
    
    return () => {
      // Cleanup on unmount
      isMountedRef.current = false
      
      // Abort any ongoing fetch requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      // Remove all real-time channels
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel)
      })
      channelsRef.current = []
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      if (isMountedRef.current) {
        setLoading(false)
        setError('User not authenticated')
      }
      return
    }

    loadDashboardData()

    // Real-time subscription for nutrition
    const nutritionChannel = supabase
      .channel(`nutrition-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nutrition',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (isMountedRef.current) {
            loadDashboardData()
          }
        }
      )
      .subscribe()

    // Real-time subscription for workout_logs
    const workoutChannel = supabase
      .channel(`workout-log-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_logs',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (isMountedRef.current) {
            loadDashboardData()
          }
        }
      )
      .subscribe()

    // Real-time subscription for water_logs
    const waterChannel = supabase
      .channel(`water-log-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'water_logs',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (isMountedRef.current) {
            loadDashboardData()
          }
        }
      )
      .subscribe()

    channelsRef.current = [nutritionChannel, workoutChannel, waterChannel]

    return () => {
      // Cleanup channels on user change
      if (nutritionChannel) supabase.removeChannel(nutritionChannel)
      if (workoutChannel) supabase.removeChannel(workoutChannel)
      if (waterChannel) supabase.removeChannel(waterChannel)
      channelsRef.current = []
    }
  }, [user?.id])

  const loadDashboardData = async () => {
    if (!user?.id || !isMountedRef.current) {
      return
    }

    // Create new abort controller for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      if (isMountedRef.current) {
        setLoading(true)
        setError(null)
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      // Get user ID from auth context
      const userId = user.id

      // Get today's calories from nutrition table
      const nutritionQuery = supabase
        .from('nutrition')
        .select('calories')
        .eq('user_id', userId)
        .gte('created_at', todayISO)

      const { data: nutrition, error: nutritionError } = await nutritionQuery

      if (nutritionError) {
        console.error('Nutrition fetch error:', nutritionError)
        if (!nutritionError.message?.includes('relation') && !nutritionError.message?.includes('does not exist')) {
          throw nutritionError
        }
      }

      const totalCalories = nutrition?.reduce((sum, item) => sum + (item.calories || 0), 0) || 0

      // Get today's workout logs
      const workoutQuery = supabase
        .from('workout_logs')
        .select('calories_burned')
        .eq('user_id', userId)
        .gte('created_at', todayISO)

      const { data: workoutLogs, error: workoutError } = await workoutQuery

      if (workoutError) {
        console.warn('Workout logs fetch error (table might not exist):', workoutError.message)
        // Continue with other data if table doesn't exist
      }

      const workoutCalories = workoutLogs?.reduce((sum, item) => sum + (item.calories_burned || 0), 0) || 0
      const workoutCount = workoutLogs?.length || 0

      // Get today's water logs
      const waterQuery = supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_id', userId)
        .gte('created_at', todayISO)

      const { data: waterLogs, error: waterError } = await waterQuery

      if (waterError) {
        console.warn('Water logs fetch error (table might not exist):', waterError.message)
        // Continue with other data if table doesn't exist
      }

      const totalWater = waterLogs?.reduce((sum, item) => sum + (item.amount_ml || 0), 0) || 0

      // Check if component is still mounted before updating state
      if (!isMountedRef.current || abortController.signal.aborted) {
        return
      }

      setStats({
        calories: totalCalories + workoutCalories,
        water: totalWater,
        workouts: workoutCount,
      })

      // Load last 7 days activity
      await loadActivityData(userId)
      
      if (isMountedRef.current && !abortController.signal.aborted) {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      
      // Only update state if component is still mounted and not aborted
      if (isMountedRef.current && !abortController.signal.aborted) {
        const errorMessage = error.message || 'Unknown error'
        setError(`Failed to load dashboard data: ${errorMessage}`)
        setLoading(false)
        toast.error(`Failed to load dashboard data: ${errorMessage}`)
      }
    }
  }

  const loadActivityData = async (userId) => {
    if (!userId || !isMountedRef.current) return

    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      sevenDaysAgo.setHours(0, 0, 0, 0)

      const { data: nutrition, error: nutritionError } = await supabase
        .from('nutrition')
        .select('calories, created_at')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString())

      const { data: workoutLogs, error: workoutError } = await supabase
        .from('workout_logs')
        .select('calories_burned, created_at')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString())

      if (nutritionError && !nutritionError.message?.includes('relation')) {
        console.error('Nutrition activity error:', nutritionError)
      }

      if (workoutError && !workoutError.message?.includes('relation')) {
        console.warn('Workout logs activity error:', workoutError.message)
      }

      // Group by date
      const activityMap = {}
      const days = []

      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        days.push(dateStr)
        activityMap[dateStr] = 0
      }

      nutrition?.forEach((item) => {
        const date = new Date(item.created_at)
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (activityMap[dateStr] !== undefined) {
          activityMap[dateStr] += item.calories || 0
        }
      })

      workoutLogs?.forEach((item) => {
        const date = new Date(item.created_at)
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (activityMap[dateStr] !== undefined) {
          activityMap[dateStr] += item.calories_burned || 0
        }
      })

      const chartData = days.map((day) => ({
        day,
        calories: activityMap[day] || 0,
      }))

      if (isMountedRef.current) {
        setActivityData(chartData)
      }
    } catch (error) {
      console.error('Error loading activity data:', error)
      if (isMountedRef.current) {
        toast.error('Failed to load activity data')
      }
    }
  }

  const statCards = [
    {
      icon: Flame,
      label: 'Calories Burned',
      value: stats.calories,
      unit: 'kcal',
      color: 'from-orange-500 to-red-500',
    },
    {
      icon: Droplet,
      label: 'Water Intake',
      value: (stats.water / 1000).toFixed(1),
      unit: 'L',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Activity,
      label: 'Workouts Completed',
      value: stats.workouts,
      unit: 'today',
      color: 'from-green-500 to-emerald-500',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-gray-600">Please log in to view your dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="mb-6">
        <h2 className="text-sm text-gray-600 mb-1">Welcome back, {profile?.full_name || 'User'}</h2>
        <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <a href="#" className="text-sm text-teal-600 hover:text-teal-700 font-medium">
                  View all
                </a>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-1">
                {stat.value} <span className="text-lg text-gray-500 font-normal">{stat.unit}</span>
              </h3>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Activity Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Activity Overview</h2>
          <a href="#" className="text-sm text-teal-600 hover:text-teal-700 font-medium">
            View all statistics
          </a>
        </div>
        {activityData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="day" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="calories"
                stroke="#14b8a6"
                strokeWidth={3}
                dot={{ fill: '#14b8a6', r: 6 }}
                name="Calories"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-300 flex items-center justify-center text-gray-500">
            <p>No activity data available. Start logging your meals and workouts!</p>
          </div>
        )}
      </motion.div>

      {/* Quick Actions / Reminders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-r from-teal-500 to-blue-500 rounded-2xl shadow-lg p-6 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Don't forget</h3>
            <p className="text-teal-50 mb-2">Log your meals and workouts to track your progress</p>
            <button className="bg-white text-teal-600 px-4 py-2 rounded-lg font-medium hover:bg-teal-50 transition-all">
              Go to Nutrition
            </button>
          </div>
          <Calendar className="w-16 h-16 text-white/30" />
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard
