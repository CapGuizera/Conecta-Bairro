// Camada de banco. Dois modos com o mesmo SQL:
//  - DATABASE_URL definida: PostgreSQL + PostGIS real (ex.: docker compose)
//  - sem DATABASE_URL: PGlite (PostgreSQL em WebAssembly) com PostGIS embutido,
//    gravado em server/data/pglite. Não exige instalar nada além do Node.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'

const schemaSql = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8')

let impl = null
let releaseLock = null

// O PGlite não aguenta dois processos no mesmo banco: o segundo atrapalha as gravações do primeiro
// (aconteceu ao abrir o sistema duas vezes). A trava guarda o PID de quem está com o banco aberto.
function processAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return err.code === 'EPERM'
  }
}

function acquireLock(dir) {
  const file = path.join(path.dirname(dir), 'pglite.lock')
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, String(process.pid), { flag: 'wx' })
      break
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
      const owner = Number(fs.readFileSync(file, 'utf8'))
      if (owner && owner !== process.pid && processAlive(owner)) {
        throw Object.assign(new Error(`O banco já está aberto por outro processo (PID ${owner})`), { code: 'DB_LOCKED', owner })
      }
      fs.rmSync(file, { force: true }) // trava esquecida por um processo que já terminou
    }
  }
  const release = () => {
    try {
      if (Number(fs.readFileSync(file, 'utf8')) === process.pid) fs.rmSync(file, { force: true })
    } catch {
      /* já removida */
    }
  }
  process.on('exit', release)
  return release
}

export async function initDb({ memory = false } = {}) {
  if (impl) return impl
  if (config.databaseUrl && !memory) {
    const { default: pg } = await import('pg')
    pg.types.setTypeParser(20, Number) // bigint -> number
    pg.types.setTypeParser(1700, Number) // numeric -> number
    const pool = new pg.Pool({ connectionString: config.databaseUrl })
    impl = {
      kind: 'postgres',
      query: (sql, params) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      async transaction(fn) {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const result = await fn({ query: (s, p) => client.query(s, p) })
          await client.query('COMMIT')
          return result
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          client.release()
        }
      },
      close: () => pool.end(),
    }
  } else {
    const { PGlite } = await import('@electric-sql/pglite')
    const { postgis } = await import('@electric-sql/pglite-postgis')
    if (!memory) {
      fs.mkdirSync(config.pgliteDir, { recursive: true })
      releaseLock = acquireLock(config.pgliteDir)
    }
    const db = await PGlite.create(memory ? undefined : config.pgliteDir, { extensions: { postgis } })
    impl = {
      kind: memory ? 'pglite-memory' : 'pglite',
      query: (sql, params) => db.query(sql, params),
      exec: (sql) => db.exec(sql),
      transaction: (fn) => db.transaction((tx) => fn({ query: (s, p) => tx.query(s, p) })),
      close: () => db.close(),
    }
  }
  await impl.exec(schemaSql)
  return impl
}

export function db() {
  if (!impl) throw new Error('Banco não inicializado')
  return impl
}

export async function closeDb() {
  if (impl) await impl.close()
  impl = null
  releaseLock?.()
  releaseLock = null
}

export const q = (sql, params = []) => db().query(sql, params)
export const one = async (sql, params = []) => (await q(sql, params)).rows[0] || null
export const many = async (sql, params = []) => (await q(sql, params)).rows
