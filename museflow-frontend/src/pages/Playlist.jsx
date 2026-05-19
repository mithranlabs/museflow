import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getUserSongs } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { PlayIcon, Music2Icon, CalendarIcon } from 'lucide-react'
import '../css/Playlist.css'

export default function Playlist() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSongs = async () => {
      const res = await getUserSongs()
      if (res.success) setSongs(res.data)
      setLoading(false)
    }
    fetchSongs()
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    >
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold gradient-text">Your Playlist</h1>
        <Music2Icon className="w-6 h-6 text-gray-400" />
      </div>

      {songs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Music2Icon className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>No songs yet. Head to <span className="text-indigo-500">Studio Workspace</span> and create your first masterpiece.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {songs.map((song, idx) => (
              <motion.div
                key={song.id || idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition"
              >
                <img src={song.coverArtUrl || 'https://via.placeholder.com/60'} alt="cover" className="w-14 h-14 rounded-lg object-cover" />
                <div className="flex-1">
                  <h3 className="font-semibold">{song.title || 'Untitled'}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {song.createdAt || 'Recently'}</p>
                </div>
                <button className="p-2 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition">
                  <PlayIcon className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}