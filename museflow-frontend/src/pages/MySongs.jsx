import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getUserSongs } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { Trash2Icon, Edit3Icon, DownloadIcon } from 'lucide-react'
import '../css/MySongs.css'

export default function MySongs() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUserSongs().then(res => {
      if (res.success) setSongs(res.data)
      setLoading(false)
    })
  }, [])

  const handleDelete = (id) => {
    // In real app, call DELETE /api/user/songs/:id
    setSongs(prev => prev.filter(s => s.id !== id))
  }

  if (loading) return <LoadingSpinner />

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    >
      <h1 className="text-3xl font-bold gradient-text mb-8">My Songs Library</h1>
      {songs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No songs saved yet.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {songs.map((song) => (
            <motion.div
              key={song.id}
              whileHover={{ y: -5 }}
              className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
            >
              <img src={song.coverArtUrl} alt="cover" className="h-48 w-full object-cover" />
              <div className="p-4">
                <h3 className="font-bold text-lg truncate">{song.title}</h3>
                <p className="text-xs text-gray-400 mt-1">{song.createdAt}</p>
                <div className="flex justify-between mt-4">
                  <button className="p-2 rounded-lg hover:bg-gray-100"><Edit3Icon className="w-4 h-4" /></button>
                  <button className="p-2 rounded-lg hover:bg-gray-100"><DownloadIcon className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(song.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2Icon className="w-4 h-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}