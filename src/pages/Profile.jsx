import { useAuth } from '../context/AuthContext'
import { User, Mail, Target, Clock } from 'lucide-react'

const Profile = () => {
  const { user, profile } = useAuth()

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <User className="w-10 h-10 text-teal-600" />
          Profile
        </h1>
        <p className="text-gray-600 mt-2">Your account information</p>
      </div>

      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 border border-white/20">
        <div className="space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-4 pb-6 border-b border-gray-200">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-white text-2xl font-bold">
              {profile?.full_name?.[0] || user?.email?.[0] || 'U'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {profile?.full_name || user?.user_metadata?.full_name || 'User'}
              </h2>
              <p className="text-gray-600 flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4" />
                {user?.email || 'No email'}
              </p>
            </div>
          </div>

          {/* User Metadata */}
          {user?.user_metadata && Object.keys(user.user_metadata).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Account Details</h3>
              <div className="space-y-2">
                {Object.entries(user.user_metadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-gray-900 font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Profile Info */}
          {profile && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Profile Information</h3>
              <div className="space-y-3">
                {profile.goal && (
                  <div className="flex items-start gap-3 p-3 bg-teal-50 rounded-lg">
                    <Target className="w-5 h-5 text-teal-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Fitness Goal</p>
                      <p className="text-gray-900 font-medium">{profile.goal}</p>
                    </div>
                  </div>
                )}
                {profile.last_sign_in_at && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-5 h-5 text-gray-600 mt-0.5" />
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
          )}

          {/* Fallback if no profile */}
          {!profile && !user?.user_metadata && (
            <div className="text-center py-8 text-gray-500">
              <p>No profile information available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Profile
