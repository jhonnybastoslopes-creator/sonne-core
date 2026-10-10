/**
 * sonne-core — Toolkit profissional para bots de WhatsApp (Baileys).
 *
 * Importe so o que precisar:
 *
 *   const { Buttons, AntiBan, DB, setLogger } = require('sonne-core')
 *
 *   setLogger({ info: console.log, error: console.error }) // opcional
 *
 *   const ab = new AntiBan({ perfil: 'equilibrado' })
 *   ab.setSocket(sock)
 *   await ab.enfileirar(jid, { text: 'oi' })
 *
 * Módulos exportados como CLASSES (instancie com `new`), exceto `Buttons`
 * (funções utilitárias) e os helpers de logger.
 */
const { setLogger, enableConsoleLogger, log } = require('./logger.js')

const Buttons = require('./buttons.js')
const AntiBan = require('./antiBan.js')
const RateLimiter = require('./rateLimiter.js')
const Storage = require('./storage.js')
const DB = require('./db.js')
const Scheduler = require('./scheduler.js')

module.exports = {
  // Infra
  setLogger,
  enableConsoleLogger,
  log,

  // Módulos
  Buttons,     // objeto de funções (quickReply, enviar, ...)
  AntiBan,     // classe
  RateLimiter, // classe
  Storage,     // classe
  DB,          // classe
  Scheduler    // classe
}
