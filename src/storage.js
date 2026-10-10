/**
 * Storage - Persistencia segura de JSON em disco.
 *  - Escrita atomica (temp + rename) para evitar corrupcao
 *  - Backup .bak automatico do estado anterior
 *  - Cache em memoria invalidado por mtime (reduz I/O)
 *  - Lock por arquivo (evita "lost update" com acessos concorrentes)
 *
 * Uso:
 *   const { Storage } = require('sonne-core')
 *   const store = new Storage()
 *   const dados = store.readJSON('./dados.json', {})
 *   store.writeJSON('./dados.json', { ...dados, novo: true })
 */
const fs = require('fs')
const path = require('path')
const { log } = require('./logger.js')

class Storage {
  constructor() {
    this._cache = new Map()
    this._locks = new Map()
  }

  /** Executa fn com lock exclusivo sobre filePath (serializa escritas). */
  async withLock(filePath, fn) {
    const anterior = this._locks.get(filePath) || Promise.resolve()
    let liberar
    const atual = new Promise(res => { liberar = res })
    const encadeado = anterior.then(() => atual)
    this._locks.set(filePath, encadeado)

    try { await anterior } catch (e) {}
    try {
      return await fn()
    } finally {
      liberar()
      if (this._locks.get(filePath) === encadeado) this._locks.delete(filePath)
    }
  }

  /** Read-modify-write atomico e seguro contra concorrencia (mutator pode ser async). */
  async updateJSONSafe(filePath, mutator, fallback = {}) {
    return this.withLock(filePath, async () => {
      this._cache.delete(filePath)
      const data = this.readJSON(filePath, fallback)
      const novo = (await mutator(data)) || data
      this.writeJSON(filePath, novo)
      return novo
    })
  }

  /** Le um JSON com fallback seguro (tenta .bak se corrompido). */
  readJSON(filePath, fallback = {}) {
    try {
      if (!fs.existsSync(filePath)) {
        return typeof fallback === 'object' ? JSON.parse(JSON.stringify(fallback)) : fallback
      }
      const stat = fs.statSync(filePath)
      const cached = this._cache.get(filePath)
      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return typeof cached.data === 'object' ? JSON.parse(JSON.stringify(cached.data)) : cached.data
      }
      const raw = fs.readFileSync(filePath, 'utf-8')
      if (!raw || !raw.trim()) {
        return typeof fallback === 'object' ? JSON.parse(JSON.stringify(fallback)) : fallback
      }
      const data = JSON.parse(raw)
      this._cache.set(filePath, { mtimeMs: stat.mtimeMs, data })
      return typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data
    } catch (err) {
      log.error(`Storage readJSON erro (${filePath}): ${err.message}`)
      const backup = `${filePath}.bak`
      if (fs.existsSync(backup)) {
        try { return JSON.parse(fs.readFileSync(backup, 'utf-8')) } catch (e) {}
      }
      return typeof fallback === 'object' ? JSON.parse(JSON.stringify(fallback)) : fallback
    }
  }

  /** Escreve JSON de forma atomica, com backup .bak. */
  writeJSON(filePath, data) {
    try {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      if (fs.existsSync(filePath)) {
        try { fs.copyFileSync(filePath, `${filePath}.bak`) } catch (e) {}
      }
      const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
      fs.renameSync(tmp, filePath)
      try {
        const stat = fs.statSync(filePath)
        this._cache.set(filePath, { mtimeMs: stat.mtimeMs, data })
      } catch (e) {}
      return true
    } catch (err) {
      log.error(`Storage writeJSON erro (${filePath}): ${err.message}`)
      return false
    }
  }

  /** Read-modify-write sincrono (use updateJSONSafe se houver concorrencia). */
  updateJSON(filePath, mutator, fallback = {}) {
    const data = this.readJSON(filePath, fallback)
    const novo = mutator(data) || data
    this.writeJSON(filePath, novo)
    return novo
  }

  /** Garante que o arquivo existe com conteudo inicial. */
  ensureJSON(filePath, inicial = {}) {
    if (!fs.existsSync(filePath)) this.writeJSON(filePath, inicial)
    return this.readJSON(filePath, inicial)
  }

  clearCache() { this._cache.clear() }
}

module.exports = Storage
