import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, isMobileDevice } from '../lib/supabaseClient'
import { Flame, Droplet, Activity, Calendar, Target } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
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
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setError('User not authenticated')
      setLoading(false)
      return
    }

    const userId = user.id
    console.log('🚀 Dashboard: Setting up for user:', userId)
    
    // Initial load
    loadDashboardData()

    // FORCE REBUILD: Real-time subscriptions that ACTUALLY WORK
    console.log('📡 Dashboard: Setting up real-time subscriptions')
    
    const workoutChannel = supabase
      .channel(`dashboard-workouts-${userId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_logs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('🔔 Workout change detected:', payload)
          loadDashboardData()
        }
      )
      .subscribe((status) => {
        console.log('📡 Workout channel status:', status)
      })

    const nutritionChannel = supabase
      .channel(`dashboard-nutrition-${userId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nutrition',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('🔔 Nutrition change detected:', payload)
          loadDashboardData()
        }
      )
      .subscribe((status) => {
        console.log('📡 Nutrition channel status:', status)
      })

    const waterChannel = supabase
      .channel(`dashboard-water-${userId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'water_logs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('🔔 Water change detected:', payload)
          loadDashboardData()
        }
      )
      .subscribe((status) => {
        console.log('📡 Water channel status:', status)
      })

    return () => {
      console.log('🔌 Dashboard: Cleaning up subscriptions')
      supabase.removeChannel(workoutChannel)
      supabase.removeChannel(nutritionChannel)
      supabase.removeChannel(waterChannel)
    }
  }, [user?.id])

  const loadDashboardData = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setError(null)
      const userId = user.id
      const isMobile = isMobileDevice()
      
      // FORCE REBUILD: Get TODAY's date range (local timezone)
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      
      console.log('📊 Dashboard Query:', {
        userId,
        startOfToday: startOfToday.toISOString(),
        endOfToday: endOfToday.toISOString()
      })

      // FORCE REBUILD: Query workout_logs for today
      const { data: workoutData, error: workoutError } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startOfToday.toISOString())
        .lte('created_at', endOfToday.toISOString())

      // FORCE REBUILD: Query nutrition for today
      const { data: nutritionData, error: nutritionError } = await supabase
        .from('nutrition')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startOfToday.toISOString())
        .lte('created_at', endOfToday.toISOString())

      // FORCE REBUILD: Query water_logs for today
      const { data: waterData, error: waterError } = await supabase
        .from('water_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startOfToday.toISOString())
        .lte('created_at', endOfToday.toISOString())

      console.log('📊 Dashboard Results:', {
        workouts: workoutData?.length || 0,
        nutrition: nutritionData?.length || 0,
        water: waterData?.length || 0
      })

      // Calculate totals
      const workoutCalories = workoutData?.reduce((sum, w) => sum + (parseFloat(w.calories_burned) || 0), 0) || 0
      const nutritionCalories = nutritionData?.reduce((sum, n) => sum + (parseFloat(n.calories) || 0), 0) || 0
      const totalCalories = workoutCalories + nutritionCalories
      const totalWater = waterData?.reduce((sum, w) => sum + (parseFloat(w.amount_ml) || 0), 0) || 0
      const workoutCount = workoutData?.length || 0

      // FORCE UPDATE STATE
      setStats({
        calories: Math.round(totalCalories),
        water: Math.round(totalWater),
        workouts: workoutCount,
      })

      console.log('📊 Dashboard Stats Updated:', {
        calories: Math.round(totalCalories),
        water: Math.round(totalWater),
        workouts: workoutCount
      })

      // Load chart data (last 7 days)
      const activityDays = isMobile ? 5 : 7
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - activityDays)
      daysAgo.setHours(0, 0, 0, 0)

      const { data: historyData } = await supabase
        .from('workout_logs')
        .select('calories_burned, created_at')
        .eq('user_id', userId)
        .gte('created_at', daysAgo.toISOString())

      // Group by date
      const activityMap = {}
      const days = []

      for (let i = activityDays - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        days.push(dateStr)
        activityMap[dateStr] = 0
      }

      historyData?.forEach((item) => {
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
      setLoading(false)
    } catch (error) {
      console.error('❌ Dashboard Load Error:', error)
      setLoading(false)
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return
      }
      toast.error(`Failed to load dashboard: ${error.message}`)
      setError(error.message)
    }
  }

  // Calculate BMI for dashboard display
  const calculateBMI = (weightKg, heightCm) => {
    if (!weightKg || !heightCm) return null
    const heightM = parseFloat(heightCm) / 100
    const weight = parseFloat(weightKg)
    if (heightM <= 0 || weight <= 0) return null
    return (weight / (heightM * heightM)).toFixed(1)
  }

  const getBMICategory = (bmi) => {
    if (!bmi) return null
    const bmiValue = parseFloat(bmi)
    if (bmiValue < 18.5) return { label: 'Underweight', color: 'text-blue-600' }
    if (bmiValue < 25) return { label: 'Normal', color: 'text-green-600' }
    if (bmiValue < 30) return { label: 'Overweight', color: 'text-orange-600' }
    return { label: 'Obese', color: 'text-red-600' }
  }

  const userBMI = profile?.height_cm && profile?.weight_kg 
    ? calculateBMI(profile.weight_kg, profile.height_cm) 
    : null
  const bmiCategory = userBMI ? getBMICategory(userBMI) : null

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

  // REMOVED: Full-page loading spinner - Dashboard renders immediately
  // Only show error if user is not authenticated
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
        <div className="bg-red-50/90 backdrop-blur-sm border border-red-200/50 rounded-xl p-3 md:p-4 mb-4 transition-opacity">
          <p className="text-red-600 text-xs md:text-sm">{error}</p>
        </div>
      )}

      {/* Stats Cards - Enhanced Glassmorphism */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="group bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl p-5 md:p-6 border border-white/30 hover:border-white/50 transition-shadow hover:shadow-2xl relative overflow-hidden"
            >
              {/* Glassmorphism overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                    <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
                  {stat.value} <span className="text-sm md:text-lg text-gray-500 font-normal">{stat.unit}</span>
                </h3>
                <p className="text-xs md:text-sm text-gray-600 font-medium">{stat.label}</p>
              </div>
            </div>
          )
        })}
        
        {/* BMI Card */}
        {userBMI && bmiCategory && (
          <div className="group bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl p-5 md:p-6 border border-white/30 hover:border-white/50 transition-shadow hover:shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
                  <Target className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
                {userBMI} <span className="text-sm md:text-lg text-gray-500 font-normal">BMI</span>
              </h3>
              <p className={`text-xs md:text-sm font-medium ${bmiCategory.color}`}>{bmiCategory.label}</p>
            </div>
          </div>
        )}
      </div>

      {/* Activity Chart - Enhanced Glassmorphism */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl p-4 md:p-6 border border-white/30 hover:border-white/50 transition-opacity">
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
      </div>

      {/* Quick Actions / Reminders - Enhanced Glassmorphism */}
      <div className="bg-gradient-to-r from-teal-500 via-blue-500 to-teal-600 rounded-2xl shadow-xl p-5 md:p-6 text-white relative overflow-hidden border border-white/20 transition-opacity">
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
      </div>
    </div>
  )
}

export default Dashboard
