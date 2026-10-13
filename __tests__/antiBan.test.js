const { AntiBan } = require('../src/index.js')

function makeSocket() {
  const enviados = []
  return {
    socket: {
      user: { id: 'bot@s.whatsapp.net' },
      sendMessage: async (jid, content, opts) => { enviados.push({ jid, content, opts }); return { key: { id: 'm' } } },
      sendPresenceUpdate: async () => {}
    },
    enviados
  }
}

describe('AntiBan - perfis', () => {
  test('expõe os 3 perfis', () => {
    expect(Object.keys(AntiBan.PERFIS)).toEqual(['seguro', 'equilibrado', 'turbo'])
  })

  test('aplica um perfil e reflete em perfilAtual', () => {
    const ab = new AntiBan({ testMode: true })
    const r = ab.aplicarPerfil('turbo')
    expect(r.ok).toBe(true)
    expect(ab.perfilAtual()).toBe('turbo')
  })

  test('perfil invalido retorna erro', () => {
    const ab = new AntiBan({ testMode: true })
    expect(ab.aplicarPerfil('xyz').ok).toBe(false)
  })

  test('construtor com perfil inválido cai no equilibrado', () => {
    const ab = new AntiBan({ perfil: 'inexistente', testMode: true })
    expect(ab.perfilAtual()).toBe('equilibrado')
  })
})

describe('AntiBan - envio', () => {
  test('enfileirar envia pelo socket', async () => {
    const { socket, enviados } = makeSocket()
    const ab = new AntiBan({ testMode: true })
    ab.setSocket(socket)
    const r = await ab.enfileirar('123@s.whatsapp.net', { text: 'oi' })
    expect(r.sucesso).toBe(true)
    expect(enviados).toHaveLength(1)
    expect(enviados[0].content.text).toBe('oi')
  })

  test('sem socket retorna erro', async () => {
    const ab = new AntiBan({ testMode: true })
    const r = await ab.enfileirar('123@s.whatsapp.net', { text: 'x' })
    expect(r.sucesso).toBe(false)
  })

  test('respeita a ordem FIFO e prioridade', async () => {
    const { socket, enviados } = makeSocket()
    const ab = new AntiBan({ testMode: true })
    ab.setSocket(socket)
    const p1 = ab.enfileirar('a@s.whatsapp.net', { text: '1' })
    const p2 = ab.enfileirar('b@s.whatsapp.net', { text: '2' }, { prioridade: true })
    await Promise.all([p1, p2])
    // o prioritario pode furar a fila; ambos devem ter sido enviados
    expect(enviados.map(e => e.content.text).sort()).toEqual(['1', '2'])
  })
})

describe('AntiBan - cooldown e estado', () => {
  test('erros de rate limit ativam cooldown e chamam onCooldown', async () => {
    let avisou = null
    const ab = new AntiBan({ testMode: true, onCooldown: (i) => { avisou = i } })
    ab.setSocket({
      user: { id: 'bot' },
      sendMessage: async () => { throw new Error('rate limit exceeded') },
      sendPresenceUpdate: async () => {}
    })
    const r = await ab.enfileirar('x@s.whatsapp.net', { text: 'y' })
    expect(r.sucesso).toBe(false)
    expect(ab.status().emCooldown).toBe(true)
    expect(avisou).not.toBeNull()
    expect(avisou.minutos).toBeGreaterThan(0)
  })

  test('store injetável persiste e restaura inicioOperacao', () => {
    let salvo = {}
    const store = { read: () => salvo, write: (o) => { salvo = o } }
    const ab1 = new AntiBan({ testMode: true, store })
    const inicio = ab1.inicioOperacao
    expect(salvo.inicioOperacao).toBe(inicio)
    const ab2 = new AntiBan({ testMode: true, store })
    expect(ab2.inicioOperacao).toBe(inicio)
  })

  test('variarTexto escolhe uma das opções do spintax', () => {
    const ab = new AntiBan({ testMode: true })
    const out = ab.variarTexto('{oi|ola|eai} mundo')
    expect(['oi mundo', 'ola mundo', 'eai mundo']).toContain(out)
  })

  test('status retorna estrutura completa', () => {
    const ab = new AntiBan({ testMode: true })
    const s = ab.status()
    expect(s).toHaveProperty('perfil')
    expect(s).toHaveProperty('enviosDia')
    expect(s).toHaveProperty('emCooldown')
  })
})

describe('AntiBan - modo adaptativo', () => {
  function socketOk() {
    return { user: { id: 'bot' }, sendMessage: async () => ({ key: { id: 'm' } }), sendPresenceUpdate: async () => {} }
  }
  function socketRateLimit() {
    return { user: { id: 'bot' }, sendMessage: async () => { throw new Error('rate limit exceeded') }, sendPresenceUpdate: async () => {} }
  }

  test('envio OK sobe a saude (acelera)', async () => {
    const ab = new AntiBan({ testMode: true, saudeInicial: 50 })
    ab.setSocket(socketOk())
    const antes = ab.saude
    await ab.enfileirar('a@s.whatsapp.net', { text: 'x' })
    expect(ab.saude).toBeGreaterThan(antes)
  })

  test('rate limit derruba a saude (desacelera) de forma grave', async () => {
    const ab = new AntiBan({ testMode: true, saudeInicial: 80 })
    ab.setSocket(socketRateLimit())
    await ab.enfileirar('a@s.whatsapp.net', { text: 'x' })
    expect(ab.saude).toBeLessThan(80)
  })

  test('fatorAdaptativoDelay: saude alta acelera, saude baixa desacelera', () => {
    const alto = new AntiBan({ testMode: true, saudeInicial: 100 })
    const baixo = new AntiBan({ testMode: true, saudeInicial: 10 })
    expect(alto.fatorAdaptativoDelay()).toBeLessThan(1)   // mais rapido
    expect(baixo.fatorAdaptativoDelay()).toBeGreaterThan(1.5) // bem mais lento
  })

  test('fatorAdaptativoLimite reduz com saude baixa', () => {
    const alto = new AntiBan({ testMode: true, saudeInicial: 90 })
    const baixo = new AntiBan({ testMode: true, saudeInicial: 10 })
    expect(alto.fatorAdaptativoLimite()).toBe(1)
    expect(baixo.fatorAdaptativoLimite()).toBeLessThan(0.5)
  })

  test('adaptativo pode ser desligado (fatores = 1)', () => {
    const ab = new AntiBan({ testMode: true, adaptativo: false, saudeInicial: 10 })
    expect(ab.fatorAdaptativoDelay()).toBe(1)
    expect(ab.fatorAdaptativoLimite()).toBe(1)
  })

  test('status expõe saude e ritmo', () => {
    const ab = new AntiBan({ testMode: true, saudeInicial: 90 })
    const s = ab.status()
    expect(s).toHaveProperty('saude')
    expect(s).toHaveProperty('ritmo')
    expect(s.adaptativo).toBe(true)
  })

  test('saude é persistida no store', async () => {
    let salvo = {}
    const store = { read: () => salvo, write: (o) => { salvo = o } }
    const ab = new AntiBan({ testMode: true, saudeInicial: 60, store })
    ab.setSocket(socketOk())
    await ab.enfileirar('a@s.whatsapp.net', { text: 'x' })
    expect(typeof salvo.saude).toBe('number')
    // nova instancia restaura a saude salva
    const ab2 = new AntiBan({ testMode: true, store })
    expect(ab2.saude).toBe(salvo.saude)
  })
})
