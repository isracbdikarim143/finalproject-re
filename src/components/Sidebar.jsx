import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Dumbbell, Apple, TrendingUp, User, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'

const Sidebar = () => {
  const location = useLocation()
  const { signOut } = useAuth()

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Dumbbell, label: 'Workouts', path: '/workouts' },
    { icon: Apple, label: 'Nutrition', path: '/nutrition' },
    { icon: TrendingUp, label: 'Progress', path: '/progress' },
    { icon: User, label: 'Profile', path: '/profile' },
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-white/90 backdrop-blur-lg border-r border-gray-200 z-30">
        <div className="flex flex-col flex-grow pt-8 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-6 mb-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
              HealthHub
            </h1>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path

              return (
                <Link key={item.path} to={item.path}>
                  <motion.div
                    whileHover={{ x: 4 }}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </motion.div>
                </Link>
              )
            })}
          </nav>

          <div className="px-4 mt-auto">
            <button
              onClick={signOut}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 rounded-xl hover:bg-red-50 transition-all"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200 z-50">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center text-xs font-medium transition-all ${
                  isActive ? 'text-teal-600' : 'text-gray-500'
                }`}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export default Sidebar
