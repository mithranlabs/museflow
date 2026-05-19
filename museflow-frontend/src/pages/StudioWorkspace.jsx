import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { saveSong } from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'
import SongResultCard from '../components/studio/SongResultCard'
import { 
  Wand2Icon, Music2Icon, TerminalIcon, CpuIcon, BrainIcon, 
  ActivityIcon, CheckCircle2Icon, AlertCircleIcon, RefreshCwIcon,
  HeartIcon, Volume2Icon, DiscIcon, SparklesIcon, DatabaseIcon,
  ChevronDownIcon, ChevronUpIcon
} from 'lucide-react'

// Icon mapping helper for agent status display
const getAgentIcon = (iconName) => {
  switch (iconName) {
    case 'BrainIcon': return <BrainIcon className="w-4 h-4 text-indigo-500" />
    case 'HeartIcon': return <HeartIcon className="w-4 h-4 text-rose-500" />
    case 'CpuIcon': return <CpuIcon className="w-4 h-4 text-amber-500" />
    case 'TerminalIcon': return <TerminalIcon className="w-4 h-4 text-emerald-500" />
    case 'ActivityIcon': return <ActivityIcon className="w-4 h-4 text-cyan-500" />
    case 'SparklesIcon': return <SparklesIcon className="w-4 h-4 text-fuchsia-500" />
    case 'Volume2Icon': return <Volume2Icon className="w-4 h-4 text-violet-500" />
    case 'DiscIcon': return <DiscIcon className="w-4 h-4 text-sky-500" />
    default: return <CpuIcon className="w-4 h-4 text-gray-400" />
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
  const [currentStageText, setCurrentStageText] = useState('Idle')
  const [traceId, setTraceId] = useState('')
  const [showLogs, setShowLogs] = useState(false)
  
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

  const terminalEndRef = useRef(null)

  // Auto-scroll terminal window
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [terminalLogs])

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
    setShowLogs(true) // Automatically expand log visualization when starting
    setCurrentStageText('Initializing connection to CascadeFlow network...')
    
    // Reset all agent statuses to idle
    setAgentStates(prev => {
      const updated = {}
      Object.keys(prev).forEach(key => {
        updated[key] = { ...prev[key], status: 'idle' }
      })
      return updated
    })

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

                if (state === 'RUNNING') {
                  appendLog(`Agent [${agent}] initialized execution: "${step}" using model tier [${model}]`, 'running')
                  
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

  const handleSave = async () => {
    if (!result) return
    const saved = await saveSong(result)
    if (saved.success) alert('Song saved to your library!')
    else alert('Save failed: ' + saved.error)
  }

  const handleDownload = (type, url) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `${result.songTitle}_${type}.mp3`
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
                disabled={loading}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm text-sm bg-white text-gray-800"
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
                      disabled={loading}
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

          {/* HINDSIGHT MEMORY PROFILE CARD */}
          {memoryProfile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3"
            >
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                <BrainIcon className="w-4 h-4 text-indigo-500" />
                Hindsight Memory Synthesis
              </h3>
              <div className="bg-indigo-50/50 border border-indigo-100 p-3.5 rounded-xl text-xs text-indigo-900 leading-relaxed font-mono">
                {memoryProfile}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column – RESULT PANEL & ORCHESTRATION telemetry */}
        <div className="space-y-6">
          
          {/* Active Generation Progress Indicator */}
          {loading && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-indigo-650">{currentStageText}</span>
                <span className="text-sm font-mono font-bold text-gray-500">{generationProgress}%</span>
              </div>
              <div className="w-full bg-gray-150 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${generationProgress}%` }} />
              </div>
            </div>
          )}

          {/* Dynamic Result Rendering */}
          {result && !loading ? (
            <div className="space-y-4">
              <SongResultCard
                song={result}
                onSave={handleSave}
                onDownload={handleDownload}
              />
              
              {/* Toggle Orchestration Trace Logs */}
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="w-full flex items-center justify-between border border-gray-200 bg-white hover:bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-600 font-medium transition shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <TerminalIcon className="w-4 h-4 text-indigo-500" />
                  View Live Orchestration Logs & Telemetry
                </span>
                {showLogs ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
              </button>
            </div>
          ) : null}

          {/* Standby placeholder state */}
          {!result && !loading && (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-200 shadow-sm">
              <Music2Icon className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-400" />
              <p className="text-gray-500">Your AI-generated song will appear here.</p>
            </div>
          )}

          {/* LIVE AGENT GRID & RUNTIME CONSOLE */}
          <AnimatePresence>
            {showLogs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 overflow-hidden"
              >
                {/* Agent status grid */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm border-b border-gray-100 pb-3">
                    <CpuIcon className="w-4.5 h-4.5 text-indigo-500" />
                    Agent Grid Orchestration
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                    {Object.entries(agentStates).map(([key, agent]) => {
                      let statusBg = 'bg-gray-50/50 border-gray-100 text-gray-400'
                      let glowStyle = ''
                      let statusText = 'IDLE'

                      if (agent.status === 'RUNNING') {
                        statusBg = 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                        glowStyle = 'shadow-[0_0_8px_rgba(99,102,241,0.08)] animate-pulse'
                        statusText = 'RUNNING'
                      } else if (agent.status === 'SUCCESS') {
                        statusBg = 'bg-emerald-50 border-emerald-150 text-emerald-700'
                        statusText = 'SUCCESS'
                      } else if (agent.status === 'RETRYING') {
                        statusBg = 'bg-amber-50 border-amber-150 text-amber-700'
                        statusText = 'RETRYING'
                      } else if (agent.status === 'FAILED' || agent.status === 'ESCALATED') {
                        statusBg = 'bg-rose-50 border-rose-150 text-rose-700'
                        statusText = 'FAILED'
                      }

                      return (
                        <div
                          key={key}
                          className={`border rounded-xl p-2.5 flex flex-col justify-between text-left transition-all duration-350 ${statusBg} ${glowStyle}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-1.5">
                              {getAgentIcon(agent.icon)}
                              <span className="font-semibold text-[11px] font-sans text-gray-700">{agent.name}</span>
                            </div>
                            <span className="text-[8px] font-mono tracking-wider opacity-80">{statusText}</span>
                          </div>
                          <p className="text-[9px] text-gray-500 mt-1 truncate">{agent.label}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Console Logs Terminal */}
                <div className="bg-gray-900 border border-gray-950 rounded-2xl shadow-lg overflow-hidden text-gray-200">
                  <div className="bg-gray-800/80 px-4 py-2.5 flex items-center justify-between border-b border-gray-950">
                    <div className="flex items-center gap-2">
                      <TerminalIcon className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-xs text-gray-300 font-bold uppercase tracking-wider">CascadeFlow Live Runtime Stream</span>
                    </div>
                    {traceId && (
                      <span className="font-mono text-[9px] text-gray-550">Trace ID: {traceId}</span>
                    )}
                  </div>

                  <div className="p-4 h-60 overflow-y-auto font-mono text-[11px] text-gray-300 space-y-2 select-text scrollbar-thin scrollbar-thumb-gray-850">
                    {terminalLogs.length === 0 ? (
                      <div className="text-center py-20 text-gray-500 flex flex-col items-center justify-center">
                        <TerminalIcon className="w-6 h-6 opacity-30 mb-2" />
                        Console stream dormant. Start orchestration to stream agent processes.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {terminalLogs.map((log, idx) => {
                          let color = 'text-gray-300'
                          let prefix = '::'

                          if (log.type === 'system') {
                            color = 'text-cyan-400 font-semibold'
                            prefix = 'SYS'
                          } else if (log.type === 'running') {
                            color = 'text-indigo-300'
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
                            color = 'text-rose-450 font-bold animate-pulse'
                            prefix = 'ERR'
                          }

                          return (
                            <div key={idx} className="leading-4 border-b border-gray-800/40 pb-1 flex flex-col">
                              <div className="flex items-start gap-2">
                                <span className="text-[9px] text-gray-550 select-none">[{log.timestamp}]</span>
                                <span className={`text-[9px] select-none font-bold uppercase ${color}`}>{prefix}</span>
                                <span className={`${color} flex-1 break-all`}>{log.msg}</span>
                              </div>
                              {log.meta && (
                                <pre className="bg-gray-950/60 text-gray-400 p-2 rounded mt-1 border border-gray-850 overflow-x-auto text-[9px] whitespace-pre-wrap leading-relaxed">
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}