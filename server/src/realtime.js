// Comunicação em tempo real (chat, notificações). Cada usuário entra na sala "user:<id>".
import { Server } from 'socket.io'
import { userFromToken } from './lib/auth.js'

let io = null

export function attachRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: true } })
  io.use(async (socket, next) => {
    const user = await userFromToken(socket.handshake.auth?.token || '')
    if (!user) return next(new Error('não autenticado'))
    socket.data.userId = user.id
    next()
  })
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`)
  })
  return io
}

export function emitTo(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload)
}
