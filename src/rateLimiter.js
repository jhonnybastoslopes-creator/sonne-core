/**
 * RateLimiter / Antiflood - Limita quantos comandos um usuario dispara por
 * janela de tempo, protegendo o processo contra spam. Estrutura leve em
 * memoria, com poda automatica.
 *
 * Uso:
 *   const { RateLimiter } = require('sonne-core')
 *   const rl = new RateLimiter({ maxComandos: 5, janelaMs: 10000, cooldownMs: 15000 })
 *   const r = rl.verificar(senderJid, ehDono)
 *   if (!r.permitido) reply(r.motivo)
 */
class RateLimiter {
  constructor(opcoes = {}) {
    this.usuarios = new Map() // sender -> { timestamps, bloqueadoAte, avisado }
    this.maxComandos = opcoes.maxComandos || 5
    this.janelaMs = opcoes.janelaMs || 10000
    this.cooldownMs = opcoes.cooldownMs || 15000
    this.ultimaPoda = Date.now()
  }

  configurar({ maxComandos, janelaMs, cooldownMs } = {}) {
    if (maxComandos) this.maxComandos = maxComandos
    if (janelaMs) this.janelaMs = janelaMs
    if (cooldownMs) this.cooldownMs = cooldownMs
    return this
  }

  /**
   * @param {string} sender jid do usuario
   * @param {boolean} [isDono=false] dono nunca e limitado
   * @returns {object} { permitido, motivo?, avisar? }
   */
  verificar(sender, isDono = false) {
    if (isDono) return { permitido: true }

    const agora = Date.now()
    this._podaPeriodica(agora)

    let registro = this.usuarios.get(sender)
    if (!registro) {
      registro = { timestamps: [], bloqueadoAte: 0, avisado: false }
      this.usuarios.set(sender, registro)
    }

    if (registro.bloqueadoAte > agora) {
      const avisar = !registro.avisado
      registro.avisado = true
      return {
        permitido: false,
        motivo: `Aguarde ${Math.ceil((registro.bloqueadoAte - agora) / 1000)}s (muitos comandos)`,
        avisar
      }
    }

    registro.timestamps = registro.timestamps.filter(ts => agora - ts < this.janelaMs)

    if (registro.timestamps.length >= this.maxComandos) {
      registro.bloqueadoAte = agora + this.cooldownMs
      registro.avisado = true
      return {
        permitido: false,
        motivo: `Muitos comandos! Aguarde ${this.cooldownMs / 1000}s.`,
        avisar: true
      }
    }

    registro.timestamps.push(agora)
    registro.avisado = false
    return { permitido: true }
  }

  _podaPeriodica(agora) {
    if (agora - this.ultimaPoda < 60000) return
    this.ultimaPoda = agora
    for (const [sender, reg] of this.usuarios) {
      const semAtividade = reg.timestamps.length === 0 && reg.bloqueadoAte < agora
      if (semAtividade) this.usuarios.delete(sender)
    }
  }

  limpar() { this.usuarios.clear() }

  stats() { return { usuariosRastreados: this.usuarios.size } }
}

module.exports = RateLimiter
