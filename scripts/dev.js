// Modo desenvolvimento: API com recarga automática + Vite com recarga da interface.
// Feito em Node puro para funcionar igual no Windows, Linux e macOS.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const procs = [
  spawn(process.execPath, ['--watch', 'server/src/index.js'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [vite, '--config', 'web/vite.config.js'], { cwd: root, stdio: 'inherit' }),
]
console.log('Interface em desenvolvimento: http://localhost:5173 (a API roda na porta 3000)')
const stop = () => {
  for (const p of procs) p.kill()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const p of procs) p.on('exit', (code) => code && stop())
