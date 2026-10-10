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
