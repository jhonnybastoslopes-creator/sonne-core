/**
 * Logger injetavel do sonne-core.
 *
 * Por padrao e SILENCIOSO (nao polui o console de quem usa a lib).
 * O consumidor pode plugar o proprio logger com setLogger().
 *
 * Ex:
 *   const { setLogger } = require('sonne-core')
 *   setLogger({ info: console.log, error: console.error })
 */
const niveis = ['debug', 'info', 'success', 'warn', 'error']

// Logger padrao: no-op (nao imprime nada). Mantem a lib "quieta" por padrao.
function criarNoop() {
  const o = {}
  for (const n of niveis) o[n] = () => {}
  return o
}

let atual = criarNoop()

/**
 * Define o logger usado por toda a lib.
 * @param {object} logger objeto com metodos debug/info/success/warn/error (todos opcionais)
 */
function setLogger(logger) {
  if (!logger || typeof logger !== 'object') {
    atual = criarNoop()
    return
  }
  const novo = criarNoop()
  for (const n of niveis) {
    if (typeof logger[n] === 'function') novo[n] = logger[n]
  }
  // Fallbacks uteis: success->info, warn->info se nao definidos
  if (typeof logger.success !== 'function' && typeof logger.info === 'function') novo.success = logger.info
  if (typeof logger.warn !== 'function' && typeof logger.info === 'function') novo.warn = logger.info
  atual = novo
}

/** Atalho que liga um logger colorido simples no console. */
function enableConsoleLogger() {
  setLogger({
    debug: (m) => console.log('[DEBUG]', m),
    info: (m) => console.log('[INFO]', m),
    success: (m) => console.log('[OK]', m),
    warn: (m) => console.warn('[WARN]', m),
    error: (m) => console.error('[ERROR]', m)
  })
}

// Proxy estavel: os modulos importam { log } e sempre apontam para o atual.
const log = {}
for (const n of niveis) {
  log[n] = (...args) => atual[n](...args)
}

module.exports = { log, setLogger, enableConsoleLogger }
