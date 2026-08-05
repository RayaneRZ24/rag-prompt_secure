import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { getLogs } from '../api'

const STATUS_CONFIG = {
  2: { color: 'text-emerald-300 font-bold', bg: 'bg-emerald-500/10 border border-emerald-500/25', icon: CheckCircle2 },
  4: { color: 'text-red-300 font-bold',     bg: 'bg-red-500/10 border border-red-500/25',         icon: XCircle      },
  5: { color: 'text-orange-300 font-bold',  bg: 'bg-orange-500/10 border border-orange-500/25',   icon: AlertTriangle},
}

function statusConfig(code) {
  return STATUS_CONFIG[Math.floor(code / 100)] || STATUS_CONFIG[5]
}

export default function Logs() {
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getLogs(filter === 'all' ? undefined : `${filter}xx`)
      .then(res => setLogs(res.data.logs))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  const counts = { all: logs.length }

  const filtered = logs.filter(log => {
    if (search === '') return true
    const haystack = `${log.detail || ''} ${log.endpoint} ${log.layer || ''} ${log.username || ''}`.toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  return (
    <div className="min-h-screen p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight glow-text-red">Logs de Sécurité</h1>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-zinc-300 border border-white/10 font-mono">
              Audit Trail
            </span>
          </div>
          <p className="text-zinc-500 text-xs mt-1">Historique réel des requêtes et interventions des 6 couches OWASP</p>
        </div>

        <button onClick={load}
          className="flex items-center gap-2 text-zinc-200 glass-panel hover:border-red-500/30 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser les Logs
        </button>
      </div>

      {/* Control Bar & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all', label: 'Tous les logs' },
            { key: '2',   label: '2xx Autorisé'  },
            { key: '4',   label: '4xx Bloqué'    },
            { key: '5',   label: '5xx Erreur'    },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                filter === key
                  ? key === 'all' ? 'bg-white text-void-950' : key === '2' ? 'bg-emerald-500 text-void-950' : key === '4' ? 'bg-red-600 text-white glow-border-red' : 'bg-orange-600 text-white'
                  : 'glass-panel text-zinc-400 hover:text-zinc-200'}`}>
              <span>{label}</span>
              {key === 'all' && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === key ? 'bg-void-950/15' : 'bg-white/10'}`}>{counts.all}</span>}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans les logs..."
            className="w-full sm:w-64 glass-panel text-zinc-100 text-xs pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:border-red-500/40 transition-all placeholder-zinc-500 font-medium" />
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[110px_90px_70px_120px_100px_150px_1fr] gap-2 px-6 py-3.5 border-b border-white/[0.06] text-zinc-500 text-[11px] font-bold uppercase tracking-wider bg-white/[0.02]">
          <span>Horodatage</span>
          <span>Utilisateur</span>
          <span>Méthode</span>
          <span>Endpoint</span>
          <span>Statut</span>
          <span>Couche</span>
          <span>Détail de l'Action</span>
        </div>

        <div className="divide-y divide-white/[0.05]">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-6 py-4 grid grid-cols-[110px_90px_70px_120px_100px_150px_1fr] gap-2 animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => <div key={j} className="h-3.5 bg-white/[0.06] rounded mr-2" />)}
                </div>
              ))
            : filtered.length === 0
              ? <div className="px-6 py-16 text-center text-zinc-500 text-xs font-medium">Aucun log correspondant aux critères.</div>
              : filtered.map((log, i) => {
                  const sc = statusConfig(log.status_code)
                  const Icon = sc.icon
                  return (
                    <motion.div key={log.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className="grid grid-cols-[110px_90px_70px_120px_100px_150px_1fr] gap-2 px-6 py-3.5 hover:bg-white/[0.03] transition-colors text-xs items-center">

                      <span className="text-zinc-500 font-mono text-[11px]">
                        {new Date(log.timestamp * 1000).toLocaleTimeString('fr-FR')}
                      </span>
                      <span className="text-zinc-300 font-semibold truncate">{log.username || '—'}</span>
                      <span className={`font-mono font-bold ${log.method === 'GET' ? 'text-cyan-400' : 'text-zinc-100'}`}>
                        {log.method}
                      </span>
                      <span className="text-zinc-500 font-mono text-[11px] truncate">{log.endpoint}</span>

                      <div>
                        <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-md ${sc.bg} ${sc.color}`}>
                          <Icon className="w-3 h-3" /> {log.status_code}
                        </span>
                      </div>

                      <span className="text-zinc-500 font-medium text-[11px] truncate">{log.layer || '—'}</span>
                      <span className="text-zinc-300 font-medium truncate pr-2">
                        {log.detail || `${log.method} ${log.endpoint}`}
                      </span>
                    </motion.div>
                  )
                })
          }
        </div>
      </div>
    </div>
  )
}
