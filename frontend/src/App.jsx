import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import SecurityTests from './pages/SecurityTests'
import Logs from './pages/Logs'
import './index.css'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-void-950 text-zinc-100 relative">
      <div className="cyber-backdrop" />
      <Sidebar />
      <main className="pl-64 min-h-screen relative z-10">
        {children}
      </main>
    </div>
  )
}

function Protected({ children }) {
  const { isAuth } = useAuth()
  return isAuth ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { isAuth } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={isAuth ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected><Layout><Dashboard /></Layout></Protected>} />
      <Route path="/chat" element={<Protected><Layout><Chat /></Layout></Protected>} />
      <Route path="/tests" element={<Protected><Layout><SecurityTests /></Layout></Protected>} />
      <Route path="/logs" element={<Protected><Layout><Logs /></Layout></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
