import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getUserProfile } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { UserIcon, HeartIcon, Music2Icon, BrainIcon } from 'lucide-react'
import '../css/Profile.css'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUserProfile().then(res => {
      if (res.success) setProfile(res.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    >
      <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-32"></div>
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end -mt-12 mb-6">
            <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg">
              <div className="w-full h-full bg-indigo-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-10 h-10 text-indigo-600" />
              </div>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-4">
              <h1 className="text-2xl font-bold">{profile?.displayName || 'Music Creator'}</h1>
              <p className="text-gray-500">{profile?.email || 'creator@example.com'}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><HeartIcon className="w-4 h-4 text-red-400" /> Memory Insights</h2>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-600">🎵 Favorite genres: {profile?.memoryInsights?.favoriteGenres?.join(', ') || 'Synthwave, Lo-fi'}</p>
                <p className="text-sm text-gray-600 mt-2">🎹 Preferred instruments: {profile?.memoryInsights?.preferredInstruments?.join(', ') || 'Piano, Pad synth'}</p>
                <p className="text-sm text-gray-600 mt-2">🧠 Emotional patterns: nostalgic, introspective</p>
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><Music2Icon className="w-4 h-4" /> Stats</h2>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-600">Total songs generated: {profile?.totalSongs || 12}</p>
                <p className="text-sm text-gray-600">Member since: {profile?.memberSince || 'May 2026'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}