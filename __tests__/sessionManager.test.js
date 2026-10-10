const { SessionManager } = require('../src/index.js')

describe('SessionManager', () => {
  test('inicia, obtem e encerra sessao', () => {
    const sm = new SessionManager()
    sm.iniciar('u1', 'definir_nome', { extra: 1 })
    const s = sm.obter('u1')
    expect(s.acao).toBe('definir_nome')
    expect(s.dados.extra).toBe(1)
    sm.encerrar('u1')
    expect(sm.obter('u1')).toBeNull()
  })

  test('temSessao reflete o estado', () => {
    const sm = new SessionManager()
    expect(sm.temSessao('x')).toBe(false)
    sm.iniciar('x', 'acao')
    expect(sm.temSessao('x')).toBe(true)
  })

  test('sessao expira após o ttl', () => {
    const sm = new SessionManager({ ttl: 1 }) // 1ms
    sm.iniciar('u', 'acao')
    const esperar = Date.now() + 5
    while (Date.now() < esperar) { /* busy wait curto */ }
    expect(sm.obter('u')).toBeNull()
  })

  test('processar roda o handler e consome a mensagem', async () => {
    const sm = new SessionManager()
    let recebido = null
    sm.registrarHandler('eco', async ({ valor, reply }) => { recebido = valor; reply('ok') })
    sm.iniciar('u', 'eco')
    const respostas = []
    const consumiu = await sm.processar('u', 'teste', { reply: (t) => respostas.push(t) })
    expect(consumiu).toBe(true)
    expect(recebido).toBe('teste')
    expect(respostas).toContain('ok')
    expect(sm.temSessao('u')).toBe(false) // encerra após processar
  })

  test('cancelar encerra a sessao', async () => {
    const sm = new SessionManager()
    sm.registrarHandler('x', async () => {})
    sm.iniciar('u', 'x')
    const respostas = []
    const consumiu = await sm.processar('u', 'cancelar', { reply: (t) => respostas.push(t) })
    expect(consumiu).toBe(true)
    expect(respostas[0]).toMatch(/cancelada/i)
    expect(sm.temSessao('u')).toBe(false)
  })

  test('processar sem sessao retorna false', async () => {
    const sm = new SessionManager()
    expect(await sm.processar('ninguem', 'oi', {})).toBe(false)
  })

  test('erro no handler não derruba e encerra a sessao', async () => {
    const sm = new SessionManager()
    sm.registrarHandler('falha', async () => { throw new Error('boom') })
    sm.iniciar('u', 'falha')
    const respostas = []
    const consumiu = await sm.processar('u', 'x', { reply: (t) => respostas.push(t) })
    expect(consumiu).toBe(true)
    expect(respostas[0]).toMatch(/erro/i)
    expect(sm.temSessao('u')).toBe(false)
  })
})
