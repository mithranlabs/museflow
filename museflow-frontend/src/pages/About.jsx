import { motion } from 'framer-motion'
import { UsersIcon, CpuIcon, HeartIcon, ZapIcon } from 'lucide-react'
import '../css/About.css'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
}

const childVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.5 } }
}

export default function About() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
    >
      <motion.div variants={childVariants} className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold gradient-text">About MuseFlow</h1>
        <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
          The world's first multi‑agent AI music studio with persistent memory — where every song learns from the last.
        </p>
      </motion.div>

      <motion.div variants={childVariants} className="mt-16 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">How It Works</h2>
          <p className="text-gray-600 leading-relaxed">
            You provide a mood, story, journal entry, or even a single emotion. Our six AI agents — Emotion Analysis,
            Memory (Hindsight), Lyrics, Composition, Critic, and Music Generation — collaborate like a professional studio.
            The Memory Agent remembers your tastes, favorite instruments, and past songs, ensuring each new creation is
            uniquely yours.
          </p>
          <div className="flex gap-4 pt-4">
            <div className="flex items-center gap-2"><CpuIcon className="w-5 h-5 text-indigo-500"/> <span>6 AI Agents</span></div>
            <div className="flex items-center gap-2"><HeartIcon className="w-5 h-5 text-indigo-500"/> <span>Emotion‑Driven</span></div>
            <div className="flex items-center gap-2"><ZapIcon className="w-5 h-5 text-indigo-500"/> <span>Real‑time Generation</span></div>
          </div>
        </div>
        <div className="">
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-indigo-200 rounded-full blur-2xl opacity-50"></div>
            <h3 className="text-xl font-semibold relative">The CascadeFlow Engine</h3>
            <p className="mt-2 text-gray-600 relative">
              Our proprietary orchestrator routes your input through agents in a perfect cascade — from emotion analysis
              to final mastering — guaranteeing coherence and artistic quality.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={childVariants} className="mt-20">
        <h2 className="text-2xl font-semibold text-center mb-8">Built for Creators</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { title: "Songwriters", desc: "Generate demo lyrics and melodies in seconds." },
            { title: "Producers", desc: "Export MIDI, stems, and production notes." },
            { title: "Storytellers", desc: "Turn journal entries into emotional soundscapes." }
          ].map((item) => (
            <div key={item.title} className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <UsersIcon className="w-8 h-8 text-indigo-500 mb-3" />
              <h3 className="font-semibold text-lg">{item.title}</h3>
              <p className="text-gray-500 text-sm mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}