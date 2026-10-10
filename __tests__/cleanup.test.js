const { Cleanup } = require('../src/index.js')
const fs = require('fs')
const os = require('os')
const path = require('path')

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sonne-core-cleanup-'))
}

function criarArquivo(dir, nome, idadeMs = 0) {
  const fp = path.join(dir, nome)
  fs.writeFileSync(fp, 'x'.repeat(100))
  if (idadeMs > 0) {
    const t = new Date(Date.now() - idadeMs)
    fs.utimesSync(fp, t, t)
  }
  return fp
}

describe('Cleanup', () => {
  test('remove arquivos mais antigos que maxAgeMs', () => {
    const dir = tmpDir()
    criarArquivo(dir, 'velho.tmp', 3 * 60 * 60 * 1000) // 3h
    criarArquivo(dir, 'novo.tmp', 0)
    const c = new Cleanup({ tempDir: dir, maxAgeMs: 2 * 60 * 60 * 1000 })
    const r = c.executar()
    expect(r.removidos).toBe(1)
    expect(fs.existsSync(path.join(dir, 'velho.tmp'))).toBe(false)
    expect(fs.existsSync(path.join(dir, 'novo.tmp'))).toBe(true)
  })

  test('respeita a lista de ignorar', () => {
    const dir = tmpDir()
    criarArquivo(dir, '#nadapraver', 10 * 60 * 60 * 1000)
    const c = new Cleanup({ tempDir: dir, maxAgeMs: 1, ignorar: ['#nadapraver'] })
    const r = c.executar()
    expect(r.removidos).toBe(0)
    expect(fs.existsSync(path.join(dir, '#nadapraver'))).toBe(true)
  })

  test('reduz ao maxArquivos removendo os mais antigos', () => {
    const dir = tmpDir()
    criarArquivo(dir, 'a.tmp', 5000)
    criarArquivo(dir, 'b.tmp', 4000)
    criarArquivo(dir, 'c.tmp', 3000)
    const c = new Cleanup({ tempDir: dir, maxAgeMs: 999999999, maxArquivos: 1 })
    const r = c.executar()
    expect(r.removidos).toBe(2) // mantém só o mais novo
    expect(fs.readdirSync(dir)).toHaveLength(1)
  })

  test('cria o tempDir se não existir', () => {
    const dir = path.join(tmpDir(), 'sub', 'temp')
    const c = new Cleanup({ tempDir: dir })
    c.executar()
    expect(fs.existsSync(dir)).toBe(true)
  })

  test('start/stop não lançam e start agenda timer', () => {
    const dir = tmpDir()
    const c = new Cleanup({ tempDir: dir, intervaloMs: 999999 })
    expect(() => { c.start(); c.stop() }).not.toThrow()
  })
})
