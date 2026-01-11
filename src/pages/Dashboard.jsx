import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Flame, Droplet, Activity, Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

const Dashboard = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    calories: 0,
    water: 0,
    workouts: 0,
  })
  const [activityData, setActivityData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      setError('User not authenticated')
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
          loadDashboardData()
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
          loadDashboardData()
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
          loadDashboardData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(nutritionChannel)
      supabase.removeChannel(workoutChannel)
      supabase.removeChannel(waterChannel)
    }
  }, [user?.id])

  const loadDashboardData = async () => {
    if (!user?.id) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()
      const userId = user.id

      // Get today's calories from nutrition table
      const { data: nutrition, error: nutritionError } = await supabase
        .from('nutrition')
        .select('calories')
        .eq('user_id', userId)
        .gte('created_at', todayISO)

      if (nutritionError && !nutritionError.message?.includes('relation') && !nutritionError.message?.includes('does not exist')) {
        console.error('Nutrition fetch error:', nutritionError)
      }

      const totalCalories = nutrition?.reduce((sum, item) => sum + (item.calories || 0), 0) || 0

      // Get today's workout logs
      const { data: workoutLogs, error: workoutError } = await supabase
        .from('workout_logs')
        .select('calories_burned')
        .eq('user_id', userId)
        .gte('created_at', todayISO)

      if (workoutError) {
        console.warn('Workout logs fetch error:', workoutError.message)
      }

      const workoutCalories = workoutLogs?.reduce((sum, item) => sum + (item.calories_burned || 0), 0) || 0
      const workoutCount = workoutLogs?.length || 0

      // Get today's water logs
      const { data: waterLogs, error: waterError } = await supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_id', userId)
        .gte('created_at', todayISO)

      if (waterError) {
        console.warn('Water logs fetch error:', waterError.message)
      }

      const totalWater = waterLogs?.reduce((sum, item) => sum + (item.amount_ml || 0), 0) || 0

      setStats({
        calories: totalCalories + workoutCalories,
        water: totalWater,
        workouts: workoutCount,
      })

      // Load last 7 days activity
      await loadActivityData(userId)
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      setError(`Failed to load dashboard data: ${error.message || 'Unknown error'}`)
      setLoading(false)
    }
  }

  const loadActivityData = async (userId) => {
    if (!userId) return

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

      setActivityData(chartData)
    } catch (error) {
      console.error('Error loading activity data:', error)
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
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      {/* Welcome Header - Responsive */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-xs md:text-sm text-gray-500 md:text-gray-600 mb-1">
          Welcome back, {profile?.full_name || 'User'}
        </h2>
        <h1 className="text-2xl md:text-4xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-50/90 backdrop-blur-sm border border-red-200/50 rounded-xl p-3 md:p-4 mb-4"
        >
          <p className="text-red-600 text-xs md:text-sm">{error}</p>
        </motion.div>
      )}

      {/* Stats Cards - Enhanced Glassmorphism */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl p-5 md:p-6 border border-white/30 hover:border-white/50 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] relative overflow-hidden"
            >
              {/* Glassmorphism overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                    <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <a href="#" className="text-xs md:text-sm text-teal-600 hover:text-teal-700 font-medium opacity-70 hover:opacity-100 transition-opacity">
                    View all
                  </a>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
                  {stat.value} <span className="text-sm md:text-lg text-gray-500 font-normal">{stat.unit}</span>
                </h3>
                <p className="text-xs md:text-sm text-gray-600 font-medium">{stat.label}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Activity Chart - Enhanced Glassmorphism */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl p-4 md:p-6 border border-white/30 hover:border-white/50 transition-all duration-300"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6 gap-2">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">Activity Overview</h2>
          <a href="#" className="text-xs md:text-sm text-teal-600 hover:text-teal-700 font-medium">
            View all statistics
          </a>
        </div>
        {activityData.length > 0 ? (
          <div className="w-full" style={{ height: '250px', minHeight: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" opacity={0.5} />
                <XAxis 
                  dataKey="day" 
                  stroke="#6b7280" 
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  stroke="#6b7280" 
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
                    padding: '12px',
                  }}
                  labelStyle={{ color: '#1f2937', fontWeight: 'bold' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
                />
                <Line
                  type="monotone"
                  dataKey="calories"
                  stroke="#14b8a6"
                  strokeWidth={3}
                  dot={{ fill: '#14b8a6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }}
                  name="Calories"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-gray-500 p-4">
            <p className="text-sm md:text-base text-center">No activity data available. Start logging your meals and workouts!</p>
          </div>
        )}
      </motion.div>

      {/* Quick Actions / Reminders - Enhanced Glassmorphism */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-r from-teal-500 via-blue-500 to-teal-600 rounded-2xl shadow-xl p-5 md:p-6 text-white relative overflow-hidden border border-white/20"
      >
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-base md:text-lg font-semibold mb-1">Don't forget</h3>
            <p className="text-teal-50/90 mb-3 text-sm md:text-base">Log your meals and workouts to track your progress</p>
            <button 
              onClick={() => navigate('/nutrition')}
              className="bg-white/95 text-teal-600 px-4 py-2 rounded-lg font-medium hover:bg-white transition-all shadow-lg hover:shadow-xl text-sm md:text-base"
            >
              Go to Nutrition
            </button>
          </div>
          <Calendar className="w-12 h-12 md:w-16 md:h-16 text-white/30 flex-shrink-0" />
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard
