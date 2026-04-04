import axios from 'axios'

const api = axios.create({
  // If VITE_API_URL is provided, use it exactly as is. Otherwise fallback to the Render link.
  baseURL: import.meta.env.VITE_API_URL || 'https://rescue-net-backend.onrender.com',
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
