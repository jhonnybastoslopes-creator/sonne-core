const { Storage } = require('../src/index.js')
const fs = require('fs')
const os = require('os')
const path = require('path')

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sonne-core-storage-'))
}

describe('Storage', () => {
  test('writeJSON + readJSON round-trip', () => {
    const dir = tmpDir()
    const fp = path.join(dir, 'd.json')
    const store = new Storage()
    store.writeJSON(fp, { a: 1, b: 'x' })
    expect(store.readJSON(fp)).toEqual({ a: 1, b: 'x' })
  })

  test('readJSON retorna fallback se arquivo não existe', () => {
    const store = new Storage()
    expect(store.readJSON('/caminho/inexistente.json', { padrao: true })).toEqual({ padrao: true })
  })

  test('readJSON recupera do .bak se o principal estiver corrompido', () => {
    const dir = tmpDir()
    const fp = path.join(dir, 'd.json')
    fs.writeFileSync(fp + '.bak', JSON.stringify({ recuperado: true }))
    fs.writeFileSync(fp, 'LIXO %%% NAO JSON')
    const store = new Storage()
    expect(store.readJSON(fp)).toEqual({ recuperado: true })
  })

  test('updateJSON aplica o mutator', () => {
    const dir = tmpDir()
    const fp = path.join(dir, 'd.json')
    const store = new Storage()
    store.writeJSON(fp, { n: 1 })
    store.updateJSON(fp, (d) => { d.n++; return d })
    expect(store.readJSON(fp).n).toBe(2)
  })

  test('updateJSONSafe serializa escritas concorrentes (sem lost update)', async () => {
    const dir = tmpDir()
    const fp = path.join(dir, 'c.json')
    const store = new Storage()
    store.writeJSON(fp, { n: 0 })
    const incrementos = Array.from({ length: 50 }, () =>
      store.updateJSONSafe(fp, (d) => { d.n = (d.n || 0) + 1; return d })
    )
    await Promise.all(incrementos)
    expect(store.readJSON(fp).n).toBe(50)
  })

  test('ensureJSON cria com inicial se não existe', () => {
    const dir = tmpDir()
    const fp = path.join(dir, 'novo.json')
    const store = new Storage()
    const r = store.ensureJSON(fp, { init: 1 })
    expect(r).toEqual({ init: 1 })
    expect(fs.existsSync(fp)).toBe(true)
  })

  test('escrita é atômica (gera .bak do estado anterior)', () => {
    const dir = tmpDir()
    const fp = path.join(dir, 'd.json')
    const store = new Storage()
    store.writeJSON(fp, { v: 1 })
    store.writeJSON(fp, { v: 2 })
    expect(fs.existsSync(fp + '.bak')).toBe(true)
  })
})
