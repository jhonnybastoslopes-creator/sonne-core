const { Scheduler } = require('../src/index.js')

describe('Scheduler', () => {
  test('add valida formato e callback', () => {
    const s = new Scheduler()
    expect(s.add('18:00', () => {})).toBe(true)
    expect(s.add('xx:yy', () => {})).toBe(false)   // formato inválido
    expect(s.add('18:00', 'nao-funcao')).toBe(false) // sem callback válido
  })

  test('dispara o job no horário certo', async () => {
    const s = new Scheduler()
    let chamou = 0
    s.add('09:30', () => { chamou++ })
    // simula o tick às 09:30
    const d = new Date(); d.setHours(9, 30, 0, 0)
    await s.tick(d)
    expect(chamou).toBe(1)
  })

  test('não dispara duas vezes no mesmo minuto', async () => {
    const s = new Scheduler()
    let chamou = 0
    s.add('10:00', () => { chamou++ })
    const d = new Date(); d.setHours(10, 0, 0, 0)
    await s.tick(d)
    await s.tick(d)
    expect(chamou).toBe(1)
  })

  test('não dispara em horário sem job', async () => {
    const s = new Scheduler()
    let chamou = 0
    s.add('12:00', () => { chamou++ })
    const d = new Date(); d.setHours(13, 0, 0, 0)
    await s.tick(d)
    expect(chamou).toBe(0)
  })

  test('onTick roda todo minuto com a hora atual', async () => {
    const s = new Scheduler()
    const horas = []
    s.onTick((h) => horas.push(h))
    const d = new Date(); d.setHours(7, 5, 0, 0)
    await s.tick(d)
    expect(horas).toEqual(['07:05'])
  })

  test('remove um job', async () => {
    const s = new Scheduler()
    const fn = () => {}
    s.add('15:00', fn)
    expect(s.listar()).toContain('15:00')
    s.remove('15:00', fn)
    expect(s.listar()).not.toContain('15:00')
  })

  test('erro num job não quebra o tick', async () => {
    const s = new Scheduler()
    let ok = false
    s.add('08:00', () => { throw new Error('falha') })
    s.add('08:00', () => { ok = true })
    const d = new Date(); d.setHours(8, 0, 0, 0)
    await expect(s.tick(d)).resolves.toBeUndefined()
    expect(ok).toBe(true)
  })
})
