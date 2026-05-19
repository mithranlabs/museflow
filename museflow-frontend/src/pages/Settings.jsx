import { useState } from 'react'
import { motion } from 'framer-motion'
import { updateSettings } from '../services/api'
import { useTheme } from '../context/ThemeContext'
import { SaveIcon, BellIcon, PaletteIcon, Music2Icon } from 'lucide-react'

export default function Settings() {
  const { theme, toggleTheme } = useTheme()
  const [settings, setSettings] = useState({
    theme: theme, // sync with current theme
    notifications: true,
    defaultGenre: 'synthwave',
    exportFormat: 'mp3'
  })
  const [saved, setSaved] = useState(false)

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    // if key is 'theme', also toggle the global theme
    if (key === 'theme') {
      toggleTheme()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const res = await updateSettings(settings)
    if (res.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    >
      <h1 className="text-3xl font-bold gradient-text mb-8">Settings</h1>
      <form onSubmit={handleSubmit} className="space-y-8 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><PaletteIcon className="w-5 h-5" /> Appearance</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <select
              value={settings.theme}
              onChange={e => handleChange('theme', e.target.value)}
              className="w-full border rounded-lg p-2 "
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        {/* rest of your settings form unchanged */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><BellIcon className="w-5 h-5" /> Notifications</h2>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={settings.notifications} onChange={e => handleChange('notifications', e.target.checked)} className="w-4 h-4" />
            <span>Enable email notifications when a song is generated</span>
          </label>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Music2Icon className="w-5 h-5" /> Music Preferences</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Default Genre</label>
              <input type="text" value={settings.defaultGenre} onChange={e => handleChange('defaultGenre', e.target.value)} className="w-full border rounded-lg p-2 " />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Export Format</label>
              <select value={settings.exportFormat} onChange={e => handleChange('exportFormat', e.target.value)} className="w-full border rounded-lg p-2 ">
                <option>mp3</option>
                <option>wav</option>
                <option>midi</option>
              </select>
            </div>
          </div>
        </div>

        <button type="submit" className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
          <SaveIcon className="w-4 h-4" /> Save Settings
        </button>
        {saved && <p className="text-green-600 text-sm">Settings saved successfully!</p>}
      </form>
    </motion.div>
  )
}