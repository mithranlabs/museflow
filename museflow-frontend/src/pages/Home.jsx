import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { SparklesIcon, BrainIcon, Music4Icon } from 'lucide-react'
import '../css/Home.css'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
}

const childVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.6 } }
}

export default function Home() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
    >
      {/* Hero Section */}
      <motion.div variants={childVariants} className="text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
          <span className="gradient-text">MuseFlow</span>
        </h1>
        <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
          Multi‑agent AI music studio with memory — turn any emotion into a complete song.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            to="/studio"
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-md hover:shadow-lg"
          >
            Start Creating
          </Link>
          <Link
            to="/ai-agents"
            className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
          >
            Meet the Agents
          </Link>
        </div>
      </motion.div>

      {/* Feature Cards */}
      <motion.div variants={childVariants} className="mt-24 grid md:grid-cols-3 gap-8">
        {[
          { icon: BrainIcon, title: "Emotion + Memory", desc: "Hindsight agent remembers your style and past creations." },
          { icon: Music4Icon, title: "Full Music Suite", desc: "Lyrics, composition, vocals, cover art – all AI generated." },
          { icon: SparklesIcon, title: "Agent Orchestra", desc: "6 specialized agents collaborate like a professional studio." },
        ].map((feat, idx) => (
          <div key={idx} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition">
            <feat.icon className="w-10 h-10 text-indigo-500 mb-4" />
            <h3 className="text-xl font-semibold">{feat.title}</h3>
            <p className="text-gray-500 mt-2">{feat.desc}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}