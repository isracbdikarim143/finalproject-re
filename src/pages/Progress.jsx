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
      // Load workout statistics (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      thirtyDaysAgo.setHours(0, 0, 0, 0)

      const { data: workouts, error: workoutError } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      // CRITICAL FIX: Silent catch for AbortError - allows charts to render even if request cancelled
      if (workoutError && (workoutError.name === 'AbortError' || workoutError.message?.includes('aborted'))) {
        // Continue with empty workouts array - don't block chart rendering
      } else if (workoutError) {
        // Silent fail - continue with empty workouts array
      }

      // Load nutrition statistics
      const { data: nutrition, error: nutritionError } = await supabase
        .from('nutrition')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      // CRITICAL FIX: Silent catch for AbortError - allows charts to render even if request cancelled
      if (nutritionError && (nutritionError.name === 'AbortError' || nutritionError.message?.includes('aborted'))) {
        // Continue with empty nutrition array - don't block chart rendering
      } else if (nutritionError) {
        // Silent fail - continue with empty nutrition array
      }

      // EMERGENCY FIX: Ensure workouts and nutrition are arrays even if aborted
      const safeWorkouts = workouts || []
      const safeNutrition = nutrition || []

      // Process workout stats by date
      const workoutMap = {}
      safeWorkouts.forEach((workout) => {
        const date = new Date(workout.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (!workoutMap[date]) {
          workoutMap[date] = { date, workouts: 0, calories: 0 }
        }
        workoutMap[date].workouts += 1
        workoutMap[date].calories += workout.calories_burned || 0
      })

      // Process nutrition stats by date
      const nutritionMap = {}
      safeNutrition.forEach((item) => {
        const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (!nutritionMap[date]) {
          nutritionMap[date] = { date, calories: 0, protein: 0, carbs: 0, fat: 0 }
        }
        nutritionMap[date].calories += item.calories || 0
        nutritionMap[date].protein += item.protein || 0
        nutritionMap[date].carbs += item.carbs || 0
        nutritionMap[date].fat += item.fat || 0
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
      const totalWorkouts = safeWorkouts.length
      const totalCalories = safeWorkouts.reduce((sum, w) => sum + (w.calories_burned || 0), 0)
      const totalDaysActive = new Set(safeWorkouts.map((w) => new Date(w.created_at).toDateString())).size

      const newMilestones = []
      if (totalWorkouts >= 10) newMilestones.push({ icon: Award, label: '10 Workouts Completed', color: 'from-green-500 to-emerald-500' })
      if (totalWorkouts >= 25) newMilestones.push({ icon: Award, label: '25 Workouts Completed', color: 'from-blue-500 to-cyan-500' })
      if (totalWorkouts >= 50) newMilestones.push({ icon: Award, label: '50 Workouts Completed', color: 'from-purple-500 to-pink-500' })
      if (totalCalories >= 1000) newMilestones.push({ icon: Target, label: '1000 Calories Burned', color: 'from-orange-500 to-red-500' })
      if (totalDaysActive >= 7) newMilestones.push({ icon: Calendar, label: '7 Active Days', color: 'from-teal-500 to-blue-500' })

      setMilestones(newMilestones)

      // Weight history (if weight_logs table exists, use it; otherwise use profile)
      if (profile?.weight_kg) {
        setWeightHistory([
          {
            date: profile.updated_at || profile.created_at,
            weight: profile.weight_kg,
          },
        ])
      }
    } catch (error) {
      // CRITICAL FIX: Silent catch for AbortError - prevents console errors and allows charts to render
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        // Set empty arrays but don't show error - charts can still render
        setWorkoutStats([])
        setNutritionStats([])
        setMilestones([])
        return
      }
      
      // Only show error toast for critical errors, not for missing tables
      if (error.code !== 'PGRST116' && !error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        toast.error(`Failed to load progress data: ${error.message || 'Unknown error'}`)
      }
      // Set empty arrays on error
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
