/**
 * DB - Camada SQLite nativa (node:sqlite, embutido no Node 22+).
 *
 * Modelo chave-valor por "colecao" (cada colecao = uma tabela id TEXT PK + data JSON).
 * Mantem a flexibilidade do JSON com a performance e a durabilidade do SQLite
 * (transacoes ACID, escrita incremental, backup = copiar 1 arquivo).
 *
 * Se o node:sqlite nao existir (Node < 22), `disponivel` fica false e os
 * metodos viram no-op seguros — cabe ao consumidor usar um fallback.
 *
 * Uso:
 *   const { DB } = require('sonne-core')
 *   const db = new DB({ path: './dados/app.db' })
 *   db.init()
 *   db.set('usuarios', '123', { nome: 'Ana' })
 *   db.get('usuarios', '123') // { nome: 'Ana' }
 */
let DatabaseSync = null
let disponivel = false
try {
  ({ DatabaseSync } = require('node:sqlite'))
  disponivel = true
} catch (e) {
  disponivel = false
}

const fs = require('fs')
const path = require('path')
const { log } = require('./logger.js')

class DB {
  /**
   * @param {object} opcoes
   * @param {string} [opcoes.path='./data/sonne.db'] caminho do arquivo do banco
   */
  constructor(opcoes = {}) {
    this.dbPath = opcoes.path || './data/sonne.db'
    this.db = null
    this.ok = false
  }

  get disponivel() { return disponivel }

  /** Inicializa o banco (idempotente). Retorna true se o SQLite esta ativo. */
  init() {
    if (this.ok) return true
    if (!disponivel) {
      log.warn('DB: node:sqlite indisponivel (Node < 22) — use um fallback.')
      return false
    }
    try {
      const dir = path.dirname(this.dbPath)
      if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      this.db = new DatabaseSync(this.dbPath)
      try { this.db.exec('PRAGMA journal_mode = WAL') } catch (e) {}
      try { this.db.exec('PRAGMA synchronous = NORMAL') } catch (e) {}
      this.ok = true
      log.info(`SQLite nativo iniciado (${this.dbPath})`)
      return true
    } catch (err) {
      log.error(`DB init erro: ${err.message}`)
      this.ok = false
      return false
    }
  }

  _garantirTabela(colecao) {
    this.db.exec(`CREATE TABLE IF NOT EXISTS "${colecao}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`)
  }

  /** Upsert de um registro. value e serializado em JSON. */
  set(colecao, id, value) {
    if (!this.ok) return false
    this._garantirTabela(colecao)
    this.db.prepare(`INSERT INTO "${colecao}" (id, data) VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data`).run(String(id), JSON.stringify(value))
    return true
  }

  /** Le um registro pelo id (objeto ou null). */
  get(colecao, id) {
    if (!this.ok) return null
    this._garantirTabela(colecao)
    const row = this.db.prepare(`SELECT data FROM "${colecao}" WHERE id = ?`).get(String(id))
    if (!row) return null
    try { return JSON.parse(row.data) } catch (e) { return null }
  }

  /** Remove um registro. Retorna true se removeu algo. */
  del(colecao, id) {
    if (!this.ok) return false
    this._garantirTabela(colecao)
    const info = this.db.prepare(`DELETE FROM "${colecao}" WHERE id = ?`).run(String(id))
    return (info.changes || 0) > 0
  }

  /** Todos os registros como objeto { id: value }. */
  all(colecao) {
    if (!this.ok) return {}
    this._garantirTabela(colecao)
    const rows = this.db.prepare(`SELECT id, data FROM "${colecao}"`).all()
    const out = {}
    for (const r of rows) { try { out[r.id] = JSON.parse(r.data) } catch (e) {} }
    return out
  }

  /** Lista [ [id, value], ... ]. */
  entries(colecao) { return Object.entries(this.all(colecao)) }

  /** Conta registros. */
  count(colecao) {
    if (!this.ok) return 0
    this._garantirTabela(colecao)
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM "${colecao}"`).get()
    return row?.n || 0
  }

  /** Estatisticas: tamanho em disco, tabelas e contagem de cada. */
  stats() {
    if (!this.ok) return { ativo: false }
    let tamanhoKB = 0
    try {
      for (const suf of ['', '-wal', '-shm']) {
        const fp = this.dbPath + suf
        if (fs.existsSync(fp)) tamanhoKB += fs.statSync(fp).size / 1024
      }
    } catch (e) {}
    const tabelas = {}
    try {
      const rows = this.db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      ).all()
      for (const r of rows) {
        if (r.name === '_meta') continue
        try {
          const c = this.db.prepare(`SELECT COUNT(*) AS n FROM "${r.name}"`).get()
          tabelas[r.name] = c?.n || 0
        } catch (e) {}
      }
    } catch (e) {}
    return { ativo: true, tamanhoKB: Math.round(tamanhoKB), tabelas }
  }

  /**
   * Remove entradas cujo campo `data` (timestamp ms) seja mais antigo que diasMax.
   * @returns {number} quantidade removida
   */
  podarPorIdade(colecao, diasMax = 30) {
    if (!this.ok) return 0
    this._garantirTabela(colecao)
    let removidos = 0
    try {
      const limite = Date.now() - diasMax * 86400000
      const rows = this.db.prepare(`SELECT id, data FROM "${colecao}"`).all()
      const stmt = this.db.prepare(`DELETE FROM "${colecao}" WHERE id = ?`)
      for (const r of rows) {
        try {
          const obj = JSON.parse(r.data)
          if ((obj.data || 0) < limite) { stmt.run(r.id); removidos++ }
        } catch (e) {}
      }
    } catch (err) {
      log.error(`DB podarPorIdade erro: ${err.message}`)
    }
    return removidos
  }

  /** Compacta (VACUUM) e otimiza o banco. */
  compactar() {
    if (!this.ok) return false
    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      this.db.exec('VACUUM')
      this.db.exec('PRAGMA optimize')
      return true
    } catch (err) {
      log.error(`DB compactar erro: ${err.message}`)
      return false
    }
  }

  /** Guarda um valor avulso (meta). */
  setMeta(chave, value) { return this.set('_meta', chave, { v: value }) }

  /** Le um valor avulso (meta). */
  getMeta(chave, padrao = null) {
    const r = this.get('_meta', chave)
    return r ? r.v : padrao
  }

  /** Importa { id: value } para uma colecao SO se ela estiver vazia. @returns {number} */
  importarSeVazio(colecao, objeto) {
    if (!this.ok) return 0
    this._garantirTabela(colecao)
    if (this.count(colecao) > 0) return 0
    let n = 0
    const tx = this.db.prepare(`INSERT OR IGNORE INTO "${colecao}" (id, data) VALUES (?, ?)`)
    for (const [id, value] of Object.entries(objeto || {})) {
      try { tx.run(String(id), JSON.stringify(value)); n++ } catch (e) {}
    }
    return n
  }

  /** Fecha a conexao do banco. */
  close() {
    if (this.db) { try { this.db.close() } catch (e) {} this.db = null; this.ok = false }
  }
}

module.exports = DB
