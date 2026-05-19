import { CpuIcon, CheckCircleIcon, ClockIcon } from 'lucide-react'

export default function AgentCard({ name, status, description, lastActive }) {
  return (
    <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <CpuIcon className="w-8 h-8 text-indigo-500" />
          <div>
            <h3 className="font-semibold text-lg">{name}</h3>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
        </div>
        {status === 'active' ? (
          <CheckCircleIcon className="w-5 h-5 text-green-500" />
        ) : (
          <ClockIcon className="w-5 h-5 text-yellow-500" />
        )}
      </div>
      <div className="mt-3 text-right">
        <span className="text-xs text-gray-400">last active: {lastActive || 'just now'}</span>
      </div>
    </div>
  )
}