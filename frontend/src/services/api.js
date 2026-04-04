import axios from 'axios'

const api = axios.create({
  // Use Render URL directly, or fallback to an environment variable if defined
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://rescue-net-backend.onrender.com/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rn_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally — clear session and redirect
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rn_token')
      localStorage.removeItem('rn_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
