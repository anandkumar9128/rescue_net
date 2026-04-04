import { io } from 'socket.io-client'

// Single shared socket instance
const socket = io('http://localhost:5000', {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
})

export default socket
