// Ponto de entrada: inicia banco, API, interface web e tempo real na mesma porta.
import http from 'node:http'
import os from 'node:os'
import { createApp } from './app.js'
import { config } from './config.js'
import { initDb, many } from './db.js'
import { scheduleJobs } from './jobs.js'
import { attachRealtime } from './realtime.js'
import { seedIfEmpty } from './seed.js'

const started = Date.now()
console.log('Iniciando o ConectaBairro...')
let db
try {
  db = await initDb()
} catch (err) {
  if (err.code !== 'DB_LOCKED') throw err
  console.error(`\nO ConectaBairro já está aberto em outra janela (processo ${err.owner}).`)
  console.error('Use a janela que já está aberta ou feche-a antes de abrir de novo.')
  process.exit(1)
}
console.log(`Banco: ${db.kind === 'postgres' ? 'PostgreSQL + PostGIS (DATABASE_URL)' : `PGlite embutido em ${config.pgliteDir}`}`)
await seedIfEmpty()

const app = createApp()
const server = http.createServer(app)
attachRealtime(server)
scheduleJobs()

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nA porta ${config.port} já está em uso. Feche o outro programa ou defina outra porta no arquivo .env (PORT=3001).`)
    process.exit(1)
  }
  throw err
})

server.listen(config.port, config.host, async () => {
  // Endereços para abrir em outros aparelhos da mesma rede (ignora interfaces virtuais: Docker, WSL, VirtualBox).
  const virtual = /docker|^br-|veth|virbr|vethernet|virtualbox|vmware|wsl|tailscale|zerotier|^zt|^tun|^tap/i
  const lan = Object.entries(os.networkInterfaces())
    .filter(([name]) => !virtual.test(name))
    .flatMap(([, list]) => list || [])
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${config.port}`)
  const demo = await many("SELECT name, phone, role FROM users WHERE phone LIKE '+551590000%' ORDER BY phone")
  console.log(`\nConectaBairro pronto em ${((Date.now() - started) / 1000).toFixed(1)} s`)
  console.log(`  Neste computador:   http://localhost:${config.port}`)
  for (const url of lan) console.log(`  Na rede local:      ${url}`)
  if (config.smsMode === 'dev') {
    console.log('\nModo demonstração: o código de verificação aparece na própria tela de login.')
    if (demo.length) {
      console.log('Contas de demonstração (entre com o celular):')
      for (const u of demo) console.log(`  ${u.phone.replace('+55', '').replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')}  ${u.name} [${u.role}]`)
    }
  }
  console.log('\nPara encerrar, pressione Ctrl+C.')
})

const shutdown = async () => {
  server.close()
  const { closeDb } = await import('./db.js')
  await closeDb().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
