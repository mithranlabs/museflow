import { useState } from 'react'
import { motion } from 'framer-motion'
import { generateSong, saveSong } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import SongResultCard from '../components/studio/SongResultCard'
import { Wand2Icon, Music2Icon } from 'lucide-react'
import '../css/StudioWorkspace.css'

export default function StudioWorkspace() {
  const [formData, setFormData] = useState({
    prompt: '',
    mood: '',
    story: '',
    genre: '',
    memory: '',
    journalEntry: '',
    emotion: ''
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    const response = await generateSong(formData)
    if (response.success) {
      setResult(response.data)
    } else {
      setError(response.error || 'Generation failed')
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!result) return
    const saved = await saveSong(result)
    if (saved.success) alert('Song saved to your library!')
    else alert('Save failed: ' + saved.error)
  }

  const handleDownload = (type, url) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `${result.songTitle}_${type}.mid`
    link.click()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    >
      <div className="grid lg:grid-cols-2 gap-12">
        {/* Input Form - Left Column */}
        <div className="space-y-6">
          <h1 className="text-3xl font-bold gradient-text">Studio Workspace</h1>
          <p className="text-gray-600">Describe your musical vision — our AI agents will handle the rest.</p>
          
          <div className="space-y-4">
            {['prompt', 'mood', 'story', 'genre', 'memory', 'journalEntry', 'emotion'].map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 capitalize mb-1">{field}</label>
                <textarea
                  name={field}
                  rows={field === 'prompt' ? 3 : 2}
                  value={formData[field]}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder={`Enter ${field}...`}
                />
              </div>
            ))}
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition shadow-md disabled:opacity-50"
          >
            {loading ? <LoadingSpinner /> : <><Wand2Icon className="w-5 h-5" /> Generate Song</>}
          </button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        {/* RIGHT COLUMN – RESULT PANEL – THIS IS WHERE YOU REPLACE */}
        {result ? (
          <SongResultCard
            song={result}
            onSave={handleSave}
            onDownload={handleDownload}
          />
        ) : (
          <div className="bg-gray-50 rounded-2xl p-12 text-center text-gray-400 border border-gray-200">
            <Music2Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Your AI-generated song will appear here.</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}