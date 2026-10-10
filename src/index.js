/**
 * sonne-core — Toolkit profissional para bots de WhatsApp (Baileys).
 *
 * API publica. Importe so o que precisar:
 *
 *   const { Buttons, setLogger } = require('sonne-core')
 *   setLogger({ info: console.log, error: console.error }) // opcional
 *
 *   await Buttons.enviar(socket, jid, null, {
 *     texto: 'Escolha uma opcao:',
 *     botoes: [ Buttons.quickReply('Ola', '/ola') ],
 *     modo: 'ambos'
 *   })
 */
const { setLogger, enableConsoleLogger } = require('./logger.js')
const Buttons = require('./buttons.js')

module.exports = {
  // Infra
  setLogger,
  enableConsoleLogger,

  // Modulos
  Buttons
}
