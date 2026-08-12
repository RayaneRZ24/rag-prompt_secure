import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { healthCheck, getDashboardStats } from '../api'
import {
  ShieldAlert, ShieldCheck, Activity, RefreshCw,
  CheckCircle2, XCircle, Clock, Zap, Fingerprint
} from 'lucide-react'

const LAYER_COLORS = ['#ef4444', '#f97316', '#22d3ee', '#a78bfa', '#34d399', '#f43f5e']
const CATEGORY_COLORS = { LLM01: '#ef4444', LLM02: '#f97316', LLM04: '#a78bfa', LLM05: '#f43f5e', LLM07: '#eab308', LLM08: '#22d3ee', 'Contenu dangereux': '#fb7185' }

function StatCard({ icon: Icon, label, value, sub, glow, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-white/[0.14] transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-extrabold text-white mt-2 tracking-tight">{value}</p>
          <p className="text-zinc-500 text-xs mt-1.5 font-medium">{sub}</p>
        </div>
        <div className={`p-3.5 rounded-xl bg-gradient-to-br ${glow}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-void-900 text-white text-xs rounded-xl px-3.5 py-2.5 shadow-2xl border border-white/10 font-mono">
      <p className="font-bold text-zinc-200 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color || p.fill }}>{p.name} : {p.value}</p>
      ))}
    </div>
  )
}

function EmptyChart({ label }) {
  return (
    <div className="h-full flex items-center justify-center text-zinc-600 text-sm font-medium">
      {label}
    </div>
  )
}

export default function Dashboard() {
  const [apiOk, setApiOk] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    healthCheck().then(() => setApiOk(true)).catch(() => setApiOk(false))
    getDashboardStats()
      .then(res => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const categoryData = stats ? Object.entries(stats.by_category).map(([name, blocked]) => ({ name, blocked })) : []
  const layerData = stats ? Object.entries(stats.by_layer).map(([name, blocked], i) => ({ name, blocked, color: LAYER_COLORS[i % LAYER_COLORS.length] })) : []
  const trendData = stats ? stats.activity_trend.map(t => ({ day: t.day.slice(5), requetes: t.total, bloquees: t.blocked })) : []

  return (
    <div className="min-h-screen p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight glow-text-red">Tableau de Bord Télémétrique</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              apiOk === null ? 'bg-white/5 text-zinc-400 border-white/10' :
              apiOk ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-red-500/10 text-red-400 border-red-500/25'}`}>
              <span className={`w-2 h-2 rounded-full ${apiOk ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {apiOk === null ? 'Vérification...' : apiOk ? 'API Gateway en ligne' : 'API hors ligne'}
            </span>
          </div>
          <p className="text-zinc-500 text-xs mt-1">Supervision de la sécurité du RAG Llama 3.1 8b · 5 Couches actives · données réelles</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 glass-panel rounded-xl px-4 py-2 text-xs font-medium text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>{new Date().toLocaleDateString('fr-FR')}</span>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 glass-panel hover:border-red-500/30 rounded-xl px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-all disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity}     label="Requêtes Totales"    value={stats?.total_requests ?? '—'}                        sub="Sur /query, cumul"          glow="from-zinc-700 to-zinc-800"  delay={0}    />
        <StatCard icon={ShieldAlert}  label="Attaques Bloquées"   value={stats?.blocked_requests ?? '—'}                      sub="Neutralisées par nos couches" glow="from-red-500 to-red-700"  delay={0.05} />
        <StatCard icon={ShieldCheck}  label="Taux de Blocage"     value={stats ? `${stats.protection_rate}%` : '—'}          sub="Part des requêtes stoppées"  glow="from-zinc-800 to-zinc-950"  delay={0.1}  />
        <StatCard icon={Zap}          label="Temps de Réponse"    value={stats ? `${(stats.avg_response_ms / 1000).toFixed(1)}s` : '—'} sub="Moyenne, requêtes autorisées" glow="from-red-600 to-red-800"  delay={0.15} />
      </div>

      {/* Main Charts Line 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* OWASP Bar Chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-white font-bold text-base tracking-tight">Attaques Bloquées par Catégorie OWASP</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Classification réelle des blocages, couches 2/4/5</p>
            </div>
            <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/25 px-3 py-1 rounded-full font-semibold">
              OWASP Top 10
            </span>
          </div>
          <div style={{ height: 220 }}>
            {categoryData.length === 0 ? <EmptyChart label="Aucun blocage enregistré pour l'instant" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} barSize={28}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717A', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717A' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="blocked" name="Bloquées" radius={[6, 6, 0, 0]}>
                    {categoryData.map((e) => <Cell key={e.name} fill={CATEGORY_COLORS[e.name] || '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Pie Chart par Couche */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-white font-bold text-base tracking-tight">Répartition par Couche</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Volume de blocage par niveau de sécurité</p>
          </div>
          <div className="py-2" style={{ height: 150 }}>
            {layerData.length === 0 ? <EmptyChart label="Aucune donnée" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={layerData} dataKey="blocked" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={4}>
                    {layerData.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            {layerData.map(l => (
              <div key={l.name} className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.color }} />
                  <span className="truncate">{l.name}</span>
                </div>
                <span className="font-mono font-bold text-white shrink-0">{l.blocked}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity Trend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-white font-bold text-base tracking-tight">Tendance d'Activité (7 derniers jours)</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Trafic réel vs blocages, par jour</p>
            </div>
          </div>
          <div style={{ height: 180 }}>
            {trendData.length === 0 ? <EmptyChart label="Pas encore d'historique" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#71717A', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717A' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="requetes"  name="Requêtes"  stroke="#a1a1aa" strokeWidth={2.5} dot={{ fill: '#a1a1aa', r: 3 }} />
                  <Line type="monotone" dataKey="bloquees"  name="Bloquées"  stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Live Security Log Feed */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-base tracking-tight">Derniers Événements</h2>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse glow-dot" /> Live
            </span>
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {!stats?.recent?.length ? <EmptyChart label="Aucun événement" /> : stats.recent.map((e) => (
              <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                {e.status_code >= 400
                  ? <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-200 text-xs font-semibold truncate">
                    {e.detail || `${e.method} ${e.endpoint}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-zinc-500 font-mono text-[11px]">
                      {new Date(e.timestamp * 1000).toLocaleTimeString('fr-FR')}
                    </span>
                    {e.category && (
                      <span className="text-[10px] bg-red-500/15 text-red-300 font-bold px-1.5 py-0.5 rounded font-mono">{e.category}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* PII footer note */}
      {stats?.pii_anonymized_count > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="glass-panel rounded-2xl p-4 flex items-center gap-3 text-sm text-zinc-400">
          <Fingerprint className="w-4 h-4 text-cyan-400 shrink-0" />
          <span><span className="text-white font-semibold">{stats.pii_anonymized_count}</span> requête(s) contenaient des données personnelles, anonymisées par Presidio avant traitement (LLM02).</span>
        </motion.div>
      )}
    </div>
  )
}
