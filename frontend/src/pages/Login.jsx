import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Shield, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react'
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
    } catch {
      setError('Identifiant ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Panel gauche — branding */}
      <div className="hidden lg:flex w-1/2 bg-black flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">RAG Secure</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Système RAG<br />
            <span className="text-red-500">sécurisé</span> par<br />
            5 couches OWASP
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Protection complète : JWT · Presidio · LlamaFirewall ·
            LangChain RAG · NeMo Guardrails · Détection ASCII Smuggling
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {['LLM01 Prompt Injection','LLM02 Sensitive Data','LLM05 Output Handling','LLM07 System Prompt'].map(t => (
              <div key={t} className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
        <p className="text-zinc-600 text-xs">© 2026 — Plateforme de sécurité RAG</p>
      </div>

      {/* Panel droit — formulaire */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-black">Connexion</h2>
            <p className="text-zinc-500 text-sm mt-1">Accédez à votre espace sécurisé</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-black text-sm font-medium mb-1.5 block">Identifiant</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-white border-2 border-zinc-200 text-black rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-black transition-colors placeholder-zinc-400"
                  required />
              </div>
            </div>
            <div>
              <label className="text-black text-sm font-medium mb-1.5 block">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••••"
                  className="w-full bg-white border-2 border-zinc-200 text-black rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-black transition-colors placeholder-zinc-400"
                  required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-2 shadow-lg shadow-red-200">
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex items-center justify-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> JWT sécurisé</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Rate limité</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> bcrypt</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

