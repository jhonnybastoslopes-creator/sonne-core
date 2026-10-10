/**
 * Scheduler - Agendador leve por horarios HH:MM.
 *
 * Dispara callbacks em horarios especificos (ex: picos de 09:00, 12:00, 18:00).
 * Usa um unico timer de 1 minuto (sem polling pesado) e garante que cada
 * horario roda no maximo uma vez por minuto.
 *
 * Uso:
 *   const { Scheduler } = require('sonne-core')
 *   const s = new Scheduler()
 *   s.add('18:00', () => console.log('hora do pico!'))
 *   s.start()
 *   // ... s.stop() para parar
 */
const { log } = require('./logger.js')

class Scheduler {
  constructor() {
    this.timer = null
    this.jobs = new Map() // 'HH:MM' -> Set<fn>
    this.ultimoMinutoExecutado = null
    this._tickHandlers = new Set() // callbacks que rodam TODO minuto
  }

  /** Horario atual no formato HH:MM. */
  horaAtual(date = new Date()) {
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }

  /** Agenda um callback para um horario HH:MM. @returns {boolean} */
  add(hhmm, fn) {
    if (!/^\d{2}:\d{2}$/.test(hhmm)) return false
    if (typeof fn !== 'function') return false
    if (!this.jobs.has(hhmm)) this.jobs.set(hhmm, new Set())
    this.jobs.get(hhmm).add(fn)
    return true
  }

  /** Remove um callback de um horario (ou todos daquele horario se fn omitido). */
  remove(hhmm, fn) {
    if (!this.jobs.has(hhmm)) return false
    if (!fn) { this.jobs.delete(hhmm); return true }
    const ok = this.jobs.get(hhmm).delete(fn)
    if (this.jobs.get(hhmm).size === 0) this.jobs.delete(hhmm)
    return ok
  }

  /** Registra um callback que roda a cada minuto (recebe HH:MM). */
  onTick(fn) {
    if (typeof fn === 'function') this._tickHandlers.add(fn)
    return this
  }

  /** Lista os horarios agendados, ordenados. */
  listar() {
    return Array.from(this.jobs.keys()).sort()
  }

  /** Inicia o timer (checa a cada minuto). */
  start() {
    if (this.timer) return this
    this.timer = setInterval(() => this.tick(), 60000)
    if (this.timer.unref) this.timer.unref()
    log.info('Scheduler iniciado (checagem por minuto)')
    return this
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    return this
  }

  /** Executa a verificacao de um minuto (exposto para testes). */
  async tick(date = new Date()) {
    const hora = this.horaAtual(date)

    for (const fn of this._tickHandlers) {
      try { await fn(hora) } catch (err) { log.error(`Scheduler onTick erro: ${err.message}`) }
    }

    if (this.ultimoMinutoExecutado === hora) return
    const fns = this.jobs.get(hora)
    if (fns && fns.size > 0) {
      this.ultimoMinutoExecutado = hora
      for (const fn of fns) {
        try { await fn(hora) } catch (err) { log.error(`Scheduler job ${hora} erro: ${err.message}`) }
      }
    }
  }
}

module.exports = Scheduler
