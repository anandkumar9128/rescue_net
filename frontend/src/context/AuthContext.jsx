import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import socket from '../services/socket'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser]     = useState(() => JSON.parse(localStorage.getItem('rn_user') || 'null'))
  const [loading, setLoading] = useState(false)

  // Connect socket and join appropriate room when user logs in
  useEffect(() => {
    if (user) {
      socket.connect()

      if (user.role === 'ngo_admin' && user.ngo_id) {
        socket.emit('join_ngo_room', user.ngo_id)
      }
      if (user.role === 'volunteer') {
        socket.emit('join_volunteer_room', user.id)
      }
    } else {
      socket.disconnect()
    }
    return () => {}
  }, [user])

  const login = async (phone, password) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { phone, password })
      localStorage.setItem('rn_token', data.token)
      localStorage.setItem('rn_user', JSON.stringify(data.user))
      setUser(data.user)
      return { success: true, user: data.user }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Login failed' }
    } finally {
      setLoading(false)
    }
  }

  const register = async (payload) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', payload)
      localStorage.setItem('rn_token', data.token)
      localStorage.setItem('rn_user', JSON.stringify(data.user))
      setUser(data.user)
      return { success: true, user: data.user }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Registration failed' }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('rn_token')
    localStorage.removeItem('rn_user')
    setUser(null)
    socket.disconnect()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
