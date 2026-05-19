import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getAgentsStatus } from '../services/api'
import AgentCard from '../components/studio/AgentCard'
import LoadingSpinner from '../components/common/LoadingSpinner'
import '../css/AIAgents.css'

export default function AIAgents() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAgentsStatus().then(res => {
      if (res.success) setAgents(res.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
    >
      <h1 className="text-3xl font-bold gradient-text">AI Agents Orchestra</h1>
      <p className="text-gray-600 mt-2 mb-8">Six specialized agents collaborating in real time.</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent, idx) => (
          <motion.div
            key={agent.name}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: idx * 0.1 }}
          >
            <AgentCard {...agent} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}