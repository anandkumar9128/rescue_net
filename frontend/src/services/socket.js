import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://rescue-net-backend.onrender.com';
// Single shared socket instance
const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
})

export default socket
