import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { User, Mail, Target, Clock, LogOut, X } from 'lucide-react'

const ProfileDrawer = ({ isOpen, onClose }) => {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [sessionTime, setSessionTime] = useState(0)
  const [lastLogin, setLastLogin] = useState('')

  useEffect(() => {
    if (profile?.avatar_url) {
      loadAvatar(profile.avatar_url)
    }
  }, [profile])

  useEffect(() => {
    if (profile?.last_sign_in_at) {
      const lastLoginDate = new Date(profile.last_sign_in_at)
      setLastLogin(lastLoginDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))

      const interval = setInterval(() => {
        const now = new Date()
        const diff = Math.floor((now - lastLoginDate) / 1000 / 60) // minutes
        setSessionTime(diff)
      }, 60000) // Update every minute

      return () => clearInterval(interval)
    }
  }, [profile])

  const loadAvatar = async (path) => {
    try {
      const { data } = await supabase.storage.from('avatars').getPublicUrl(path)
      if (data?.publicUrl) {
        setAvatarUrl(data.publicUrl)
      }
    } catch (error) {
      console.error('Error loading avatar:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      onClose()
      navigate('/login')
    } catch (error) {
      // Silent fail for logout error
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Avatar & User Info */}
          <div className="flex flex-col items-center mb-6 pb-6 border-b border-gray-200">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile?.full_name || 'User'}
                className="w-24 h-24 rounded-full object-cover border-4 border-teal-500 shadow-lg mb-4"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center border-4 border-teal-500 shadow-lg mb-4">
                <User className="w-12 h-12 text-white" />
              </div>
            )}
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {profile?.full_name || user?.email || 'User'}
            </h3>
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {user?.email}
            </p>
          </div>

          {/* User Goal */}
          {profile?.goal && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-teal-600" />
                <h4 className="text-sm font-semibold text-gray-700">Fitness Goal</h4>
              </div>
              <p className="text-gray-600 pl-8">{profile.goal}</p>
            </div>
          )}

          {/* Session Info */}
          <div className="mb-6 pb-6 border-b border-gray-200 space-y-3">
            {lastLogin && (
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Login Time</p>
                  <p className="text-sm font-medium text-gray-900">{lastLogin}</p>
                </div>
              </div>
            )}
            {sessionTime > 0 && (
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Session Duration</p>
                  <p className="text-sm font-medium text-gray-900">{sessionTime} minutes</p>
                </div>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  )
}

export default ProfileDrawer
