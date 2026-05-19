import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getUserSongs } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { PlayIcon, PauseIcon, DownloadIcon, Music2Icon, CalendarIcon } from 'lucide-react'
import '../css/Playlist.css'

export default function Playlist() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [playingUrl, setPlayingUrl] = useState(null)
  const [audio] = useState(() => new Audio())

  useEffect(() => {
    const fetchSongs = async () => {
      const res = await getUserSongs()
      if (res.success) setSongs(res.data)
      setLoading(false)
    }
    fetchSongs()
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
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePlayToggle(song.vocalsUrl || song.compositionUrl)}
                    className={`p-2 rounded-full transition ${playingUrl === (song.vocalsUrl || song.compositionUrl) ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                    title="Play / Pause"
                  >
                    {playingUrl === (song.vocalsUrl || song.compositionUrl) ? (
                      <PauseIcon className="w-5 h-5" />
                    ) : (
                      <PlayIcon className="w-5 h-5" />
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
                    className="p-2 rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
                    title="Download Song"
                  >
                    <DownloadIcon className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}