import { motion } from 'framer-motion'
import { SaveIcon, DownloadIcon, Share2Icon, Music2Icon } from 'lucide-react'

export default function SongResultCard({ song, onSave, onDownload }) {
  if (!song) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden"
    >
      {/* Cover Art */}
      {song.coverArtUrl && (
        <div className="relative h-48 md:h-56 overflow-hidden">
          <img
            src={song.coverArtUrl}
            alt="cover art"
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-white text-xl font-bold drop-shadow-md">{song.songTitle}</h3>
            <p className="text-white/80 text-sm">Production: {song.productionStyle}</p>
          </div>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Lyrics Preview */}
        <div>
          <h4 className="font-semibold text-gray-700 flex items-center gap-2 mb-2">
            <Music2Icon className="w-4 h-4 text-indigo-500" />
            Lyrics
          </h4>
          <div className="bg-gray-50 p-3 rounded-lg max-h-48 overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-600">{song.lyrics}</pre>
          </div>
        </div>

        {/* Audio/MIDI Links */}
        <div className="flex flex-wrap gap-3 pt-2">
          {song.compositionUrl && (
            <a
              href={song.compositionUrl}
              download
              onClick={(e) => {
                e.preventDefault()
                if (onDownload) onDownload('composition', song.compositionUrl)
                else window.open(song.compositionUrl, '_blank')
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition"
            >
              <DownloadIcon className="w-4 h-4" /> MIDI
            </a>
          )}
          {song.vocalsUrl && (
            <a
              href={song.vocalsUrl}
              download
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition"
            >
              <DownloadIcon className="w-4 h-4" /> Vocals
            </a>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onSave}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-xl transition shadow-sm"
          >
            <SaveIcon className="w-4 h-4" /> Save to My Songs
          </button>
          <button
            onClick={() => {
              navigator.share ? navigator.share({ title: song.songTitle, text: song.lyrics }) : alert('Share not supported')
            }}
            className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
          >
            <Share2Icon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}