const { Buttons } = require('../src/index.js')

describe('Buttons - construtores', () => {
  test('quickReply monta o shape correto', () => {
    const b = Buttons.quickReply('Oi', '/oi')
    expect(b.name).toBe('quick_reply')
    expect(JSON.parse(b.buttonParamsJson)).toEqual({ display_text: 'Oi', id: '/oi' })
  })

  test('urlButton inclui merchant_url', () => {
    const b = Buttons.urlButton('Site', 'https://ex.com')
    const p = JSON.parse(b.buttonParamsJson)
    expect(b.name).toBe('cta_url')
    expect(p.url).toBe('https://ex.com')
    expect(p.merchant_url).toBe('https://ex.com')
  })

  test('listButton aninha secoes', () => {
    const b = Buttons.listButton('Menu', [{ title: 'Sec', rows: [{ title: 'A', id: '/a' }] }])
    const p = JSON.parse(b.buttonParamsJson)
    expect(b.name).toBe('single_select')
    expect(p.sections[0].rows[0].id).toBe('/a')
  })
})

describe('Buttons - montarMenuTexto', () => {
  test('numera quick replies e lista', () => {
    const botoes = [
      Buttons.quickReply('Primeiro', '/um'),
      Buttons.listButton('L', [{ title: 'S', rows: [{ title: 'Linha', description: 'desc', id: '/linha' }] }])
    ]
    const txt = Buttons.montarMenuTexto('Titulo', botoes, 'Rodape')
    expect(txt).toContain('Titulo')
    expect(txt).toContain('1. Primeiro')
    expect(txt).toContain('/um')
    expect(txt).toContain('2. Linha')
    expect(txt).toContain('desc')
    expect(txt).toContain('Rodape')
  })
})

describe('Buttons - enviar (modo texto, sem baileys)', () => {
  test('cai para texto e usa socket.sendMessage', async () => {
    const enviados = []
    const socket = {
      sendMessage: async (jid, content, opts) => { enviados.push({ jid, content, opts }); return { key: { id: 'x' } } }
    }
    const ok = await Buttons.enviar(socket, '123@s.whatsapp.net', null, {
      texto: 'Oi',
      botoes: [Buttons.quickReply('A', '/a')],
      modo: 'texto'
    })
    expect(ok).toBe(true)
    expect(enviados).toHaveLength(1)
    expect(enviados[0].content.text).toContain('/a')
  })

  test('modo nativo sem baileys cai para texto', async () => {
    const enviados = []
    const socket = {
      user: { id: 'bot@s.whatsapp.net' },
      sendMessage: async (jid, content) => { enviados.push(content); return { key: { id: 'y' } } }
    }
    const ok = await Buttons.enviar(socket, '555@g.us', null, {
      texto: 'Teste',
      botoes: [Buttons.quickReply('B', '/b')],
      modo: 'nativo'
    })
    expect(ok).toBe(true)
    expect(enviados[0].text).toContain('/b')
  })

  test('em CANAL (newsletter) força texto mesmo pedindo modo nativo', async () => {
    const enviados = []
    const socket = {
      user: { id: 'bot@s.whatsapp.net' },
      // relayMessage NAO deve ser chamado em canal (seria o caminho nativo)
      relayMessage: async () => { throw new Error('nativo nao deveria ser usado em canal') },
      sendMessage: async (jid, content) => { enviados.push(content); return { key: { id: 'c' } } }
    }
    const ok = await Buttons.enviar(socket, '12345@newsletter', null, {
      texto: 'Menu do canal',
      botoes: [Buttons.quickReply('Opcao', '/op')],
      modo: 'nativo'
    })
    expect(ok).toBe(true)
    expect(enviados).toHaveLength(1)
    expect(enviados[0].text).toContain('/op') // virou menu de texto
  })

  test('enviarCapturandoKey em canal manda texto puro e retorna key', async () => {
    const enviados = []
    const socket = {
      user: { id: 'bot@s.whatsapp.net' },
      relayMessage: async () => { throw new Error('nao deveria usar nativo em canal') },
      sendMessage: async (jid, content) => { enviados.push(content); return { key: { id: 'k' } } }
    }
    const msg = await Buttons.enviarCapturandoKey(socket, '999@newsletter', {
      texto: 'Oferta do canal',
      botoes: [Buttons.urlButton('Ver', 'https://ex.com')]
    })
    expect(msg).not.toBeNull()
    expect(msg.key.id).toBe('k')
    expect(enviados[0].text).toBe('Oferta do canal')
  })
})
