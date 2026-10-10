const { GroupCache } = require('../src/index.js')

function socketComMeta(impl) {
  let chamadas = 0
  return {
    chamadas: () => chamadas,
    socket: { groupMetadata: async (jid) => { chamadas++; return impl(jid) } }
  }
}

describe('GroupCache', () => {
  test('busca do socket na primeira vez (miss) e usa cache na segunda (hit)', async () => {
    const s = socketComMeta((jid) => ({ subject: 'Grupo ' + jid }))
    const gc = new GroupCache()
    const a = await gc.get(s.socket, 'g1')
    const b = await gc.get(s.socket, 'g1')
    expect(a).toEqual(b)
    expect(s.chamadas()).toBe(1) // só uma chamada de rede
    expect(gc.stats().hits).toBe(1)
    expect(gc.stats().misses).toBe(1)
  })

  test('expira após o ttl e busca de novo', async () => {
    const s = socketComMeta(() => ({ subject: 'x' }))
    const gc = new GroupCache({ ttl: 1 })
    await gc.get(s.socket, 'g')
    const ate = Date.now() + 5
    while (Date.now() < ate) {}
    await gc.get(s.socket, 'g')
    expect(s.chamadas()).toBe(2)
  })

  test('invalidar força nova busca', async () => {
    const s = socketComMeta(() => ({ subject: 'x' }))
    const gc = new GroupCache()
    await gc.get(s.socket, 'g')
    gc.invalidar('g')
    await gc.get(s.socket, 'g')
    expect(s.chamadas()).toBe(2)
  })

  test('usa cache antigo como fallback se o socket falhar', async () => {
    let falhar = false
    const socket = { groupMetadata: async () => { if (falhar) throw new Error('rede'); return { subject: 'ok' } } }
    const gc = new GroupCache({ ttl: 1 })
    const primeiro = await gc.get(socket, 'g')
    const ate = Date.now() + 5
    while (Date.now() < ate) {}
    falhar = true
    const segundo = await gc.get(socket, 'g') // expirou, socket falha -> fallback
    expect(segundo).toEqual(primeiro)
  })

  test('respeita maxEntradas (poda o mais antigo)', async () => {
    const socket = { groupMetadata: async (jid) => ({ jid }) }
    const gc = new GroupCache({ maxEntradas: 2 })
    await gc.get(socket, 'a')
    await gc.get(socket, 'b')
    await gc.get(socket, 'c') // deve podar 'a'
    expect(gc.stats().entradas).toBe(2)
  })

  test('podarExpirados remove entradas vencidas', async () => {
    const socket = { groupMetadata: async () => ({}) }
    const gc = new GroupCache({ ttl: 1 })
    await gc.get(socket, 'g')
    const ate = Date.now() + 5
    while (Date.now() < ate) {}
    expect(gc.podarExpirados()).toBe(1)
    expect(gc.stats().entradas).toBe(0)
  })
})
