import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { User, Camera, Save, Ruler, Weight, Mail, Calendar, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

const Profile = () => {
  const { user, profile, updateProfile, loadProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [avatarUrl, setAvatarUrl] = useState(null)

  const [formData, setFormData] = useState({
    full_name: '',
    height_cm: '',
    weight_kg: '',
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        height_cm: profile.height_cm || '',
        weight_kg: profile.weight_kg || '',
      })
      
      // Load avatar URL when profile changes
      if (profile.avatar_url) {
        loadAvatarUrl(profile.avatar_url)
      } else {
        setAvatarUrl(null)
      }
    }
  }, [profile])

  const loadAvatarUrl = (filePath) => {
    try {
      // Get public URL from Supabase Storage
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      if (data?.publicUrl) {
        // Add cache busting parameter to ensure fresh image loads
        const cacheBustingUrl = `${data.publicUrl}?t=${Date.now()}`
        setAvatarUrl(cacheBustingUrl)
      } else {
        setAvatarUrl(null)
      }
    } catch (error) {
      console.error('Error loading avatar URL:', error)
      setAvatarUrl(null)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSave = async () => {
    if (!user?.id) {
      toast.error('You must be logged in to save your profile')
      return
    }

    setLoading(true)
    try {
      const updates = {
        full_name: formData.full_name,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
      }

      const result = await updateProfile(updates)
      if (result?.error) {
        throw result.error
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error(`Failed to save profile: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate user authentication
    if (!user?.id) {
      toast.error('You must be logged in to upload an image')
      return
    }

    // Validate file type - only accept jpg, jpeg, png
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png']
    const fileType = file.type.toLowerCase()
    const fileExtension = file.name.split('.').pop().toLowerCase()
    
    if (!validImageTypes.includes(fileType) && !['jpg', 'jpeg', 'png'].includes(fileExtension)) {
      toast.error('Please select a valid image file (JPG or PNG only)')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Show uploading toast immediately
    const uploadingToast = toast.loading('Uploading...')
    setUploading(true)

    try {
      // Step 1: Generate file name: avatar_${user.id}.png (or .jpg)
      const timestamp = Date.now()
      const fileExtension = file.name.split('.').pop().toLowerCase()
      // Normalize extension: jpeg -> jpg, keep png as png, default to png for consistency
      const normalizedExt = fileExtension === 'jpeg' || fileExtension === 'jpg' ? 'jpg' : 'png'
      
      // Use avatar_${user.id}.png format (or .jpg if original was jpg)
      // With upsert: true, this will overwrite the existing file instead of failing
      const filePath = `avatar_${user.id}.${normalizedExt}`

      // Step 2: Upload to Supabase Storage - avatars bucket
      // Use upsert: true to overwrite existing file if it exists (important for RLS)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true, // IMPORTANT: Overwrites existing file instead of failing
          contentType: file.type || `image/${normalizedExt}`,
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        console.error('Error details:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError.error,
        })
        
        // Check for specific errors
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('does not exist')) {
          toast.error('avatars storage bucket not found. Please create it in Supabase Storage.', { id: uploadingToast })
          console.error('SUPABASE FIX: Create a public storage bucket named "avatars" in Supabase Dashboard > Storage')
          return
        }
        
        if (
          uploadError.message?.includes('row-level security') || 
          uploadError.message?.includes('permission') || 
          uploadError.message?.includes('policy') ||
          uploadError.code === '42501' || 
          uploadError.statusCode === '403' ||
          uploadError.statusCode === 403
        ) {
          toast.error('Storage permission denied. Please check RLS policies on avatars bucket.', { id: uploadingToast })
          console.error('SUPABASE FIX: Your RLS policies need to allow authenticated users to upload/update files in avatars bucket')
          console.error('Example RLS policies you need:')
          console.error(`
-- Allow authenticated users to INSERT (upload) avatars
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to UPDATE (overwrite) their own avatars
CREATE POLICY "Authenticated users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (name LIKE 'avatar_' || auth.uid()::text || '%' OR name LIKE 'avatar_' || auth.uid()::text || '.%'));

-- Allow authenticated users to SELECT (view) avatars
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
          `)
          return
        }
        
        throw uploadError
      }

      // Step 3: Get Public URL after successful upload
      const { data: urlData, error: urlError } = supabase.storage.from('avatars').getPublicUrl(filePath)
      
      if (urlError) {
        console.error('Error getting public URL:', urlError)
        throw new Error('Failed to get public URL for uploaded image')
      }
      
      const publicUrl = urlData?.publicUrl

      if (!publicUrl) {
        throw new Error('Failed to get public URL for uploaded image')
      }

      // Step 4: Update avatar_url column in profiles table with the file path
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: filePath, // Store the file path (avatar_userId_timestamp.png)
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Profile update error:', updateError)
        // Try to delete uploaded file if profile update fails
        try {
          await supabase.storage.from('avatars').remove([filePath])
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError)
        }
        throw updateError
      }

      // Step 5: Instant UI Refresh - Update local state immediately with cache busting
      // Create a preview URL with cache busting to ensure fresh image loads
      const cacheBustingUrl = `${publicUrl}?t=${timestamp}`
      
      // Update state immediately for instant UI refresh
      setAvatarUrl(cacheBustingUrl)
      
      // Also update the profile in AuthContext to keep everything in sync
      if (loadProfile) {
        await loadProfile(user.id)
      }

      // Step 6: Show success message (this replaces the "Uploading..." toast)
      toast.success('Profile updated! ✅', { id: uploadingToast })

    } catch (error) {
      console.error('Error uploading avatar:', error)
      const errorMsg = error.message || 'Unknown error occurred during upload'
      toast.error(`Failed to upload image: ${errorMsg}`, { id: uploadingToast })
    } finally {
      setUploading(false)
      // Reset file input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const calculateBMI = () => {
    if (formData.height_cm && formData.weight_kg) {
      const heightM = parseFloat(formData.height_cm) / 100
      const weightKg = parseFloat(formData.weight_kg)
      const bmi = weightKg / (heightM * heightM)
      return bmi.toFixed(1)
    }
    return null
  }

  const getBMICategory = (bmi) => {
    if (!bmi) return null
    const bmiNum = parseFloat(bmi)
    if (bmiNum < 18.5) return { label: 'Underweight', color: 'text-blue-600' }
    if (bmiNum < 25) return { label: 'Normal', color: 'text-green-600' }
    if (bmiNum < 30) return { label: 'Overweight', color: 'text-yellow-600' }
    return { label: 'Obese', color: 'text-red-600' }
  }

  const bmi = calculateBMI()
  const bmiCategory = getBMICategory(bmi)

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <User className="w-10 h-10 text-teal-600" />
          Profile Settings
        </h1>
        <p className="text-gray-600 mt-2">Manage your profile information</p>
      </div>

      {/* Profile Banner with Avatar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl shadow-lg overflow-hidden h-48"
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative h-full flex items-center justify-center">
          <div className="relative">
            {uploading ? (
              <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-lg border-4 border-white shadow-xl flex items-center justify-center">
                <Loader2 className="w-16 h-16 text-white animate-spin" />
              </div>
            ) : avatarUrl ? (
              <img
                key={avatarUrl} // Key prop forces re-render when URL changes
                src={avatarUrl}
                alt={profile?.full_name || 'User'}
                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-xl"
                onError={(e) => {
                  console.error('Failed to load avatar image:', avatarUrl)
                  // Try to reload without cache busting
                  if (avatarUrl.includes('?t=')) {
                    const baseUrl = avatarUrl.split('?')[0]
                    e.target.src = baseUrl
                  } else {
                    setAvatarUrl(null)
                  }
                }}
                onLoad={() => {
                  // Image loaded successfully
                  console.log('Avatar image loaded successfully')
                }}
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-lg border-4 border-white shadow-xl flex items-center justify-center">
                <User className="w-16 h-16 text-white" />
              </div>
            )}
            <label
              htmlFor="avatar-upload"
              className={`absolute bottom-0 right-0 p-3 bg-white rounded-full shadow-lg cursor-pointer hover:bg-gray-100 transition-all ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Camera className="w-5 h-5 text-gray-700" />
              <input
                ref={fileInputRef}
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploading}
                capture="user" // Enable camera on mobile devices
              />
            </label>
          </div>
        </div>
      </motion.div>

      {/* User Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center -mt-12 relative z-10"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{profile?.full_name || 'User'}</h2>
        <p className="text-gray-600 flex items-center justify-center gap-2">
          <Mail className="w-4 h-4" />
          {user?.email}
        </p>
      </motion.div>

      {/* Profile Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="md:col-span-2 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20"
        >
          <h3 className="text-xl font-bold text-gray-900 mb-6">Personal Information</h3>

          <div className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            {/* Height and Weight */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Height (cm)</label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="number"
                    name="height_cm"
                    value={formData.height_cm}
                    onChange={handleInputChange}
                    placeholder="170"
                    min="0"
                    max="250"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
                <div className="relative">
                  <Weight className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="number"
                    name="weight_kg"
                    value={formData.weight_kg}
                    onChange={handleInputChange}
                    placeholder="70"
                    min="0"
                    max="300"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* BMI Display */}
            {bmi && (
              <div className="bg-gradient-to-r from-teal-500 to-blue-500 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">Body Mass Index</p>
                    <p className="text-3xl font-bold">{bmi}</p>
                    {bmiCategory && (
                      <p className="text-sm font-medium mt-1 opacity-90">
                        {bmiCategory.label}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Account Info */}
            {profile?.created_at && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Account Information</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Member since: {new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  {profile.last_sign_in_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Last login: {new Date(profile.last_sign_in_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={loading || uploading}
              className="w-full bg-gradient-to-r from-teal-500 to-blue-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Profile
