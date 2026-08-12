import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sendQuery } from '../api'
import { Send, ShieldAlert, User, Bot, Shield, WifiOff, Sparkles, Trophy, Film, ShieldCheck, Globe, Plus, X, MessageSquare } from 'lucide-react'

const STORAGE_KEY = 'securerag_chat_sessions'
const MAX_SESSIONS = 4

const WELCOME_MSG = {
  role: 'assistant',
  type: 'normal',
  content: 'Bonjour ! Je suis votre assistant IA. Posez-moi des questions sur la cybersécurité, le RGPD, ou des sujets généraux (sports, films, actualités).',
  id: 0,
}

function makeSession() {
  return {
    id: Date.now() + Math.random(),
    title: 'Nouvelle conversation',
    messages: [WELCOME_MSG],
    updatedAt: Date.now(),
  }
}

// Persistées en localStorage (pas en state React seul) car React Router démonte
// le composant Chat quand on navigue vers une autre page du site — un simple
// useState perdrait la conversation à chaque changement d'onglet.
function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.sessions?.length) return null
    return parsed
  } catch {
    return null
  }
}

function saveSessions(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={`flex gap-3.5 ${isUser ? 'flex-row-reverse' : ''}`}>

      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xs ${
        isUser ? 'bg-white/10 border border-white/15' : 'bg-gradient-to-br from-red-500 to-red-700 glow-border-red'}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className={`max-w-[75%] flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {msg.type === 'blocked' ? (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 text-red-300 text-sm font-bold uppercase tracking-wider mb-2">
              <ShieldAlert className="w-4 h-4 text-red-400" /> Requête Bloquée par la Sécurité
            </div>
            <p className="text-red-200/90 text-base leading-relaxed">{msg.content}</p>
          </div>
        ) : msg.type === 'server_error' ? (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 text-amber-300 text-sm font-bold uppercase tracking-wider mb-2">
              <WifiOff className="w-4 h-4 text-amber-400" /> Service Momentanément Indisponible
            </div>
            <p className="text-amber-200/90 text-base leading-relaxed">{msg.content}</p>
          </div>
        ) : (
          <div className={`rounded-2xl px-5 py-3.5 text-base leading-relaxed ${
            isUser
              ? 'bg-gradient-to-br from-red-600 to-red-700 text-white font-normal glow-border-red'
              : 'glass-panel text-zinc-100'}`}>
            {msg.content}
          </div>
        )}

        {msg.source && msg.type !== 'blocked' && msg.type !== 'server_error' && (
          <div className="flex items-center gap-1.5 text-sm text-zinc-500 px-1 pt-0.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">Vérifié</span>
            <span>· Source : {msg.source}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white shrink-0 glow-border-red">
        <Bot className="w-4 h-4" />
      </div>
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.span key={i} className="w-2 h-2 bg-zinc-400 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.5, delay: i * 0.15, repeat: Infinity }} />
        ))}
      </div>
    </div>
  )
}

const CATEGORIZED_SUGGESTIONS = [
  { icon: Trophy, label: 'Sport & Actu', query: 'Qui a remporté la Ligue des Champions 2023 ?' },
  { icon: Film, label: 'Cinéma', query: 'Parle-moi du film Inception et de son réalisateur' },
  { icon: Globe, label: 'Politique & Monde', query: 'Quels sont les enjeux majeurs du changement climatique ?' },
  { icon: Shield, label: 'Cybersécurité', query: 'Quelles sont les meilleures pratiques de sécurité mot de passe ?' },
  { icon: Sparkles, label: 'RGPD', query: 'Quelles sont les règles de confidentialité RGPD pour les données ?' },
]

export default function Chat() {
  const [sessions, setSessions] = useState(() => loadSessions()?.sessions || [makeSession()])
  const [activeId,  setActiveId] = useState(() => loadSessions()?.activeId || sessions[0].id)
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  const activeSession = sessions.find(s => s.id === activeId) || sessions[0]
  const messages = activeSession.messages

  useEffect(() => {
    saveSessions({ sessions, activeId })
  }, [sessions, activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const updateActiveSession = (updater) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== activeId) return s
      const nextMessages = updater(s.messages)
      const firstUserMsg = nextMessages.find(m => m.role === 'user')
      return {
        ...s,
        messages: nextMessages,
        title: firstUserMsg ? firstUserMsg.content.slice(0, 40) : s.title,
        updatedAt: Date.now(),
      }
    }))
  }

  const newSession = () => {
    const fresh = makeSession()
    setSessions(prev => {
      // Max 4 sessions : on retire la plus ancienne pour laisser la place,
      // plutôt que de bloquer la création — évite de surcharger le stockage/l'UI.
      const next = prev.length >= MAX_SESSIONS
        ? [...prev].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS - 1)
        : prev
      return [...next, fresh]
    })
    setActiveId(fresh.id)
  }

  const deleteSession = (id, e) => {
    e.stopPropagation()
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (next.length === 0) {
        const fresh = makeSession()
        setActiveId(fresh.id)
        return [fresh]
      }
      if (id === activeId) setActiveId(next[0].id)
      return next
    })
  }

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    const userMsg = { role: 'user', type: 'normal', content: q, id: Date.now() }
    updateActiveSession(m => [...m, userMsg])
    setLoading(true)
    try {
      const res = await sendQuery(q)
      updateActiveSession(m => [...m, {
        role: 'assistant', type: 'normal',
        content: res.data.answer,
        source: res.data.source,
        id: Date.now() + 1,
      }])
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail || ''
      // Un blocage de sécurité peut arriver en 400 (couche 2, entrée) ou en
      // 500 (couche 5, après génération — ex: fuite de prompt système LLM07).
      // Se fier au message plutôt qu'au seul code HTTP distingue un vrai
      // blocage volontaire d'une vraie panne serveur (Ollama down, etc.).
      const isSecurityBlock = detail.includes('bloquée par le système de sécurité')
      updateActiveSession(m => [...m, {
        role: 'assistant',
        type: isSecurityBlock ? 'blocked' : 'server_error',
        content: isSecurityBlock
          ? (detail || 'Contenu non autorisé par les politiques de sécurité OWASP.')
          : detail
            ? `Erreur du backend (${status || 'réseau'}) : ${detail}`
            : 'Le service de recherche documentaire est momentanément indisponible. Veuillez réessayer dans quelques instants.',
        id: Date.now() + 1,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen relative">
      {/* Header Bar */}
      <div className="glass-panel border-x-0 border-t-0 px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-white font-bold text-xl tracking-tight">Assistant Chat RAG</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/5 text-zinc-300 border border-white/10">
              Llama 3.1 8b
            </span>
          </div>
          <p className="text-zinc-500 text-sm mt-0.5">Sujets autorisés : Culture générale, Sport, Films, RGPD, Cybersécurité</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300 glass-panel px-3.5 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse glow-dot" />
          5 Couches OWASP Actives
        </div>
      </div>

      {/* Session Tabs */}
      <div className="border-b border-white/[0.06] px-8 py-2.5 flex items-center gap-2 relative z-20 overflow-x-auto">
        {sessions.map(s => (
          <button key={s.id} onClick={() => setActiveId(s.id)}
            className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0 max-w-[220px] ${
              s.id === activeId
                ? 'bg-red-500/10 text-red-200 border border-red-500/25'
                : 'text-zinc-400 border border-transparent hover:bg-white/[0.04] hover:text-zinc-200'}`}>
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{s.title}</span>
            {sessions.length > 1 && (
              <X className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                onClick={(e) => deleteSession(s.id, e)} />
            )}
          </button>
        ))}
        <button onClick={newSession}
          title={sessions.length >= MAX_SESSIONS ? `Max ${MAX_SESSIONS} sessions — la plus ancienne sera remplacée` : 'Nouvelle conversation'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-500 border border-white/10 border-dashed hover:text-white hover:border-red-500/30 transition-all shrink-0">
          <Plus className="w-3.5 h-3.5" />
          Nouvelle
        </button>
        <span className="text-xs text-zinc-600 ml-auto shrink-0 pl-2">{sessions.length}/{MAX_SESSIONS} sessions</span>
      </div>

      {/* Messages Canvas */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5 relative z-10">
        <AnimatePresence>
          {messages.map(msg => <Message key={msg.id} msg={msg} />)}
        </AnimatePresence>
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Quick Suggestions Chips */}
      {messages.length <= 2 && (
        <div className="px-8 pb-3 relative z-10">
          <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Exemples de questions autorisées :</p>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIZED_SUGGESTIONS.map(({ icon: Icon, label, query }) => (
              <button key={query} onClick={() => send(query)}
                className="flex items-center gap-2 text-sm glass-panel hover:border-red-500/30 hover:text-white text-zinc-300 px-3.5 py-2 rounded-xl transition-all group font-medium">
                <Icon className="w-3.5 h-3.5 text-red-400 group-hover:text-red-300 transition-colors" />
                <span>{query}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="glass-panel border-x-0 border-b-0 px-8 py-4 relative z-10">
        <form onSubmit={e => { e.preventDefault(); send() }} className="flex gap-3 max-w-5xl mx-auto">
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Posez votre question (sports, films, RGPD, sécurité...)"
            disabled={loading}
            className="flex-1 bg-black/25 border border-white/10 text-zinc-100 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-red-500/50 transition-all placeholder-zinc-600 font-medium disabled:opacity-50" />
          <button type="submit" disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-40 text-white px-5 py-3.5 rounded-xl transition-all glow-border-red flex items-center gap-2 font-semibold text-base shrink-0">
            <span>Envoyer</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center text-zinc-500 text-xs mt-2">
          Les tentatives de hacking, jailbreak ou requêtes illégales sont automatiquement filtrées par le système.
        </p>
      </div>
    </div>
  )
}
