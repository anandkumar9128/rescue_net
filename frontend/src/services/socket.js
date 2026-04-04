import { io } from 'socket.io-client'

// Strip /api if user accidentally provided it for the root socket connection
const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const SOCKET_URL = rawUrl.endsWith('/api') ? rawUrl.replace(/\/api$/, '') : rawUrl;

// Single shared socket instance
const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
})

export default socket
