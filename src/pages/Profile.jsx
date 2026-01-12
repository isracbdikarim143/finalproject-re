import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { User, Mail, Target, Clock, Upload, Save, Edit2, X } from 'lucide-react'
import toast from 'react-hot-toast'

const Profile = () => {
  const { user, profile, updateProfile, loadProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    height_cm: '',
    weight_kg: '',
    goal: '',
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: user?.email || '',
        height_cm: profile.height_cm || '',
        weight_kg: profile.weight_kg || '',
        goal: profile.goal || '',
      })
    } else if (user) {
      setFormData({
        full_name: user.user_metadata?.full_name || '',
        email: user.email || '',
        height_cm: '',
        weight_kg: '',
        goal: '',
      })
    }

    if (profile?.avatar_url) {
      loadAvatar(profile.avatar_url)
    }
  }, [profile, user])

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
      console.error('Error loading avatar:', error)
    }
  }

  const handleAvatarUpload = async (event) => {
    if (!user?.id) {
      toast.error('You must be logged in to upload an avatar')
      return
    }

    try {
      setUploading(true)
      const file = event.target.files?.[0]
      if (!file) return

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB')
        return
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = fileName

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        if (uploadError.name === 'AbortError' || uploadError.message?.includes('aborted')) {
          return
        }
        throw uploadError
      }

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: filePath })
        .eq('id', user.id)

      if (updateError) {
        if (updateError.name === 'AbortError' || updateError.message?.includes('aborted')) {
          return
        }
        throw updateError
      }

      // Load new avatar
      await loadAvatar(filePath)
      await loadProfile(user.id)
      toast.success('Avatar updated successfully! ✅')
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return
      }
      console.error('Error uploading avatar:', error)
      toast.error('Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return

    try {
      // Validate inputs
      if (formData.height_cm && (isNaN(formData.height_cm) || formData.height_cm < 50 || formData.height_cm > 250)) {
        toast.error('Height must be between 50 and 250 cm')
        return
      }

      if (formData.weight_kg && (isNaN(formData.weight_kg) || formData.weight_kg < 20 || formData.weight_kg > 300)) {
        toast.error('Weight must be between 20 and 300 kg')
        return
      }

      const updates = {
        full_name: formData.full_name || null,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        goal: formData.goal || null,
      }

      const { data, error } = await updateProfile(updates)

      if (error && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
        return
      }

      if (error) throw error

      setIsEditing(false)
      toast.success('Profile updated successfully! ✅')
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return
      }
      console.error('Error saving profile:', error)
      toast.error('Failed to update profile')
    }
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: user?.email || '',
        height_cm: profile.height_cm || '',
        weight_kg: profile.weight_kg || '',
        goal: profile.goal || '',
      })
    }
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <User className="w-10 h-10 text-teal-600" />
          Profile
        </h1>
        <p className="text-gray-600 mt-2">Manage your account information</p>
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8 pb-8 border-b border-gray-200">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile?.full_name || 'User'}
                className="w-32 h-32 rounded-full object-cover border-4 border-teal-500 shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center border-4 border-teal-500 shadow-lg">
                <User className="w-16 h-16 text-white" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 bg-teal-500 hover:bg-teal-600 text-white p-2 rounded-full shadow-lg transition-all disabled:opacity-50"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <p className="text-sm text-gray-600 mt-4">Click upload icon to change avatar</p>
        </div>

        {/* Profile Form */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Profile Information</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-all"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                />
              ) : (
                <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                  {profile?.full_name || user?.user_metadata?.full_name || 'Not set'}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                {user?.email || 'No email'}
              </p>
            </div>

            {/* Height */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Height (cm)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={formData.height_cm}
                  onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                  placeholder="e.g., 175"
                  min="50"
                  max="250"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                />
              ) : (
                <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                  {profile?.height_cm ? `${profile.height_cm} cm` : 'Not set'}
                </p>
              )}
            </div>

            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight (kg)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={formData.weight_kg}
                  onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                  placeholder="e.g., 70"
                  min="20"
                  max="300"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                />
              ) : (
                <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                  {profile?.weight_kg ? `${profile.weight_kg} kg` : 'Not set'}
                </p>
              )}
            </div>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fitness Goal
            </label>
            {isEditing ? (
              <textarea
                value={formData.goal}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                placeholder="Enter your fitness goal..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              />
            ) : (
              <p className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900 min-h-[60px]">
                {profile?.goal || 'Not set'}
              </p>
            )}
          </div>

          {/* Last Sign In */}
          {profile?.last_sign_in_at && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">Last Sign In</p>
                <p className="text-gray-900 font-medium">
                  {new Date(profile.last_sign_in_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Profile
