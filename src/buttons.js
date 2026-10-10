/**
 * Buttons - Botoes interativos nativos (native_flow) para o Baileys 7+.
 *
 * Os botoes interativos renderizam no WhatsApp MOBILE. No WhatsApp
 * Web/Desktop aparecem como texto (fallback automatico no modo "ambos"/"texto").
 *
 * Modos:
 *   - "nativo": envia botoes de verdade (so aparecem no mobile)
 *   - "texto" : envia menu em texto numerado (funciona em qualquer WhatsApp)
 *   - "ambos" : envia o nativo E tambem o texto como garantia
 *
 * Esta versao da biblioteca NAO depende de nenhum configManager: o modo e o
 * rodape padrao sao passados por parametro.
 */
const PRIVACY_MODE_TS_OFFSET = 77980457

function getPrivacyModeTs() {
  return (Math.floor(Date.now() / 1000) - PRIVACY_MODE_TS_OFFSET).toString()
}

// ===== CONSTRUTORES DE BOTAO =====

function quickReply(display_text, id) {
  return { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text, id }) }
}

function urlButton(display_text, url) {
  return { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text, url, merchant_url: url }) }
}

function copyButton(display_text, copy_code) {
  return { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text, copy_code }) }
}

function callButton(display_text, phone_number) {
  return { name: 'cta_call', buttonParamsJson: JSON.stringify({ display_text, phone_number }) }
}

/** secoes: [{ title, rows: [{ header, title, description, id }] }] */
function listButton(title, secoes) {
  return { name: 'single_select', buttonParamsJson: JSON.stringify({ title, sections: secoes }) }
}

// ===== NODE BUILDERS (fazem o WhatsApp renderizar os botoes) =====

function buildMixedNativeFlowBizNode() {
  return {
    tag: 'biz',
    attrs: { actual_actors: '2', host_storage: '2', privacy_mode_ts: getPrivacyModeTs() },
    content: [
      {
        tag: 'interactive',
        attrs: { type: 'native_flow', v: '1' },
        content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
      },
      { tag: 'quality_control', attrs: { source_type: 'third_party' } }
    ]
  }
}

// Resolve o pacote baileys de forma opcional (peerDependency).
function getBaileys() {
  try {
    return require('@whiskeysockets/baileys')
  } catch (e) {
    return null
  }
}

// ===== ENVIO =====

/**
 * Envia uma mensagem interativa com botoes.
 * @param {object} socket socket do Baileys
 * @param {string} from jid de destino
 * @param {object|null} info mensagem original (para quoted); pode ser null
 * @param {object} opcoes { texto, rodape, titulo, botoes, imagem, modo }
 */
async function enviar(socket, from, info, opcoes = {}) {
  const {
    texto = '',
    rodape = 'sonne-core',
    titulo = '',
    botoes = [],
    imagem = null,
    modo = 'nativo'
  } = opcoes

  if (modo === 'nativo') {
    const ok = await enviarNativo(socket, from, { texto, rodape, titulo, botoes }).catch(() => false)
    if (ok) return true
    return enviarTexto(socket, from, info, { texto, rodape, botoes, imagem })
  }

  if (modo === 'ambos') {
    await enviarNativo(socket, from, { texto, rodape, titulo, botoes }).catch(() => false)
    return enviarTexto(socket, from, info, { texto: '', rodape, botoes, imagem, soComandos: true })
  }

  return enviarTexto(socket, from, info, { texto, rodape, botoes, imagem })
}

/** Envia a versao em texto (menu numerado com os comandos). */
async function enviarTexto(socket, from, info, { texto, rodape, botoes, imagem, soComandos }) {
  const menuTexto = soComandos
    ? montarMenuTexto('', botoes, rodape)
    : montarMenuTexto(texto, botoes, rodape)
  const opts = info ? { quoted: info } : {}
  try {
    if (imagem) {
      await socket.sendMessage(from, { image: imagem, caption: menuTexto }, opts)
    } else {
      await socket.sendMessage(from, { text: menuTexto }, opts)
    }
    return true
  } catch (e) {
    try { await socket.sendMessage(from, { text: texto || menuTexto }, opts) } catch (e2) {}
    return false
  }
}

/** Envia os botoes NATIVOS (so renderiza no WhatsApp mobile). */
async function enviarNativo(socket, from, { texto, rodape, titulo, botoes }) {
  const baileys = getBaileys()
  if (!baileys) return false
  const { proto, generateWAMessageFromContent, isJidGroup } = baileys

  if (!proto?.Message?.InteractiveMessage || !generateWAMessageFromContent) return false

  const userJid = socket?.user?.id || ''
  const nativeFlowButtons = botoes.map(b =>
    proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
      name: b.name, buttonParamsJson: b.buttonParamsJson
    })
  )

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: texto }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: rodape }),
    ...(titulo ? { header: proto.Message.InteractiveMessage.Header.create({ title: titulo, subtitle: '' }) } : {}),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: nativeFlowButtons, messageParamsJson: '{}', messageVersion: 1
    })
  })

  const waMessage = generateWAMessageFromContent(from, { interactiveMessage }, { userJid })
  const bizNode = buildMixedNativeFlowBizNode()
  const botNode = { tag: 'bot', attrs: { biz_bot: '1' } }
  const ehGrupo = typeof isJidGroup === 'function' ? isJidGroup(from) : from.endsWith('@g.us')
  const additionalNodes = ehGrupo ? [bizNode] : [botNode, bizNode]

  await socket.relayMessage(from, waMessage.message, { messageId: waMessage.key.id, additionalNodes })
  return true
}

/**
 * Envia botoes nativos e RETORNA a mensagem (com .key), util para apagar depois.
 * Se o nativo falhar, cai para texto simples (tambem retorna o key).
 * @returns {object|null}
 */
async function enviarCapturandoKey(socket, from, { texto, rodape = 'sonne-core', titulo = '', botoes = [] }) {
  const baileys = getBaileys()
  try {
    if (!baileys) throw new Error('baileys indisponivel')
    const { proto, generateWAMessageFromContent, isJidGroup } = baileys
    if (!proto?.Message?.InteractiveMessage || !generateWAMessageFromContent) throw new Error('sem proto')

    const userJid = socket?.user?.id || ''
    const nativeFlowButtons = botoes.map(b =>
      proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
        name: b.name, buttonParamsJson: b.buttonParamsJson
      })
    )
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      body: proto.Message.InteractiveMessage.Body.create({ text: texto }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: rodape }),
      ...(titulo ? { header: proto.Message.InteractiveMessage.Header.create({ title: titulo, subtitle: '' }) } : {}),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: nativeFlowButtons, messageParamsJson: '{}', messageVersion: 1
      })
    })
    const waMessage = generateWAMessageFromContent(from, { interactiveMessage }, { userJid })
    const bizNode = buildMixedNativeFlowBizNode()
    const botNode = { tag: 'bot', attrs: { biz_bot: '1' } }
    const ehGrupo = typeof isJidGroup === 'function' ? isJidGroup(from) : from.endsWith('@g.us')
    const additionalNodes = ehGrupo ? [bizNode] : [botNode, bizNode]
    await socket.relayMessage(from, waMessage.message, { messageId: waMessage.key.id, additionalNodes })
    return waMessage
  } catch (e) {
    try { return await socket.sendMessage(from, { text: texto }) } catch (e2) { return null }
  }
}

/** Converte a lista de botoes num menu de texto numerado e legivel. */
function montarMenuTexto(texto, botoes, rodape) {
  let out = texto + '\n\n'
  let n = 1
  const linhas = []
  for (const btn of botoes) {
    try {
      const params = JSON.parse(btn.buttonParamsJson)
      if (btn.name === 'single_select') {
        for (const sec of (params.sections || [])) {
          for (const row of (sec.rows || [])) {
            const cmd = row.id || ''
            linhas.push(`${n}. ${row.title}${row.description ? '\n   _' + row.description + '_' : ''}\n   ${cmd}`)
            n++
          }
        }
      } else if (btn.name === 'quick_reply') {
        linhas.push(`${n}. ${params.display_text}\n   ${params.id}`)
        n++
      } else if (btn.name === 'cta_url') {
        linhas.push(`${n}. ${params.display_text}\n   ${params.url}`)
        n++
      } else if (btn.name === 'cta_copy') {
        linhas.push(`${n}. ${params.display_text}: ${params.copy_code}`)
        n++
      } else if (btn.name === 'cta_call') {
        linhas.push(`${n}. ${params.display_text}: ${params.phone_number}`)
        n++
      }
    } catch (e) {}
  }
  out += linhas.join('\n\n')
  out += `\n\n_${rodape}_`
  return out
}

module.exports = {
  quickReply, urlButton, copyButton, callButton, listButton,
  enviar, enviarNativo, enviarCapturandoKey, montarMenuTexto, buildMixedNativeFlowBizNode
}
