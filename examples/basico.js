/**
 * Exemplo mínimo de uso do sonne-core.
 * Rode com:  node examples/basico.js
 *
 * (Este exemplo NÃO conecta ao WhatsApp — ele demonstra a API dos módulos
 *  que funcionam sem socket. Para enviar de verdade, injete seu socket Baileys.)
 */
const {
  Buttons, AntiBan, RateLimiter, Storage, DB, Scheduler,
  enableConsoleLogger
} = require('..') // em um projeto real: require('sonne-core')

enableConsoleLogger()

// --- Buttons: montar um menu em texto ---
const menu = Buttons.montarMenuTexto('O que você quer?', [
  Buttons.quickReply('🛍️ Ofertas', '/ofertas'),
  Buttons.urlButton('🌐 Site', 'https://exemplo.com')
], 'Meu Bot')
console.log('\n=== Menu em texto ===\n' + menu)

// --- RateLimiter ---
const rl = new RateLimiter({ maxComandos: 2, janelaMs: 5000 })
console.log('\n=== RateLimiter ===')
console.log('1º:', rl.verificar('user1').permitido)
console.log('2º:', rl.verificar('user1').permitido)
console.log('3º (bloqueado):', rl.verificar('user1').permitido)

// --- AntiBan (status, sem enviar) ---
const antiban = new AntiBan({ perfil: 'equilibrado' })
console.log('\n=== AntiBan ===')
console.log('Perfil atual:', antiban.perfilAtual())
console.log('Spintax:', antiban.variarTexto('{Oi|Olá|E aí}, tudo bem?'))

// --- Storage (JSON em disco) ---
const store = new Storage()
const tmp = require('path').join(require('os').tmpdir(), 'sonne-core-exemplo.json')
store.writeJSON(tmp, { visitas: 1 })
store.updateJSON(tmp, (d) => { d.visitas++; return d })
console.log('\n=== Storage ===')
console.log('Arquivo:', tmp, '->', store.readJSON(tmp))

// --- DB (SQLite nativo; só Node 22+) ---
console.log('\n=== DB ===')
const db = new DB({ path: require('path').join(require('os').tmpdir(), 'sonne-core-exemplo.db') })
if (db.init()) {
  db.set('config', 'tema', { valor: 'escuro' })
  console.log('config.tema =', db.get('config', 'tema'))
  db.close()
} else {
  console.log('SQLite indisponível (precisa de Node 22+).')
}

// --- Scheduler (agendar um horário) ---
const s = new Scheduler()
s.add('18:00', () => console.log('hora do pico!'))
console.log('\n=== Scheduler ===')
console.log('Horários agendados:', s.listar())
