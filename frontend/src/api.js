import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Injecter le token JWT automatiquement sur chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Un JWT expire après 30 minutes. Au lieu de conserver un jeton invalide
// et d'afficher une erreur trompeuse dans le chat, on force une reconnexion.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export const login = (username, password) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  return api.post('/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

export const healthCheck = () => api.get('/health')
export const sendQuery   = (question) => api.post('/query', { question })

export const getLogs = (statusFilter) =>
  api.get('/logs', { params: statusFilter ? { status_filter: statusFilter } : {} })

export const getDashboardStats = () => api.get('/dashboard/stats')

export const checkDocument = (content) => api.post('/tests/check-document', { content })

export default api
