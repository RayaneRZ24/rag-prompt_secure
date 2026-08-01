import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { healthCheck } from '../api'
import {
  ShieldAlert, ShieldCheck, Activity, TrendingUp,
  CheckCircle, XCircle, Clock, Zap,
} from 'lucide-react'

// ── Données simulées (en prod : endpoint FastAPI /stats) ──────────────────────

const OWASP_DATA = [
  { name: 'LLM01', label: 'Prompt Injection',   blocked: 47, total: 52 },
  { name: 'LLM02', label: 'Sensitive Data',      blocked: 31, total: 34 },
  { name: 'LLM04', label: 'Data Poisoning',      blocked: 12, total: 12 },
  { name: 'LLM05', label: 'Output Handling',     blocked: 28, total: 30 },
  { name: 'LLM07', label: 'System Prompt Leak',  blocked: 19, total: 22 },
  { name: 'LLM09', label: 'Overreliance',        blocked: 8,  total: 11 },
]

const ACTIVITY_DATA = [
  { day: 'Lun', requetes: 34, bloquees: 12 },
  { day: 'Mar', requetes: 52, bloquees: 21 },
  { day: 'Mer', requetes: 41, bloquees: 15 },
  { day: 'Jeu', requetes: 67, bloquees: 29 },
  { day: 'Ven', requetes: 58, bloquees: 18 },
  { day: 'Sam', requetes: 23, bloquees: 7  },
  { day: 'Auj', requetes: 38, bloquees: 14 },
]

const LAYER_STATS = [
  { name: 'Couche 1 — JWT',           blocked: 8,  color: '#ef4444' },
  { name: 'Couche 2 — Input Guard',   blocked: 63, color: '#dc2626' },
  { name: 'Couche 4 — NeMo',          blocked: 31, color: '#b91c1c' },
  { name: 'Couche 5 — Output Guard',  blocked: 14, color: '#991b1b' },
]

const RECENT = [
  { time: '21:44', type: 'block', cat: 'LLM01', msg: 'Injection via balise XML bloquée' },
  { time: '21:43', type: 'block', cat: 'LLM05', msg: 'Encodage Base64 détecté' },
  { time: '21:42', type: 'allow', cat: '—',     msg: 'Requête légitime traitée' },
  { time: '21:41', type: 'block', cat: 'LLM01', msg: 'Tentative DAN jailbreak bloquée' },
  { time: '21:40', type: 'allow', cat: '—',     msg: 'Authentification JWT réussie' },
  { time: '21:39', type: 'block', cat: 'LLM02', msg: 'PII (email) anonymisé en sortie' },
]

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-500 text-base font-medium">{label}</p>
          <p className="text-4xl font-bold text-black mt-1">{value}</p>
          <p className="text-zinc-400 text-xs mt-1">{sub}</p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-black text-white text-xs rounded-lg px-3 py-2 shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name} : {p.value}</p>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [apiOk, setApiOk] = useState(null)

  useEffect(() => {
    healthCheck().then(() => setApiOk(true)).catch(() => setApiOk(false))
  }, [])

  const totalBlocked = OWASP_DATA.reduce((s, d) => s + d.blocked, 0)
  const totalReqs    = ACTIVITY_DATA.reduce((s, d) => s + d.requetes, 0)
  const rate         = Math.round(totalBlocked / ACTIVITY_DATA.reduce((s, d) => s + d.bloquees, 0) * 100)

  return (
    <div className="min-h-screen bg-zinc-50 p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black">Dashboard</h1>
          <p className="text-zinc-500 mt-0.5 text-base">
            Système actif ·{' '}
            <span className={`font-medium ${apiOk === null ? 'text-zinc-400' : apiOk ? 'text-green-600' : 'text-red-600'}`}>
              {apiOk === null ? 'Vérification...' : apiOk ? 'API en ligne' : 'API hors ligne'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm text-zinc-500 shadow-sm">
          <Clock className="w-4 h-4" /> Aujourd'hui · {new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Activity}    label="Requêtes totales"   value={totalReqs}     sub="7 derniers jours"       color="bg-black"        delay={0}    />
        <StatCard icon={ShieldAlert} label="Attaques bloquées"  value={totalBlocked}  sub="Toutes catégories"      color="bg-red-600"      delay={0.05} />
        <StatCard icon={ShieldCheck} label="Taux de protection" value={`${rate}%`}    sub="Couches actives : 5"    color="bg-red-800"      delay={0.1}  />
        <StatCard icon={Zap}         label="Temps de réponse"   value="1.2s"          sub="Médiane sur 24h"        color="bg-zinc-700"     delay={0.15} />
      </div>

      {/* Graphiques ligne 1 */}
      <div className="grid grid-cols-3 gap-4">
        {/* Barres OWASP */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="col-span-2 bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-black font-semibold">Attaques bloquées par catégorie OWASP</h2>
              <p className="text-zinc-400 text-xs mt-0.5">Nombre de requêtes bloquées par type de risque LLM</p>
            </div>
            <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full font-medium">
              LLM Top 10
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={OWASP_DATA} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="blocked" name="Bloquées" fill="#dc2626" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total"   name="Total"    fill="#f4f4f5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie par couche */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
          <h2 className="text-black font-semibold mb-1">Blocages par couche</h2>
          <p className="text-zinc-400 text-xs mb-4">Distribution des blocages</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={LAYER_STATS} dataKey="blocked" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                {LAYER_STATS.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip content={({ active, payload }) => active && payload?.length
                ? <div className="bg-black text-white text-xs rounded-lg px-3 py-2">{payload[0].name} : {payload[0].value}</div>
                : null} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {LAYER_STATS.map(l => (
              <div key={l.name} className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.color }} />
                <span className="truncate">{l.name}</span>
                <span className="ml-auto font-semibold text-black">{l.blocked}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Graphiques ligne 2 */}
      <div className="grid grid-cols-3 gap-4">
        {/* Activité semaine */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="col-span-2 bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
          <h2 className="text-black font-semibold mb-1">Activité des 7 derniers jours</h2>
          <p className="text-zinc-400 text-xs mb-5">Requêtes totales vs attaques bloquées</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={ACTIVITY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="requetes"  name="Requêtes"  stroke="#18181b" strokeWidth={2} dot={{ fill: '#18181b', r: 3 }} />
              <Line type="monotone" dataKey="bloquees"  name="Bloquées"  stroke="#dc2626" strokeWidth={2} dot={{ fill: '#dc2626', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Événements récents */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
          <h2 className="text-black font-semibold mb-4">Événements récents</h2>
          <div className="space-y-3">
            {RECENT.map((e, i) => (
              <div key={i} className="flex items-start gap-2.5">
                {e.type === 'block'
                  ? <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  : <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-black text-xs font-medium truncate">{e.msg}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-zinc-400 text-xs">{e.time}</span>
                    {e.cat !== '—' && (
                      <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-mono">{e.cat}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

