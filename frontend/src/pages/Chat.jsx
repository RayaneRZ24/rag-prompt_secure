import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sendQuery } from '../api'
import { Send, ShieldAlert, User, Bot, AlertTriangle, Shield, WifiOff } from 'lucide-react'

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${
        isUser ? 'bg-black' : 'bg-zinc-700'}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[72%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {msg.type === 'blocked' ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 text-red-600 text-sm font-semibold mb-1">
              <ShieldAlert className="w-4 h-4" /> Requête bloquée par sécurité
            </div>
            <p className="text-red-700 text-sm">{msg.content}</p>
          </div>
        ) : msg.type === 'server_error' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 text-amber-600 text-sm font-semibold mb-1">
              <WifiOff className="w-4 h-4" /> Erreur serveur
            </div>
            <p className="text-amber-700 text-sm">{msg.content}</p>
          </div>
        ) : (
          <div className={`rounded-2xl px-4 py-3 text-base shadow-sm ${
            isUser ? 'bg-black text-white' : 'bg-white text-black border border-zinc-200'}`}>
            {msg.content}
          </div>
        )}
        {msg.source && msg.type !== 'blocked' && msg.type !== 'server_error' && (
          <div className="flex items-center gap-1.5 text-zinc-400 text-sm px-1">
            <Shield className="w-3 h-3 text-green-500" />
            <span className="text-green-600 font-medium">Vérifié</span>
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
      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-zinc-200 rounded-2xl px-4 py-3 flex items-center gap-1.5 shadow-sm">
        {[0, 1, 2].map(i => (
          <motion.span key={i} className="w-2 h-2 bg-zinc-400 rounded-full"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.5, delay: i * 0.12, repeat: Infinity }} />
        ))}
      </div>
    </div>
  )
}

const EXAMPLES = [
  'Quelle est la politique de mot de passe ?',
  'Comment sécuriser un accès SSH ?',
  'Quelles sont les bonnes pratiques OWASP ?',
]

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', type: 'normal', content: 'Bonjour ! Posez-moi vos questions sur la sécurité informatique.', id: 0 }
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    const userMsg = { role: 'user', type: 'normal', content: q, id: Date.now() }
    setMessages(m => [...m, userMsg])
    setLoading(true)
    try {
      const res = await sendQuery(q)
      setMessages(m => [...m, {
        role: 'assistant', type: 'normal',
        content: res.data.answer,
        source: res.data.source,
        id: Date.now() + 1,
      }])
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail || ''
      // 400/403 = bloqué par sécurité intentionnellement
      // 500 = erreur serveur (service indisponible)
      const isSecurityBlock = status === 400 || status === 403
      setMessages(m => [...m, {
        role: 'assistant',
        type: isSecurityBlock ? 'blocked' : 'server_error',
        content: isSecurityBlock
          ? (detail || 'Contenu non autorisé par les politiques de sécurité.')
          : 'Le service de recherche documentaire est momentanément indisponible. Veuillez réessayer dans quelques instants.',
        id: Date.now() + 1,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-black font-bold text-xl">Chat Assisté Sécurisé</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Recherche documentaire · 5 couches de protection actives</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          En ligne
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        <AnimatePresence>
          {messages.map(msg => <Message key={msg.id} msg={msg} />)}
        </AnimatePresence>
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-6 pb-3 flex gap-2 flex-wrap">
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => send(ex)}
              className="text-xs bg-white hover:bg-zinc-50 text-zinc-600 hover:text-black px-3 py-1.5 rounded-full border border-zinc-200 transition-colors shadow-sm">
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-200 bg-white px-6 py-4">
        <form onSubmit={e => { e.preventDefault(); send() }} className="flex gap-3">
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Posez votre question de cybersécurité..."
            disabled={loading}
            className="flex-1 bg-zinc-50 border-2 border-zinc-200 text-black rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors placeholder-zinc-400 disabled:opacity-50" />
          <button type="submit" disabled={loading || !input.trim()}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition-colors shadow-md shadow-red-200">
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center text-zinc-400 text-xs mt-2">
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          Les requêtes dangereuses sont automatiquement bloquées par les couches de sécurité
        </p>
      </div>
    </div>
  )
}

