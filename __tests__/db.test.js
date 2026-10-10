const { DB } = require('../src/index.js')
const fs = require('fs')
const os = require('os')
const path = require('path')

function novoDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sonne-core-db-'))
  const db = new DB({ path: path.join(dir, 'app.db') })
  const ativo = db.init()
  return { db, ativo }
}

// O node:sqlite só existe no Node 22+. Pulamos os testes de persistência
// quando indisponível, mas garantimos que a API é segura (no-op) nesse caso.
const temSqlite = (() => { try { require('node:sqlite'); return true } catch (e) { return false } })()

describe('DB - disponibilidade', () => {
  test('expõe a flag disponivel', () => {
    const db = new DB({ path: ':memory:' })
    expect(typeof db.disponivel).toBe('boolean')
  })

  test('métodos são seguros quando não inicializado', () => {
    const db = new DB({ path: path.join(os.tmpdir(), 'nao-init.db') })
    // sem init(): tudo vira no-op seguro
    expect(db.set('c', '1', { a: 1 })).toBe(false)
    expect(db.get('c', '1')).toBeNull()
    expect(db.all('c')).toEqual({})
    expect(db.count('c')).toBe(0)
  })
})

const d = temSqlite ? describe : describe.skip

d('DB - persistência (requer Node 22+ node:sqlite)', () => {
  test('set/get/del round-trip', () => {
    const { db, ativo } = novoDb()
    expect(ativo).toBe(true)
    db.set('usuarios', '1', { nome: 'Ana' })
    expect(db.get('usuarios', '1')).toEqual({ nome: 'Ana' })
    expect(db.del('usuarios', '1')).toBe(true)
    expect(db.get('usuarios', '1')).toBeNull()
    db.close()
  })

  test('all/entries/count', () => {
    const { db } = novoDb()
    db.set('c', 'a', { v: 1 })
    db.set('c', 'b', { v: 2 })
    expect(db.count('c')).toBe(2)
    expect(db.all('c')).toEqual({ a: { v: 1 }, b: { v: 2 } })
    expect(db.entries('c')).toHaveLength(2)
    db.close()
  })

  test('meta set/get', () => {
    const { db } = novoDb()
    db.setMeta('ativo', true)
    expect(db.getMeta('ativo')).toBe(true)
    expect(db.getMeta('inexistente', 'padrao')).toBe('padrao')
    db.close()
  })

  test('importarSeVazio só importa quando vazio', () => {
    const { db } = novoDb()
    expect(db.importarSeVazio('c', { x: { v: 1 }, y: { v: 2 } })).toBe(2)
    expect(db.importarSeVazio('c', { z: { v: 3 } })).toBe(0) // já tem dados
    expect(db.count('c')).toBe(2)
    db.close()
  })

  test('podarPorIdade remove entradas antigas', () => {
    const { db } = novoDb()
    const antigo = Date.now() - 40 * 86400000
    const recente = Date.now()
    db.set('postados', 'velho', { data: antigo })
    db.set('postados', 'novo', { data: recente })
    const removidos = db.podarPorIdade('postados', 30)
    expect(removidos).toBe(1)
    expect(db.get('postados', 'velho')).toBeNull()
    expect(db.get('postados', 'novo')).not.toBeNull()
    db.close()
  })

  test('stats reporta tabelas', () => {
    const { db } = novoDb()
    db.set('c', 'a', { v: 1 })
    const s = db.stats()
    expect(s.ativo).toBe(true)
    expect(s.tabelas.c).toBe(1)
    db.close()
  })
})
