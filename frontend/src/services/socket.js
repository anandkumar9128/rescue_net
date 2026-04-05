import { io } from 'socket.io-client'

// Single shared socket instance
const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const socket = io(socketUrl, {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
})

export default socket
