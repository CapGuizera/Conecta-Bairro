// Comunicação em tempo real (chat, notificações). Dois modos:
//  - "socket": servidor contínuo com socket.io; cada usuário entra na sala "user:<id>".
//  - "poll" (Vercel, sem WebSocket): o evento é gravado em realtime_events e o navegador
//    busca as novidades em /api/events a cada poucos segundos.
import { Server } from 'socket.io'
import { config } from './config.js'
import { q } from './db.js'
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

// `run` permite gravar dentro de uma transação já aberta (o PGlite tem uma conexão só).
export async function emitTo(userId, event, payload, run = q) {
  if (io) io.to(`user:${userId}`).emit(event, payload)
  if (config.realtime === 'poll') {
    await run('INSERT INTO realtime_events (user_id, event, payload) VALUES ($1, $2, $3)', [userId, event, JSON.stringify(payload)])
  }
}
