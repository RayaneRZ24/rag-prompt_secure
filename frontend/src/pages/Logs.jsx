import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Search } from 'lucide-react'

const MOCK_LOGS = [
  { id: 1,  time: '21:44:31', user: 'admin', method: 'POST', endpoint: '/query',  status: 400, layer: 'Couche 2', detail: 'Injection détectée — balise XML système' },
  { id: 2,  time: '21:44:18', user: 'admin', method: 'POST', endpoint: '/query',  status: 400, layer: 'Couche 2', detail: 'Injection détectée — "sans restrictions"' },
  { id: 3,  time: '21:43:55', user: 'admin', method: 'POST', endpoint: '/query',  status: 400, layer: 'Couche 2', detail: 'Injection directe — "ignore instructions"' },
  { id: 4,  time: '21:43:40', user: 'admin', method: 'POST', endpoint: '/query',  status: 500, layer: 'Couche 3', detail: 'RAG pipeline — Qdrant non peuplé' },
  { id: 5,  time: '21:43:22', user: 'admin', method: 'POST', endpoint: '/query',  status: 400, layer: 'Couche 2', detail: 'Encodage Base64 — injection détectée' },
  { id: 6,  time: '21:43:05', user: 'admin', method: 'POST', endpoint: '/query',  status: 400, layer: 'Couche 4', detail: 'NeMo — sujet interdit : hacking offensif' },
  { id: 7,  time: '21:42:50', user: 'admin', method: 'POST', endpoint: '/query',  status: 500, layer: 'Couche 5', detail: 'PII anonymisé en sortie — EMAIL → <EMAIL_ADDRESS>' },
  { id: 8,  time: '21:42:30', user: 'admin', method: 'POST', endpoint: '/login',  status: 200, layer: '—',        detail: 'Authentification réussie — JWT émis (30min)' },
  { id: 9,  time: '21:42:10', user: '—',     method: 'POST', endpoint: '/login',  status: 401, layer: 'Couche 1', detail: 'Mot de passe incorrect — 3 tentatives restantes' },
  { id: 10, time: '21:41:55', user: '—',     method: 'GET',  endpoint: '/health', status: 200, layer: '—',        detail: 'Health check OK — tous services actifs' },
]

const STATUS_CONFIG = {
  200: { color: 'text-green-600',  bg: 'bg-green-50 border border-green-200',  icon: CheckCircle   },
  400: { color: 'text-red-600',    bg: 'bg-red-50 border border-red-200',      icon: XCircle       },
  401: { color: 'text-orange-600', bg: 'bg-orange-50 border border-orange-200',icon: AlertTriangle },
  500: { color: 'text-amber-600',  bg: 'bg-amber-50 border border-amber-200',  icon: AlertTriangle },
}

export default function Logs() {
  const [filter,  setFilter]  = useState('all')
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { setTimeout(() => setLoading(false), 500) }, [])

  const filtered = MOCK_LOGS.filter(log => {
    const matchFilter = filter === 'all' || String(log.status).startsWith(filter)
    const matchSearch = search === '' ||
      log.detail.toLowerCase().includes(search.toLowerCase()) ||
      log.endpoint.includes(search) || log.layer.includes(search)
    return matchFilter && matchSearch
  })

  return (
    <div className="min-h-screen bg-zinc-50 p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black">Logs de sécurité</h1>
          <p className="text-zinc-500 mt-0.5 text-sm">Historique des requêtes et événements de sécurité</p>
        </div>
        <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 500) }}
          className="flex items-center gap-2 text-zinc-600 bg-white border border-zinc-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-zinc-50 shadow-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { key: 'all', label: 'Tous',       count: MOCK_LOGS.length },
          { key: '2',   label: '2xx Succès', count: MOCK_LOGS.filter(l => String(l.status).startsWith('2')).length },
          { key: '4',   label: '4xx Bloqué', count: MOCK_LOGS.filter(l => String(l.status).startsWith('4')).length },
          { key: '5',   label: '5xx Erreur', count: MOCK_LOGS.filter(l => String(l.status).startsWith('5')).length },
        ].map(({ key, label, count }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? key === 'all' ? 'bg-black text-white' : key === '2' ? 'bg-green-600 text-white' : key === '4' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'}`}>
            {label}
            <span className={`text-xs font-bold px-1.5 rounded-full ${filter === key ? 'bg-white/20' : 'bg-zinc-100 text-zinc-500'}`}>{count}</span>
          </button>
        ))}
        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="bg-white border border-zinc-200 text-black text-sm pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-black transition-colors placeholder-zinc-400 w-48 shadow-sm" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-[90px_90px_55px_110px_110px_100px_1fr] gap-0 px-5 py-3 border-b border-zinc-100 text-zinc-400 text-xs font-semibold uppercase tracking-wide">
          <span>Heure</span><span>Utilisateur</span><span>Méth.</span>
          <span>Endpoint</span><span>Statut</span><span>Couche</span><span>Détail</span>
        </div>
        <div className="divide-y divide-zinc-50">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 grid grid-cols-[90px_90px_55px_110px_110px_100px_1fr] gap-0 animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => <div key={j} className="h-3 bg-zinc-100 rounded mr-4" />)}
                </div>
              ))
            : filtered.length === 0
              ? <div className="px-5 py-16 text-center text-zinc-400 text-sm">Aucun log trouvé</div>
              : filtered.map((log, i) => {
                  const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG[500]
                  const Icon = sc.icon
                  return (
                    <motion.div key={log.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.025 }}
                      className="grid grid-cols-[90px_90px_55px_110px_110px_100px_1fr] gap-0 px-5 py-3.5 hover:bg-zinc-50 transition-colors text-sm items-center">
                      <span className="text-zinc-400 font-mono text-xs">{log.time}</span>
                      <span className="text-zinc-700 text-xs">{log.user}</span>
                      <span className={`text-xs font-semibold font-mono ${log.method === 'GET' ? 'text-sky-600' : 'text-black'}`}>{log.method}</span>
                      <span className="text-zinc-500 text-xs font-mono">{log.endpoint}</span>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md w-fit ${sc.bg} ${sc.color}`}>
                        <Icon className="w-3 h-3" /> {log.status}
                      </span>
                      <span className="text-zinc-400 text-xs">{log.layer}</span>
                      <span className="text-zinc-600 text-xs truncate pr-4">{log.detail}</span>
                    </motion.div>
                  )
                })
          }
        </div>
      </div>
    </div>
  )
}

