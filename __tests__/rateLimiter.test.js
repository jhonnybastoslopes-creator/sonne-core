const { RateLimiter } = require('../src/index.js')

describe('RateLimiter', () => {
  test('permite ate o limite e bloqueia depois', () => {
    const rl = new RateLimiter({ maxComandos: 3, janelaMs: 10000, cooldownMs: 5000 })
    expect(rl.verificar('u1').permitido).toBe(true)
    expect(rl.verificar('u1').permitido).toBe(true)
    expect(rl.verificar('u1').permitido).toBe(true)
    const quarto = rl.verificar('u1')
    expect(quarto.permitido).toBe(false)
    expect(quarto.avisar).toBe(true)
  })

  test('dono nunca é limitado', () => {
    const rl = new RateLimiter({ maxComandos: 1 })
    rl.verificar('dono', true)
    rl.verificar('dono', true)
    expect(rl.verificar('dono', true).permitido).toBe(true)
  })

  test('usuários diferentes têm contadores independentes', () => {
    const rl = new RateLimiter({ maxComandos: 1 })
    expect(rl.verificar('a').permitido).toBe(true)
    expect(rl.verificar('b').permitido).toBe(true)
    expect(rl.verificar('a').permitido).toBe(false)
  })

  test('avisa só uma vez durante o cooldown', () => {
    const rl = new RateLimiter({ maxComandos: 1, cooldownMs: 60000 })
    rl.verificar('u')          // ok
    const bloqueio1 = rl.verificar('u') // excedeu -> avisar true
    const bloqueio2 = rl.verificar('u') // ainda em cooldown -> avisar false
    expect(bloqueio1.avisar).toBe(true)
    expect(bloqueio2.avisar).toBe(false)
  })

  test('stats e limpar', () => {
    const rl = new RateLimiter()
    rl.verificar('x')
    expect(rl.stats().usuariosRastreados).toBe(1)
    rl.limpar()
    expect(rl.stats().usuariosRastreados).toBe(0)
  })
})
