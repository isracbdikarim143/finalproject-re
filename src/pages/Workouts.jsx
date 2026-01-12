import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { workouts } from '../data/workouts'
import { Dumbbell, CheckCircle, Search, Play, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const Workouts = () => {
  const { user } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [completedWorkouts, setCompletedWorkouts] = useState([])
  const [todayWorkouts, setTodayWorkouts] = useState([])
  const [completingId, setCompletingId] = useState(null)
  const [error, setError] = useState(null)

  const categories = ['All', 'Chest', 'Legs', 'Abs', 'Cardio', 'Arms']

  useEffect(() => {
    if (!user?.id) {
      setError('User not authenticated')
      return
    }

    loadTodayWorkouts()
  }, [user?.id])

  const loadTodayWorkouts = async () => {
    if (!user?.id) {
      return
    }

    try {
      setError(null)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const userId = user.id

      const { data, error: fetchError } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error loading workout logs:', fetchError)
        if (
          fetchError.code === 'PGRST116' ||
          fetchError.message?.includes('relation') ||
          fetchError.message?.includes('does not exist')
        ) {
          const errorMsg = 'workout_logs table not found. Please create it in Supabase.'
          setError(errorMsg)
          toast.error(errorMsg)
          console.error(
            'SUPABASE FIX: Create workout_logs table with columns: id (uuid, primary key, default uuid_generate_v4()), user_id (uuid, references auth.users(id)), workout_type (text), duration_mins (integer), calories_burned (integer), created_at (timestamp, default now())'
          )
          setTodayWorkouts([])
          setCompletedWorkouts([])
        } else {
          throw fetchError
        }
      } else {
        setTodayWorkouts(data || [])
        setCompletedWorkouts(data?.map((w) => w.workout_type || w.workout_name || w.name) || [])
      }
    } catch (error) {
      // Silent catch for AbortError - prevents console errors during presentation
      if (error.name === 'AbortError') {
        return
      }
      console.error('Error loading workouts:', error)
      setError(`Failed to load workouts: ${error.message || 'Unknown error'}`)
      toast.error(`Failed to load workouts: ${error.message || 'Unknown error'}`)
    }
  }

  const handleCompleteWorkout = async (workout) => {
    if (!user?.id) {
      toast.error('You must be logged in to complete a workout')
      return
    }

    if (completingId === workout.id || completedWorkouts.includes(workout.name)) {
      return
    }

    // OPTIMISTIC UI UPDATE: Update UI immediately before database call
    const newWorkout = {
      id: `temp-${Date.now()}`,
      user_id: user.id,
      workout_type: workout.name,
      duration_mins: workout.duration || 0,
      calories_burned: workout.calories || 0,
      created_at: new Date().toISOString(),
    }
    
    setTodayWorkouts(prev => [newWorkout, ...prev])
    setCompletedWorkouts(prev => [...prev, workout.name])
    setCompletingId(workout.id)

    try {
      const userId = user.id

      const { data, error: insertError } = await supabase
        .from('workout_logs')
        .insert({
          user_id: userId,
          workout_type: workout.name,
          duration_mins: workout.duration || 0,
          calories_burned: workout.calories || 0,
        })
        .select()

      // Silent catch for AbortError
      if (insertError && (insertError.name === 'AbortError' || insertError.message?.includes('aborted'))) {
        // Keep optimistic update even if aborted
        return
      }

      if (insertError) {
        // Revert optimistic update on error
        setTodayWorkouts(prev => prev.filter(w => w.id !== newWorkout.id))
        setCompletedWorkouts(prev => prev.filter(name => name !== workout.name))
        
        if (
          insertError.code === 'PGRST116' ||
          insertError.message?.includes('relation') ||
          insertError.message?.includes('does not exist')
        ) {
          toast.error('workout_logs table not found. Please create it in Supabase.')
        } else if (insertError.code === '23503') {
          toast.error('User not found. Please log out and log back in.')
        } else if (insertError.code === '42501') {
          toast.error('Permission denied. Please check RLS policies on workout_logs table.')
        } else {
          toast.error(`Failed to log workout: ${insertError.message || 'Unknown error'}`)
        }
        return
      }

      if (data && data.length > 0) {
        // Replace temp workout with real data
        setTodayWorkouts(prev => {
          const filtered = prev.filter(w => w.id !== newWorkout.id)
          return [data[0], ...filtered]
        })
        toast.success(`Great Job! ✅ You completed ${workout.name}!`)
      } else {
        // Revert if no data returned
        setTodayWorkouts(prev => prev.filter(w => w.id !== newWorkout.id))
        setCompletedWorkouts(prev => prev.filter(name => name !== workout.name))
        toast.error('Workout logged but no data returned')
      }
    } catch (error) {
      // Revert optimistic update on error
      setTodayWorkouts(prev => prev.filter(w => w.id !== newWorkout.id))
      setCompletedWorkouts(prev => prev.filter(name => name !== workout.name))
      
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return
      }
      console.error('Error completing workout:', error)
      toast.error(`Failed to log workout: ${error.message || 'Unknown error'}`)
    } finally {
      setCompletingId(null)
    }
  }

  const filteredWorkouts = workouts.filter((workout) => {
    const matchesCategory = selectedCategory === 'All' || workout.category === selectedCategory
    const matchesSearch =
      workout.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workout.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-700'
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-700'
      case 'Advanced':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }


  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <Dumbbell className="w-10 h-10 text-teal-600" />
          Workout Library
        </h1>
        <p className="text-gray-600 mt-2">Choose a workout and track your progress</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 transition-opacity">
          <h3 className="text-sm text-gray-600 mb-1">Today's Workouts</h3>
          <p className="text-3xl font-bold text-gray-900">{todayWorkouts.length}</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
          <h3 className="text-sm text-gray-600 mb-1">Calories Burned</h3>
          <p className="text-3xl font-bold text-orange-600">
            {todayWorkouts.reduce((sum, w) => sum + (w.calories_burned || 0), 0)} kcal
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
          <h3 className="text-sm text-gray-600 mb-1">Total Time</h3>
          <p className="text-3xl font-bold text-teal-600">
            {todayWorkouts.reduce((sum, w) => sum + (w.duration_mins || 0), 0)} min
          </p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search workouts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-lg border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none shadow-lg"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg'
                  : 'bg-white/80 backdrop-blur-lg text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Workout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWorkouts.map((workout) => {
          const isCompleted = completedWorkouts.includes(workout.name)
          const isCompleting = completingId === workout.id
          
          return (
            <div
              key={workout.id}
              className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{workout.name}</h3>
                  <span className={`inline-block text-xs px-2 py-1 rounded-lg ${getDifficultyColor(workout.difficulty)}`}>
                    {workout.difficulty}
                  </span>
                </div>
                {isCompleted && <CheckCircle className="w-6 h-6 text-green-500" />}
              </div>

              <p className="text-sm text-gray-600 mb-4">{workout.description}</p>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Sets</p>
                  <p className="font-semibold text-gray-900">{workout.sets}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Reps</p>
                  <p className="font-semibold text-gray-900">{workout.reps}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Duration</p>
                  <p className="font-semibold text-gray-900">{workout.duration} min</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Calories</p>
                  <p className="font-semibold text-orange-600">{workout.calories} kcal</p>
                </div>
              </div>

              <button
                onClick={() => handleCompleteWorkout(workout)}
                disabled={isCompleted || isCompleting}
                className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  isCompleted
                    ? 'bg-green-100 text-green-700 cursor-not-allowed'
                    : isCompleting
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:shadow-lg'
                }`}
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Completing...
                  </>
                ) : isCompleted ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Completed
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Complete Workout
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {filteredWorkouts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No workouts found. Try a different search or category.</p>
        </div>
      )}
    </div>
  )
}

export default Workouts
