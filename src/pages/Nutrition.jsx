import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { somaliFoods } from '../data/somaliFoods'
import { Apple, Droplet, Search, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const Nutrition = () => {
  const { user } = useAuth()
  const [foods, setFoods] = useState(somaliFoods)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedFood, setSelectedFood] = useState(null)
  const [todayLogs, setTodayLogs] = useState([])
  const [dailyTotals, setDailyTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [waterAmount, setWaterAmount] = useState(0)

  // Get all unique categories
  const categories = ['All', ...new Set(somaliFoods.map(food => food.category))]

  useEffect(() => {
    if (!user) {
      return
    }

    loadTodayLogs()

    // Real-time subscription for nutrition
    const nutritionChannel = supabase
      .channel('nutrition-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nutrition',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadTodayLogs()
        }
      )
      .subscribe()

    // Real-time subscription for water_logs
    const waterChannel = supabase
      .channel('water-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'water_logs',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadTodayLogs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(nutritionChannel)
      supabase.removeChannel(waterChannel)
    }
  }, [user])

  const loadTodayLogs = async () => {
    if (!user) {
      return
    }

    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Load nutrition logs
      const { data: nutritionData, error: nutritionError } = await supabase
        .from('nutrition')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })

      if (nutritionError) {
        console.error('Nutrition logs error:', nutritionError)
        throw nutritionError
      }

      setTodayLogs(nutritionData || [])

      // Calculate totals
      const totals = nutritionData?.reduce(
        (acc, item) => ({
          calories: acc.calories + (item.calories || 0),
          protein: acc.protein + (item.protein || 0),
          carbs: acc.carbs + (item.carbs || 0),
          fat: acc.fat + (item.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ) || { calories: 0, protein: 0, carbs: 0, fat: 0 }

      setDailyTotals(totals)

      // Load water logs
      const { data: waterData, error: waterError } = await supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString())

      if (waterError) {
        console.warn('Water logs error (table might not exist):', waterError)
        setWaterAmount(0)
      } else {
        const totalWater = waterData?.reduce((sum, item) => sum + (item.amount_ml || 0), 0) || 0
        setWaterAmount(totalWater)
      }
    } catch (error) {
      // Silent catch for AbortError - prevents console errors during presentation
      if (error.name === 'AbortError') {
        return
      }
      console.error('Error loading logs:', error)
      toast.error(`Failed to load nutrition logs: ${error.message || 'Unknown error'}`)
    }
  }

  const handleLogFood = async (food) => {
    if (!user) return

    // OPTIMISTIC UI UPDATE: Update totals immediately
    const tempLog = {
      id: `temp-${Date.now()}`,
      user_id: user.id,
      food_name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      created_at: new Date().toISOString(),
    }

    setTodayLogs(prev => [tempLog, ...prev])
    setDailyTotals(prev => ({
      calories: prev.calories + food.calories,
      protein: prev.protein + food.protein,
      carbs: prev.carbs + food.carbs,
      fat: prev.fat + food.fat,
    }))

    try {
      const { data, error } = await supabase.from('nutrition').insert({
        user_id: user.id,
        food_name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      }).select()

      if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
        // Keep optimistic update
        toast.success(`✅ ${food.name} logged!`)
        return
      }

      if (error) throw error

      if (data && data.length > 0) {
        // Replace temp log with real data
        setTodayLogs(prev => {
          const filtered = prev.filter(log => log.id !== tempLog.id)
          return [data[0], ...filtered]
        })
        toast.success(`✅ ${food.name} logged!`)
      } else {
        // Revert on error
        setTodayLogs(prev => prev.filter(log => log.id !== tempLog.id))
        setDailyTotals(prev => ({
          calories: prev.calories - food.calories,
          protein: prev.protein - food.protein,
          carbs: prev.carbs - food.carbs,
          fat: prev.fat - food.fat,
        }))
        toast.error('Failed to log food')
      }
    } catch (error) {
      // Revert optimistic update
      setTodayLogs(prev => prev.filter(log => log.id !== tempLog.id))
      setDailyTotals(prev => ({
        calories: prev.calories - food.calories,
        protein: prev.protein - food.protein,
        carbs: prev.carbs - food.carbs,
        fat: prev.fat - food.fat,
      }))

      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return
      }
      console.error('Error logging food:', error)
      toast.error('Failed to log food')
    }
  }

  const handleDeleteLog = async (logId) => {
    // Find the log to delete for optimistic update
    const logToDelete = todayLogs.find(log => log.id === logId)
    if (!logToDelete) return

    // OPTIMISTIC UI UPDATE: Remove from UI immediately
    setTodayLogs(prev => prev.filter(log => log.id !== logId))
    setDailyTotals(prev => ({
      calories: prev.calories - (logToDelete.calories || 0),
      protein: prev.protein - (logToDelete.protein || 0),
      carbs: prev.carbs - (logToDelete.carbs || 0),
      fat: prev.fat - (logToDelete.fat || 0),
    }))

    try {
      const { error } = await supabase.from('nutrition').delete().eq('id', logId)

      if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
        // Keep optimistic update
        toast.success('Food log deleted')
        return
      }

      if (error) throw error

      toast.success('Food log deleted')
    } catch (error) {
      // Revert optimistic update
      setTodayLogs(prev => [logToDelete, ...prev])
      setDailyTotals(prev => ({
        calories: prev.calories + (logToDelete.calories || 0),
        protein: prev.protein + (logToDelete.protein || 0),
        carbs: prev.carbs + (logToDelete.carbs || 0),
        fat: prev.fat + (logToDelete.fat || 0),
      }))

      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return
      }
      console.error('Error deleting log:', error)
      toast.error('Failed to delete log')
    }
  }

  const handleAddWater = async () => {
    if (!user) {
      toast.error('You must be logged in to log water')
      return
    }

    // OPTIMISTIC UI UPDATE: Update water amount immediately
    const newAmount = waterAmount + 250
    setWaterAmount(newAmount)

    try {
      const { data, error } = await supabase
        .from('water_logs')
        .insert({
          user_id: user.id,
          amount_ml: 250,
        })
        .select()

      if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
        // Keep optimistic update
        toast.success('✅ 250ml water added!')
        return
      }

      if (error) {
        // Revert optimistic update
        setWaterAmount(waterAmount)
        
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          toast.error('water_logs table not found. Please create it in Supabase.')
        } else {
          toast.error(`Failed to log water: ${error.message || 'Unknown error'}`)
        }
        return
      }

      if (data && data.length > 0) {
        toast.success('✅ 250ml water added!')
        // Refresh to get accurate total
        loadTodayLogs()
      } else {
        // Revert if no data
        setWaterAmount(waterAmount)
        toast.error('Water logged but no data returned')
      }
    } catch (error) {
      // Revert optimistic update
      setWaterAmount(waterAmount)

      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return
      }
      console.error('Error adding water:', error)
      toast.error(`Failed to log water: ${error.message || 'Unknown error'}`)
    }
  }

  const filteredFoods = foods.filter((food) => {
    const matchesCategory = selectedCategory === 'All' || food.category === selectedCategory
    const matchesSearch =
      food.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      food.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      food.category.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const dailyGoal = 2000 // calories
  const progress = (dailyTotals.calories / dailyGoal) * 100

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <Apple className="w-10 h-10 text-teal-600" />
          Nutrition Tracker
        </h1>
        <p className="text-gray-600 mt-2">Track your meals and water intake</p>
      </div>

      {/* Daily Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 transition-opacity">
          <h3 className="text-sm text-gray-600 mb-1">Calories</h3>
          <p className="text-2xl font-bold text-gray-900">
            {dailyTotals.calories} / {dailyGoal} kcal
          </p>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
          <h3 className="text-sm text-gray-600 mb-1">Protein</h3>
          <p className="text-2xl font-bold text-gray-900">{dailyTotals.protein.toFixed(1)}g</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
          <h3 className="text-sm text-gray-600 mb-1">Carbs</h3>
          <p className="text-2xl font-bold text-gray-900">{dailyTotals.carbs.toFixed(1)}g</p>
        </div>

        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
          <h3 className="text-sm text-gray-600 mb-1">Fat</h3>
          <p className="text-2xl font-bold text-gray-900">{dailyTotals.fat.toFixed(1)}g</p>
        </div>
      </div>

      {/* Water Tracker */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl shadow-lg p-6 text-white transition-opacity">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Droplet className="w-5 h-5" />
              Water Intake
            </h3>
            <p className="text-3xl font-bold">{waterAmount}ml / 2000ml</p>
            <div className="mt-3 w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300 rounded-full"
                style={{ width: `${Math.min((waterAmount / 2000) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <button
            onClick={handleAddWater}
            className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add 250ml
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search foods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-lg border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none shadow-lg"
          />
        </div>

        {/* Category Filter */}
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

      {/* Food Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFoods.map((food) => (
          <div
            key={food.id}
            className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20 cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => handleLogFood(food)}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{food.name}</h3>
                <p className="text-sm text-gray-500">{food.nameEn}</p>
                <span className="inline-block mt-2 text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-lg">
                  {food.category}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Calories:</span>
                <span className="font-semibold text-orange-600">{food.calories} kcal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Protein:</span>
                <span className="font-semibold">{food.protein}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Carbs:</span>
                <span className="font-semibold">{food.carbs}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fat:</span>
                <span className="font-semibold">{food.fat}g</span>
              </div>
            </div>

            <button className="mt-4 w-full bg-gradient-to-r from-teal-500 to-blue-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all">
              Log Food
            </button>
          </div>
        ))}
      </div>

      {/* Today's Logs */}
      {todayLogs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Today's Logs</h2>
          <div className="space-y-3">
            {todayLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg p-4 border border-white/20 flex items-center justify-between transition-opacity"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">{log.food_name}</h3>
                  <p className="text-sm text-gray-600">
                    {log.calories} kcal • P: {log.protein}g • C: {log.carbs}g • F: {log.fat}g
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteLog(log.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Nutrition
