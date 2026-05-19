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
            {/* Main Prompt */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Creative Direction Prompt</label>
              <textarea
                name="prompt"
                rows={4}
                value={formData.prompt}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm text-sm"
                placeholder="E.g., A nostalgic, atmospheric synthwave track with emotional, rainy ambient vocals..."
              />
            </div>

            {/* Advanced Settings Accordion */}
            <details className="group border border-gray-200 rounded-xl overflow-hidden bg-white">
              <summary className="flex justify-between items-center font-medium px-4 py-3 cursor-pointer select-none text-gray-700 hover:bg-gray-50 transition text-sm">
                <span>Advanced Options (Vibe, Emotion, Story)</span>
                <span className="transition-transform duration-200 group-open:rotate-180">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <div className="p-4 border-t border-gray-200 space-y-4 bg-gray-50/50">
                {[
                  { name: 'genre', placeholder: 'E.g., synthwave, lo-fi, lofi hip-hop' },
                  { name: 'mood', placeholder: 'E.g., wistful, nostalgic, energetic' },
                  { name: 'emotion', placeholder: 'E.g., melancholic, dreamlike, euphoric' },
                  { name: 'story', placeholder: 'E.g., driving through a rain-soaked neon city at night' },
                  { name: 'memory', placeholder: 'E.g., memories of a lost future' },
                  { name: 'journalEntry', label: 'Journal Entry', placeholder: 'E.g., reflected on past travels...' }
                ].map((item) => (
                  <div key={item.name}>
                    <label className="block text-xs font-semibold text-gray-600 capitalize mb-1">{item.label || item.name}</label>
                    <input
                      type="text"
                      name={item.name}
                      value={formData[item.name]}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
                      placeholder={item.placeholder}
                    />
                  </div>
                ))}
              </div>
            </details>
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