import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Injecter le token JWT automatiquement sur chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

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

export default api
