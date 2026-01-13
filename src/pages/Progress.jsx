import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { TrendingUp, Target, Award, Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import toast from 'react-hot-toast'

const Progress = () => {
  const { user, profile } = useAuth()
  const [workoutStats, setWorkoutStats] = useState([])
  const [nutritionStats, setNutritionStats] = useState([])
  const [weightHistory, setWeightHistory] = useState([])
  const [milestones, setMilestones] = useState([])
  const [activityDetails, setActivityDetails] = useState({}) // Store detailed activity data for tooltips

  useEffect(() => {
    if (!user?.id) return

    const userId = user.id // Safe after null check
    loadProgressData()

    // Real-time subscriptions for workout_logs and nutrition
    const workoutChannel = supabase
      .channel('progress-workout-logs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_logs',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadProgressData()
        }
      )
      .subscribe()

    const nutritionChannel = supabase
      .channel('progress-nutrition')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nutrition',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadProgressData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(workoutChannel)
      supabase.removeChannel(nutritionChannel)
    }
  }, [user?.id])

  const loadProgressData = async () => {
    if (!user?.id) return

    try {
      // CORE REBUILD: Load from activity_logs for detailed tooltip data
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      thirtyDaysAgo.setHours(0, 0, 0, 0)

      // Try activity_logs first, fallback to individual tables
      const [activityLogsResult, workoutsResult, nutritionResult] = await Promise.allSettled([
        supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true }),
        
        supabase
          .from('workout_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true }),
        
        supabase
          .from('nutrition')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true }),
      ])

      // Process activity_logs (primary source with detailed data)
      let activities = []
      let safeWorkouts = []
      let safeNutrition = []
      
      if (activityLogsResult.status === 'fulfilled' && activityLogsResult.value.data) {
        activities = activityLogsResult.value.data
      } else {
        // Fallback to individual tables
        if (workoutsResult.status === 'fulfilled' && workoutsResult.value.data) {
          safeWorkouts = workoutsResult.value.data
        }
        if (nutritionResult.status === 'fulfilled' && nutritionResult.value.data) {
          safeNutrition = nutritionResult.value.data
        }
      }

      // CORE REBUILD: Store detailed activity data by date for tooltips
      // Use consistent date formatting function
      const formatDateForMap = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
      
      const detailsMap = {}
      
      // Process activities from activity_logs
      activities.forEach((activity) => {
        const date = formatDateForMap(activity.created_at)
        if (!detailsMap[date]) {
          detailsMap[date] = []
        }
        detailsMap[date].push({
          type: activity.activity_type,
          name: activity.activity_name || activity.activity_type,
          calories: activity.calories || 0,
          amount: activity.amount || 0,
          duration: activity.metadata?.duration_mins || activity.amount || 0,
          time: new Date(activity.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        })
      })

      // Process fallback data
      safeWorkouts.forEach((workout) => {
        const date = formatDateForMap(workout.created_at)
        if (!detailsMap[date]) {
          detailsMap[date] = []
        }
        detailsMap[date].push({
          type: 'workout',
          name: workout.workout_type || 'Workout',
          calories: workout.calories_burned || 0,
          amount: workout.duration_mins || 0,
          duration: workout.duration_mins || 0,
          time: new Date(workout.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        })
      })

      safeNutrition.forEach((item) => {
        const date = formatDateForMap(item.created_at)
        if (!detailsMap[date]) {
          detailsMap[date] = []
        }
        detailsMap[date].push({
          type: 'nutrition',
          name: item.food_name || 'Food',
          calories: item.calories || 0,
          amount: item.calories || 0,
          duration: 0,
          time: new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        })
      })

      setActivityDetails(detailsMap)

      // Aggregate stats by date using same date formatting
      const workoutMap = {}
      const nutritionMap = {}
      
      activities.forEach((activity) => {
        const date = formatDateForMap(activity.created_at)
        if (activity.activity_type === 'workout') {
          if (!workoutMap[date]) {
            workoutMap[date] = { date, workouts: 0, calories: 0 }
          }
          workoutMap[date].workouts += 1
          workoutMap[date].calories += activity.calories || 0
        } else if (activity.activity_type === 'nutrition') {
          if (!nutritionMap[date]) {
            nutritionMap[date] = { date, calories: 0 }
          }
          nutritionMap[date].calories += activity.calories || 0
        }
      })

      // Process fallback data
      safeWorkouts.forEach((workout) => {
        const date = formatDateForMap(workout.created_at)
        if (!workoutMap[date]) {
          workoutMap[date] = { date, workouts: 0, calories: 0 }
        }
        workoutMap[date].workouts += 1
        workoutMap[date].calories += workout.calories_burned || 0
      })

      safeNutrition.forEach((item) => {
        const date = formatDateForMap(item.created_at)
        if (!nutritionMap[date]) {
          nutritionMap[date] = { date, calories: 0 }
        }
        nutritionMap[date].calories += item.calories || 0
      })

      // Combine data
      const allDates = [...new Set([...Object.keys(workoutMap), ...Object.keys(nutritionMap)])].sort()

      const statsData = allDates.map((date) => ({
        date,
        workouts: workoutMap[date]?.workouts || 0,
        workoutCalories: workoutMap[date]?.calories || 0,
        nutritionCalories: nutritionMap[date]?.calories || 0,
        totalCalories: (workoutMap[date]?.calories || 0) + (nutritionMap[date]?.calories || 0),
      }))

      setWorkoutStats(statsData.slice(-7)) // Last 7 days
      setNutritionStats(Object.values(nutritionMap).slice(-7)) // Last 7 days

      // Calculate milestones
      const totalWorkouts = activities.filter(a => a.activity_type === 'workout').length + safeWorkouts.length
      const totalCalories = activities
        .filter(a => a.activity_type === 'workout')
        .reduce((sum, a) => sum + (a.calories || 0), 0) + 
        safeWorkouts.reduce((sum, w) => sum + (w.calories_burned || 0), 0)
      const allWorkoutDates = [
        ...activities.filter(a => a.activity_type === 'workout').map(a => new Date(a.created_at).toDateString()),
        ...safeWorkouts.map(w => new Date(w.created_at).toDateString())
      ]
      const totalDaysActive = new Set(allWorkoutDates).size

      const newMilestones = []
      if (totalWorkouts >= 10) newMilestones.push({ icon: Award, label: '10 Workouts Completed', color: 'from-green-500 to-emerald-500' })
      if (totalWorkouts >= 25) newMilestones.push({ icon: Award, label: '25 Workouts Completed', color: 'from-blue-500 to-cyan-500' })
      if (totalWorkouts >= 50) newMilestones.push({ icon: Award, label: '50 Workouts Completed', color: 'from-purple-500 to-pink-500' })
      if (totalCalories >= 1000) newMilestones.push({ icon: Target, label: '1000 Calories Burned', color: 'from-orange-500 to-red-500' })
      if (totalDaysActive >= 7) newMilestones.push({ icon: Calendar, label: '7 Active Days', color: 'from-teal-500 to-blue-500' })

      setMilestones(newMilestones)

      // Weight history
      if (profile?.weight_kg) {
        setWeightHistory([
          {
            date: profile.updated_at || profile.created_at,
            weight: profile.weight_kg,
          },
        ])
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        setWorkoutStats([])
        setNutritionStats([])
        setMilestones([])
        return
      }
      
      if (error.code !== 'PGRST116' && !error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        toast.error(`Failed to load progress data: ${error.message || 'Unknown error'}`)
      }
      setWorkoutStats([])
      setNutritionStats([])
      setMilestones([])
    }
  }

  const totalWorkouts = workoutStats.reduce((sum, day) => sum + day.workouts, 0)
  const totalCalories = workoutStats.reduce((sum, day) => sum + day.workoutCalories, 0)

  // Generate 7 days of data if empty to show chart structure
  const chartData = workoutStats.length > 0 ? workoutStats : Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      workouts: 0,
      workoutCalories: 0,
      nutritionCalories: 0,
      totalCalories: 0,
    }
  })

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <TrendingUp className="w-10 h-10 text-teal-600" />
          Progress & Analytics
        </h1>
        <p className="text-gray-600 mt-2">Track your fitness journey and achievements</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
          <h3 className="text-sm text-gray-600 mb-1">Total Workouts</h3>
          <p className="text-3xl font-bold text-gray-900">{totalWorkouts}</p>
          <p className="text-sm text-gray-500 mt-1">Last 7 days</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
          <h3 className="text-sm text-gray-600 mb-1">Calories Burned</h3>
          <p className="text-3xl font-bold text-orange-600">{totalCalories} kcal</p>
          <p className="text-sm text-gray-500 mt-1">Last 7 days</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
          <h3 className="text-sm text-gray-600 mb-1">Current BMI</h3>
          {profile?.height_cm && profile?.weight_kg ? (
            <>
              <p className="text-3xl font-bold text-teal-600">
                {(() => {
                  const heightM = parseFloat(profile.height_cm) / 100
                  const weightKg = parseFloat(profile.weight_kg)
                  const bmi = weightKg / (heightM * heightM)
                  return bmi.toFixed(1)
                })()}
              </p>
              <p className="text-sm text-gray-500 mt-1">Height: {profile.height_cm}cm, Weight: {profile.weight_kg}kg</p>
            </>
          ) : (
            <p className="text-gray-500">Complete your profile</p>
          )}
        </div>
      </div>

      {/* Activity Chart - Always render with real data */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
        <h2 className="text-xl font-bold text-gray-900 mb-6">7-Day Activity Overview</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis dataKey="date" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                padding: '12px',
              }}
              cursor={{ stroke: '#14b8a6', strokeWidth: 2 }}
              // MOBILE SUPPORT: Enable touch events for mobile tap
              allowEscapeViewBox={{ x: false, y: true }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  // CORE REBUILD: Get activity details for the hovered date
                  const dateDetails = activityDetails[label] || []
                  const dataPoint = payload[0]?.payload
                  
                  return (
                    <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-200 max-w-xs">
                      <p className="font-bold text-gray-900 mb-2">{label}</p>
                      {dateDetails.length > 0 ? (
                        <div className="space-y-2">
                          {dateDetails.map((detail, idx) => (
                            <div key={idx} className="text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                              <div className="flex items-start gap-2">
                                <span className={`font-semibold ${
                                  detail.type === 'workout' ? 'text-teal-600' :
                                  detail.type === 'nutrition' ? 'text-orange-600' :
                                  'text-blue-600'
                                }`}>
                                  {detail.type === 'workout' ? '💪' : detail.type === 'nutrition' ? '🍎' : '💧'} {detail.type}:
                                </span>
                                <span className="text-gray-700 flex-1">{detail.name}</span>
                              </div>
                              <div className="text-gray-600 text-xs mt-1 ml-6">
                                {detail.type === 'water' ? `${detail.amount}ml` : 
                                 detail.type === 'workout' ? `${detail.duration || detail.amount} min • ${detail.calories} kcal` :
                                 `${detail.calories} kcal`}
                                {' • '}
                                <span className="text-gray-500">{detail.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm">
                          <p className="text-gray-600 mb-1">Workouts: {dataPoint?.workouts || 0}</p>
                          <p className="text-gray-600">Calories: {dataPoint?.workoutCalories || 0} kcal</p>
                        </div>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="workouts" stroke="#14b8a6" strokeWidth={3} dot={{ fill: '#14b8a6', r: 6 }} name="Workouts" />
            <Line type="monotone" dataKey="workoutCalories" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 6 }} name="Calories Burned" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Achievements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {milestones.map((milestone, index) => {
              const Icon = milestone.icon
              return (
                <div
                  key={index}
                  className={`bg-gradient-to-r ${milestone.color} rounded-2xl shadow-lg p-6 text-white`}
                >
                  <Icon className="w-8 h-8 mb-3" />
                  <h3 className="text-lg font-semibold">{milestone.label}</h3>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {milestones.length === 0 && (
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-12 border border-white/20 text-center">
          <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Keep Going!</h3>
          <p className="text-gray-600">Complete more workouts to unlock achievements and milestones.</p>
        </div>
      )}
    </div>
  )
}

export default Progress
