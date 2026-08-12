import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, MessageSquare, ShieldCheck, ScrollText, LogOut, Shield, ChevronRight, CheckCircle2
} from 'lucide-react'

const links = [
  { to: '/',       icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/chat',   icon: MessageSquare,   label: 'Chat RAG'       },
  { to: '/tests',  icon: ShieldCheck,     label: 'Security Tests' },
  { to: '/logs',   icon: ScrollText,      label: 'Logs'           },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside className="fixed inset-y-0 left-0 w-64 glass-panel border-r border-white/[0.06] flex flex-col z-40 select-none">
      {/* Header / Brand */}
      <div className="px-6 py-6 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white glow-border-red">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base tracking-tight leading-none">SecureRAG</h1>
            <p className="text-zinc-400 text-xs mt-1 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse glow-dot" /> RAG Sécurisé
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-3 py-6 flex-1 space-y-6 overflow-y-auto">
        <div>
          <p className="px-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Plateforme
          </p>
          <nav className="space-y-1">
            {links.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-base font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-gradient-to-r from-red-600 to-red-600/80 text-white glow-border-red'
                      : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100'
                  }`
                }>
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  <span>{label}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Protection Status Widget */}
        <div className="mx-1 p-3.5 rounded-2xl glass-panel">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 5 Couches Actives
          </div>
          <p className="text-sm text-zinc-400 leading-snug">
            OWASP LLM01, LLM02, LLM04, LLM05, LLM07, LLM08.
          </p>
        </div>
      </div>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 p-2 rounded-xl glass-panel mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 text-white font-bold flex items-center justify-center text-xs uppercase border border-white/10">
            {user?.[0] ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user || 'Administrateur'}</p>
            <p className="text-zinc-500 text-xs truncate">Session authentifiée (JWT)</p>
          </div>
        </div>

        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-zinc-400 hover:bg-red-500/10 hover:text-red-400 text-sm font-semibold transition-colors border border-transparent hover:border-red-500/30">
          <LogOut className="w-3.5 h-3.5" /> Se déconnecter
        </button>
      </div>
    </aside>
  )
}
