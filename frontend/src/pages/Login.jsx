import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Shield, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { login } = useAuth()
  const navigate  = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Identifiant ou mot de passe incorrect')
      } else if (err.response) {
        setError(`Erreur serveur (${err.response.status})`)
      } else {
        setError('Serveur injoignable — vérifie que le backend tourne')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-void-950 flex select-none relative overflow-hidden">
      <div className="cyber-backdrop" />
      {/* Panel gauche — Branding & Télémetrie de Sécurité */}
      <div className="hidden lg:flex w-[48%] flex-col justify-between p-12 relative z-10 border-r border-white/[0.06]">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center text-white glow-border-red">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <span className="text-white font-bold text-lg tracking-tight">SecureRAG</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/25">
              v1.0.0
            </span>
          </div>
        </div>

        <div className="relative z-10 my-auto py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-xs text-zinc-300 mb-6 font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse glow-dot" />
            Portail RAG Sécurisé
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight mb-6">
            Défense en profondeur <br />
            pour les <span className="text-red-500 glow-text-red">Systèmes LLM</span>.
          </h1>

          <p className="text-zinc-400 text-base leading-relaxed max-w-md font-normal mb-10">
            Architecture sécurisée combinant JWT, PromptGuard, Llama Guard 3, NeMo Guardrails et Presidio — 6 couches actives.
          </p>

          <div className="grid grid-cols-3 gap-3 max-w-lg">
            {[
              { code: 'LLM01', label: 'Prompt Injection' },
              { code: 'LLM02', label: 'Sensitive Data' },
              { code: 'LLM04', label: 'Data Poisoning' },
              { code: 'LLM05', label: 'Output Handling' },
              { code: 'LLM07', label: 'Prompt Leak' },
              { code: 'LLM08', label: 'Vector Weakness' },
            ].map(item => (
              <div key={item.code} className="flex items-center gap-2.5 p-3 rounded-xl glass-panel text-xs">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-white font-semibold">{item.code}</p>
                  <p className="text-zinc-400 text-[11px]">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-500">
          <span>© 2026 SecureRAG.</span>
          <span className="font-mono">Llama 3.1 8b · Qdrant · FastAPI</span>
        </div>
      </div>

      {/* Panel droit — Formulaire de connexion */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="w-full max-w-md glass-panel rounded-3xl p-8 sm:p-10">

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Connexion Administrateur</h2>
            <p className="text-zinc-500 text-sm mt-1.5">Entrez vos identifiants pour accéder au dashboard RAG.</p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 text-red-300 text-sm px-4 py-3 rounded-xl mb-6">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span className="font-medium">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-zinc-300 text-xs font-semibold uppercase tracking-wider mb-2 block">
                Identifiant
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-black/25 border border-white/10 text-zinc-100 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-all placeholder-zinc-600 font-medium"
                  required />
              </div>
            </div>

            <div>
              <label className="text-zinc-300 text-xs font-semibold uppercase tracking-wider mb-2 block">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••••••"
                  className="w-full bg-black/25 border border-white/10 text-zinc-100 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-all placeholder-zinc-600 font-medium"
                  required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 glow-border-red group mt-4">
              <span>{loading ? 'Vérification en cours...' : 'Se connecter'}</span>
              {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-500 flex-wrap gap-2">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> JWT Bearer</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Rate Limited (5/min)</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Bcrypt</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
