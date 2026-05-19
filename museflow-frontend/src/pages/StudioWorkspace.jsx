import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { saveSong } from '../services/api'
import { 
  Wand2Icon, Music2Icon, TerminalIcon, CpuIcon, BrainIcon, 
  ActivityIcon, CheckCircle2Icon, AlertCircleIcon, RefreshCwIcon,
  PlayIcon, PauseIcon, DownloadIcon, SaveIcon, SparklesIcon,
  DiscIcon, Volume2Icon, HeartIcon, Share2Icon, DatabaseIcon,
  SearchIcon, CheckIcon, Music3Icon
} from 'lucide-react'

// Icon mapping helper for agent status display
const getAgentIcon = (iconName) => {
  switch (iconName) {
    case 'BrainIcon': return <BrainIcon className="w-5 h-5 text-indigo-400" />
    case 'HeartIcon': return <HeartIcon className="w-5 h-5 text-rose-400" />
    case 'CpuIcon': return <CpuIcon className="w-5 h-5 text-amber-400" />
    case 'TerminalIcon': return <TerminalIcon className="w-5 h-5 text-emerald-400" />
    case 'ActivityIcon': return <ActivityIcon className="w-5 h-5 text-cyan-400" />
    case 'SparklesIcon': return <SparklesIcon className="w-5 h-5 text-fuchsia-400" />
    case 'Volume2Icon': return <Volume2Icon className="w-5 h-5 text-violet-400" />
    case 'DiscIcon': return <DiscIcon className="w-5 h-5 text-sky-400" />
    default: return <CpuIcon className="w-5 h-5 text-gray-400" />
  }
}

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
  
  // Real-time Orchestration telemetry states
  const [terminalLogs, setTerminalLogs] = useState([])
  const [activeAgent, setActiveAgent] = useState('')
  const [memoryProfile, setMemoryProfile] = useState('')
  const [generationProgress, setGenerationProgress] = useState(0)
  const [currentStageText, setCurrentStageText] = useState('Idle - awaiting creative instructions')
  const [traceId, setTraceId] = useState('')
  
  const [agentStates, setAgentStates] = useState({
    HindsightMemory: { name: 'Hindsight Memory', status: 'idle', icon: 'BrainIcon', label: 'Memory recall & reflection' },
    EmotionAgent: { name: 'Emotion Agent', status: 'idle', icon: 'HeartIcon', label: 'Cues & vibe analysis' },
    MemoryAgent: { name: 'Memory Agent', status: 'idle', icon: 'CpuIcon', label: 'Contextual synthesis' },
    LyricsAgent: { name: 'Lyrics Agent', status: 'idle', icon: 'TerminalIcon', label: 'Themed lyrical composer' },
    CompositionAgent: { name: 'Composition Agent', status: 'idle', icon: 'ActivityIcon', label: 'Key & BPM director' },
    ProducerAgent: { name: 'Producer Agent', status: 'idle', icon: 'SparklesIcon', label: 'Arrangement director' },
    VocalStylingAgent: { name: 'Vocal Styling Agent', status: 'idle', icon: 'Volume2Icon', label: 'Vocal chain stylist' },
    MusicGenerationAgent: { name: 'Music Generation Agent', status: 'idle', icon: 'DiscIcon', label: 'Loudly synth orchestrator' },
    VocalService: { name: 'Vocal Service', status: 'idle', icon: 'Volume2Icon', label: 'Voice model synthesizer' },
    AudioMixer: { name: 'Audio Mixer', status: 'idle', icon: 'ActivityIcon', label: 'ffmpeg stereo master' },
    CriticAgent: { name: 'Critic Agent', status: 'idle', icon: 'TerminalIcon', label: 'Consensus & review loops' },
  })

  // Audio playback state
  const [playing, setPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const audioRef = useRef(null)

  const terminalEndRef = useRef(null)

  // Auto-scroll terminal window
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [terminalLogs])

  // Cleanup audio instance
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  // SSE event streaming orchestrator handler
  const handleGenerate = async () => {
    if (!formData.prompt) {
      setError('Please provide a creative prompt to begin orchestration.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setTerminalLogs([])
    setMemoryProfile('')
    setGenerationProgress(0)
    setTraceId('')
    setCurrentStageText('Initializing connection to CascadeFlow network...')
    
    // Reset all agent statuses to idle
    setAgentStates(prev => {
      const updated = {}
      Object.keys(prev).forEach(key => {
        updated[key] = { ...prev[key], status: 'idle' }
      })
      return updated
    })

    if (audioRef.current) {
      audioRef.current.pause()
      setPlaying(false)
    }

    const appendLog = (msg, type = 'info', meta = '') => {
      const timestamp = new Date().toLocaleTimeString()
      setTerminalLogs(prev => [...prev, { timestamp, msg, type, meta }])
    }

    appendLog('Establish connection to orchestration stream endpoint', 'system')

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
      const streamUrl = baseUrl.startsWith('http') 
        ? `${baseUrl}/orchestrate/stream`
        : `${window.location.origin}${baseUrl}/orchestrate/stream`

      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error(`Orchestrator returned status ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue
            try {
              const event = JSON.parse(jsonStr)
              
              if (event.type === 'start') {
                appendLog(event.message, 'system')
                setGenerationProgress(2)
                setCurrentStageText('Analyzing direction parameters...')
              } 
              
              else if (event.type === 'step') {
                const { step, agent, state, model, latency, output, escalation } = event.step
                
                // Update agent state map
                setActiveAgent(agent)
                setAgentStates(prev => ({
                  ...prev,
                  [agent]: { ...prev[agent], status: state }
                }))

                // Process progress weights and log messages based on agent execution state
                if (state === 'RUNNING') {
                  appendLog(`Agent [${agent}] initialized execution: "${step}" using model tier [${model}]`, 'running')
                  
                  // Progress progression mappings
                  if (agent === 'HindsightMemory') {
                    setGenerationProgress(5)
                    setCurrentStageText('Recalling user acoustic preferences...')
                  } else if (agent === 'EmotionAgent') {
                    setGenerationProgress(15)
                    setCurrentStageText('Parsing prompt mood coordinates...')
                  } else if (agent === 'MemoryAgent') {
                    setGenerationProgress(25)
                    setCurrentStageText('Synthesizing session profile...')
                  } else if (agent === 'LyricsAgent') {
                    setGenerationProgress(40)
                    setCurrentStageText('Composing thematic stanzas & chorus...')
                  } else if (agent === 'CompositionAgent') {
                    setGenerationProgress(50)
                    setCurrentStageText('Formulating key, BPM & instrumentation blueprint...')
                  } else if (agent === 'ProducerAgent') {
                    setGenerationProgress(60)
                    setCurrentStageText('Drafting production mastering instructions...')
                  } else if (agent === 'VocalStylingAgent') {
                    setGenerationProgress(65)
                    setCurrentStageText('Tailoring vocal filters & fx hooks...')
                  } else if (agent === 'MusicGenerationAgent') {
                    setGenerationProgress(75)
                    setCurrentStageText('Triggering Loudly parametric music synthesis...')
                  } else if (agent === 'VocalService') {
                    setGenerationProgress(85)
                    setCurrentStageText('Generating backing vocal tracks...')
                  } else if (agent === 'AudioMixer') {
                    setGenerationProgress(90)
                    setCurrentStageText('Blending composition + vocal stems inside ffmpeg studio...')
                  } else if (agent === 'CriticAgent') {
                    setGenerationProgress(95)
                    setCurrentStageText('Evaluating mix with Critic Agent consensus...')
                  }
                } 
                
                else if (state === 'SUCCESS') {
                  appendLog(`Agent [${agent}] finished successfully in ${latency || 0}ms.`, 'success')
                  
                  // Extract telemetry payload results to display dynamically in logs
                  if (agent === 'HindsightMemory' && output?.synthesizedProfile) {
                    setMemoryProfile(output.synthesizedProfile)
                    appendLog('Retrieved Hindsight Profile synthesis successfully.', 'telemetry', output.synthesizedProfile.slice(0, 150) + '...')
                  } else if (agent === 'EmotionAgent' && output) {
                    appendLog(`Tone classification: Emotion: ${output.emotion} | Genre: ${output.genre} | Energy: ${output.energy}`, 'telemetry')
                  } else if (agent === 'CompositionAgent' && output) {
                    appendLog(`Composition blueprint: ${output.bpm} BPM | Key: ${output.key} | Instruments: ${output.instruments.join(', ')}`, 'telemetry')
                  } else if (agent === 'VocalStylingAgent' && output) {
                    appendLog(`Voice parameters: Density: ${output.vocalDensity} | Mix: ${output.mixStyle}`, 'telemetry')
                  } else if (agent === 'CriticAgent' && output) {
                    appendLog(`Critic score: Coherence: ${output.scores.compositionCoherence}/10 | Lyrics: ${output.scores.lyricalQuality}/10. Approved: ${output.pass}`, 'telemetry', output.feedback)
                  }
                } 
                
                else if (state === 'RETRYING') {
                  appendLog(`Agent [${agent}] triggered adaptive feedback cycle. Re-attempting step...`, 'retry', escalation || 'Critic feedback loop optimization active')
                }
              } 
              
              else if (event.type === 'complete') {
                appendLog('CascadeFlow creative orchestration finalized successfully.', 'system')
                setGenerationProgress(100)
                setCurrentStageText('Workflow completed!')
                setResult(event.data)
                setTraceId(event.trace?.workflowId || '')
                setActiveAgent('')
                setLoading(false)
              } 
              
              else if (event.type === 'error') {
                appendLog(`Orchestration runtime error: ${event.error}`, 'error', event.details)
                setError(event.error || 'Generation encountered an error.')
                setLoading(false)
              }
            } catch (e) {
              console.error("SSE JSON parse error:", e)
            }
          }
        }
      }
    } catch (err) {
      appendLog(`Connection failure: ${err.message}`, 'error')
      setError(err.message || 'Generation failed.')
      setLoading(false)
    }
  }

  const handlePlayToggle = () => {
    if (!result) return
    const url = result.vocalsUrl || result.compositionUrl
    
    if (!audioRef.current) {
      audioRef.current = new Audio(url)
      audioRef.current.addEventListener('ended', () => setPlaying(false))
    } else if (audioUrl !== url) {
      audioRef.current.src = url
      setAudioUrl(url)
    }

    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
      setAudioUrl(url)
    }
  }

  const handleDownload = async () => {
    if (!result) return
    const url = result.vocalsUrl || result.compositionUrl
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${result.songTitle || 'song'}.mp3`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      window.open(url, '_blank')
    }
  }

  const handleSaveToLibrary = async () => {
    if (!result) return
    const res = await saveSong(result)
    if (res.success) {
      alert('Song successfully added to your permanent catalog library!')
    } else {
      alert('Save failed: ' + res.error)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0D19] text-gray-100 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Cinematic Header Block */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs tracking-wider uppercase mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              SYSTEM PORT: ACTIVE
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Real-Time AI <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-500 bg-clip-text text-transparent">Orchestration Console</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Command the CascadeFlow multi-agent grid. Inspect creative processes, memory loops, and audio rendering in real-time.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl text-right">
              <div className="text-[10px] text-slate-500 font-mono">GROQ COGNITIVE SPEED</div>
              <div className="text-sm font-semibold font-mono text-emerald-400">⚡ 120+ tokens/sec</div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDEBAR: INPUT CONTROL DESK */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/70 border border-slate-850 rounded-2xl p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-4">
                <Wand2Icon className="w-5 h-5 text-cyan-400" />
                <h2 className="font-semibold text-lg text-white">Creative Directive</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Prompt Direction</label>
                  <textarea
                    name="prompt"
                    rows={4}
                    value={formData.prompt}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full border border-slate-800 rounded-xl px-4 py-3 bg-slate-950/80 text-gray-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 shadow-inner text-sm transition"
                    placeholder="E.g., A grand patriotic orchestral anthem celebrating the beauty of our country and its freedom..."
                  />
                </div>

                <details className="group border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
                  <summary className="flex justify-between items-center font-mono text-xs px-4 py-3 cursor-pointer select-none text-slate-400 hover:bg-slate-850/50 transition">
                    <span>Enrichment Parameters</span>
                    <span className="transition-transform duration-200 group-open:rotate-180">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </summary>
                  <div className="p-4 border-t border-slate-850 space-y-3 bg-slate-950/60">
                    {[
                      { name: 'genre', placeholder: 'E.g., orchestral anthem, rock, synthwave' },
                      { name: 'mood', placeholder: 'E.g., proud, majestic, nostalgic' },
                      { name: 'emotion', placeholder: 'E.g., patriotic, ecstatic, melancholic' },
                      { name: 'story', placeholder: 'E.g., marching flags waving in a clear morning sky' },
                      { name: 'memory', placeholder: 'E.g., memories of national unity' },
                      { name: 'journalEntry', label: 'Journal Entry', placeholder: 'E.g., felt proud of the country today...' }
                    ].map((item) => (
                      <div key={item.name}>
                        <label className="block text-[10px] font-mono text-slate-400 capitalize mb-1">{item.label || item.name}</label>
                        <input
                          type="text"
                          name={item.name}
                          value={formData[item.name]}
                          onChange={handleChange}
                          disabled={loading}
                          className="w-full border border-slate-800 rounded-lg px-3 py-1.5 text-xs bg-slate-950 text-gray-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                          placeholder={item.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </details>

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-650 to-cyan-600 hover:from-indigo-600 hover:to-cyan-500 text-white font-medium py-3 rounded-xl transition shadow-[0_0_15px_rgba(99,102,241,0.2)] disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCwIcon className="w-5 h-5 animate-spin text-cyan-200" />
                  ) : (
                    <><Wand2Icon className="w-5 h-5" /> Orchestrate Live</>
                  )}
                </button>

                {error && (
                  <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs">
                    <AlertCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* HINDSIGHT SYNTHESIS DISPLAY */}
            <div className="bg-slate-900/70 border border-slate-850 rounded-2xl p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-4">
                <BrainIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-lg text-white">Hindsight Reflection</h3>
              </div>

              {memoryProfile ? (
                <div className="space-y-4">
                  <div className="bg-indigo-950/20 border border-indigo-500/20 p-4 rounded-xl text-xs text-indigo-200 leading-relaxed font-mono">
                    {memoryProfile}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded text-[10px] font-mono">Personalized Beats</span>
                    <span className="bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 px-2 py-0.5 rounded text-[10px] font-mono">Evolutionary Vibe</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <DatabaseIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  Waiting for Hindsight recall query...
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: ORCHESTRATION telemetry MONITOR */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* PROGRESS MONITOR HEADER */}
            {loading && (
              <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 transition-all duration-300" style={{ width: `${generationProgress}%` }} />
                
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-mono text-cyan-400 font-semibold">{currentStageText}</span>
                  <span className="text-sm font-mono font-bold text-slate-400">{generationProgress}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${generationProgress}%` }} />
                </div>
              </div>
            )}

            {/* MAIN RESULTS DISPLAY (OR SIMULATOR INTERFACE IF LOADING) */}
            {result && !loading ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
              >
                {/* Cyberpunk ambient decor */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

                <div className="grid md:grid-cols-12 gap-8 relative z-10">
                  {/* ALBUM COVER WORKSPACE */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center text-center">
                    <div className="relative group">
                      {result.coverArtUrl ? (
                        <div className="w-48 h-48 rounded-2xl overflow-hidden border border-slate-700/80 shadow-[0_0_20px_rgba(99,102,241,0.15)] bg-slate-950 relative">
                          <img 
                            src={result.coverArtUrl} 
                            alt={result.songTitle} 
                            className={`w-full h-full object-cover transition-transform duration-700 ${playing ? 'animate-[spin_20s_linear_infinite]' : ''}`} 
                          />
                        </div>
                      ) : (
                        <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-indigo-950 to-slate-950 border border-slate-850 flex items-center justify-center shadow-inner">
                          <Music3Icon className="w-16 h-16 text-indigo-400/30" />
                        </div>
                      )}
                      
                      {/* Play/Pause hover overlay */}
                      <button
                        onClick={handlePlayToggle}
                        className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 rounded-2xl"
                      >
                        {playing ? (
                          <PauseIcon className="w-12 h-12 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                        ) : (
                          <PlayIcon className="w-12 h-12 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                        )}
                      </button>
                    </div>

                    <h3 className="font-extrabold text-xl text-white mt-4 tracking-tight truncate w-full">{result.songTitle}</h3>
                    <p className="text-cyan-400 font-mono text-[10px] uppercase tracking-widest mt-1">Generated Output</p>
                    
                    <div className="flex gap-2 mt-5 w-full">
                      <button
                        onClick={handlePlayToggle}
                        className={`flex-1 flex items-center justify-center gap-1.5 font-medium py-2 rounded-xl text-xs transition ${playing ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'bg-indigo-650 hover:bg-indigo-600 text-white'}`}
                      >
                        {playing ? <><PauseIcon className="w-4 h-4" /> Pause</> : <><PlayIcon className="w-4 h-4" /> Play Mix</>}
                      </button>
                      
                      <button
                        onClick={handleDownload}
                        className="p-2 border border-slate-750 hover:bg-slate-800 rounded-xl text-slate-300 transition"
                        title="Download Mix"
                      >
                        <DownloadIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleSaveToLibrary}
                        className="p-2 border border-slate-750 hover:bg-slate-800 rounded-xl text-slate-300 transition"
                        title="Save to Catalog"
                      >
                        <SaveIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* LYRICS & BLUEPRINT SUMMARY */}
                  <div className="md:col-span-8 space-y-4">
                    <div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Session Production Blueprint</div>
                      <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-xl text-xs text-slate-300 font-mono leading-relaxed max-h-24 overflow-y-auto">
                        {result.productionStyle}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Generated Lyrics</div>
                      <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-xl text-xs text-slate-400 font-mono leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
                        {result.lyrics}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {/* REAL-TIME MULTI-AGENT COORDINATION GRID */}
            <div className="bg-slate-900/70 border border-slate-850 rounded-2xl p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <CpuIcon className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-lg text-white font-mono">Agent Grid Status</h3>
                </div>
                {loading && (
                  <div className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded animate-pulse">
                    ACTIVE AGENTS RUNNING
                  </div>
                )}
              </div>

              {/* Grid of Agent Nodes */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(agentStates).map(([key, agent]) => {
                  let statusBg = 'bg-slate-950/40 border-slate-850 text-slate-500'
                  let glowStyle = ''
                  let statusText = 'IDLE'

                  if (agent.status === 'RUNNING') {
                    statusBg = 'bg-cyan-500/5 border-cyan-500/30 text-cyan-400 font-semibold'
                    glowStyle = 'shadow-[0_0_12px_rgba(6,182,212,0.15)] animate-pulse'
                    statusText = 'RUNNING'
                  } else if (agent.status === 'SUCCESS') {
                    statusBg = 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400'
                    statusText = 'SUCCESS'
                  } else if (agent.status === 'RETRYING') {
                    statusBg = 'bg-fuchsia-500/5 border-fuchsia-500/30 text-fuchsia-400'
                    glowStyle = 'shadow-[0_0_12px_rgba(217,70,239,0.15)]'
                    statusText = 'RETRYING'
                  } else if (agent.status === 'FAILED' || agent.status === 'ESCALATED') {
                    statusBg = 'bg-rose-500/5 border-rose-500/30 text-rose-400'
                    statusText = 'FAILED'
                  }

                  return (
                    <motion.div
                      key={key}
                      layout
                      className={`border rounded-xl p-3 flex flex-col justify-between text-left transition-all duration-300 ${statusBg} ${glowStyle}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getAgentIcon(agent.icon)}
                          <span className="font-semibold text-xs font-mono tracking-tight text-slate-200">{agent.name}</span>
                        </div>
                        <span className="text-[9px] font-mono tracking-wider opacity-70">{statusText}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-2 font-sans truncate">{agent.label}</p>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* LIVE TELEMETRY TERMINAL LOGS */}
            <div className="bg-slate-950 border border-slate-900 rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-slate-900/80 px-4 py-3 flex items-center justify-between border-b border-slate-950">
                <div className="flex items-center gap-2">
                  <TerminalIcon className="w-4 h-4 text-cyan-400" />
                  <span className="font-mono text-xs text-slate-300 font-bold uppercase tracking-wider">CascadeFlow Live Runtime Stream</span>
                </div>
                {traceId && (
                  <span className="font-mono text-[9px] text-slate-500">Trace ID: {traceId}</span>
                )}
              </div>

              {/* Scrolling Terminal Output Panel */}
              <div className="p-4 h-64 overflow-y-auto font-mono text-xs text-slate-400 space-y-2 select-text scrollbar-thin scrollbar-thumb-slate-800">
                {terminalLogs.length === 0 ? (
                  <div className="text-center py-20 text-slate-650 flex flex-col items-center justify-center">
                    <TerminalIcon className="w-8 h-8 opacity-20 mb-2" />
                    Console stream dormant. Start orchestration to stream agent processes.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {terminalLogs.map((log, idx) => {
                      let color = 'text-slate-450'
                      let prefix = '::'

                      if (log.type === 'system') {
                        color = 'text-cyan-400 font-semibold'
                        prefix = 'SYS'
                      } else if (log.type === 'running') {
                        color = 'text-indigo-400'
                        prefix = 'RUN'
                      } else if (log.type === 'success') {
                        color = 'text-emerald-400'
                        prefix = 'OK '
                      } else if (log.type === 'retry') {
                        color = 'text-fuchsia-400 font-semibold'
                        prefix = 'RTRY'
                      } else if (log.type === 'telemetry') {
                        color = 'text-amber-400/90 italic'
                        prefix = 'DATA'
                      } else if (log.type === 'error') {
                        color = 'text-rose-400 font-bold animate-pulse'
                        prefix = 'ERR'
                      }

                      return (
                        <div key={idx} className="leading-5 border-b border-slate-900/50 pb-1 flex flex-col">
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-slate-600 select-none">[{log.timestamp}]</span>
                            <span className={`text-[10px] select-none font-bold uppercase ${color}`}>{prefix}</span>
                            <span className={`${color} flex-1 break-all`}>{log.msg}</span>
                          </div>
                          {log.meta && (
                            <pre className="bg-slate-900/55 text-slate-500 p-2 rounded mt-1 border border-slate-850 overflow-x-auto text-[10px] whitespace-pre-wrap">
                              {log.meta}
                            </pre>
                          )}
                        </div>
                      )
                    })}
                    <div ref={terminalEndRef} />
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}