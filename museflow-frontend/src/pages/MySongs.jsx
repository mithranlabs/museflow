import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getUserSongs } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { Trash2Icon, Edit3Icon, DownloadIcon, PlayIcon, PauseIcon } from 'lucide-react'
import '../css/MySongs.css'

export default function MySongs() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [playingUrl, setPlayingUrl] = useState(null)
  const [audio] = useState(() => new Audio())

  useEffect(() => {
    getUserSongs().then(res => {
      if (res.success) setSongs(res.data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const handleEnded = () => setPlayingUrl(null)
    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.pause()
    }
  }, [audio])

  const handlePlayToggle = (url) => {
    if (!url) return
    if (playingUrl === url) {
      audio.pause()
      setPlayingUrl(null)
    } else {
      audio.src = url
      audio.play().catch(e => console.error("Playback failed:", e))
      setPlayingUrl(url)
    }
  }

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
                 <div className="flex justify-between items-center mt-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePlayToggle(song.vocalsUrl || song.compositionUrl)}
                      className={`p-2 rounded-lg transition ${playingUrl === (song.vocalsUrl || song.compositionUrl) ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100 text-gray-600'}`}
                      title="Play / Pause"
                    >
                      {playingUrl === (song.vocalsUrl || song.compositionUrl) ? (
                        <PauseIcon className="w-4 h-4" />
                      ) : (
                        <PlayIcon className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={async () => {
                        const url = song.vocalsUrl || song.compositionUrl
                        if (!url) return
                        try {
                          const response = await fetch(url)
                          const blob = await response.blob()
                          const blobUrl = URL.createObjectURL(blob)
                          const link = document.createElement('a')
                          link.href = blobUrl
                          link.download = `${song.title || 'song'}.mp3`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          URL.revokeObjectURL(blobUrl)
                        } catch (err) {
                          window.open(url, '_blank')
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                      title="Download Song"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <button onClick={() => handleDelete(song.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Delete Song"><Trash2Icon className="w-4 h-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}