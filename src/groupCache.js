/**
 * GroupCache - Cache em memoria dos metadados de grupos do Baileys.
 *
 * O socket.groupMetadata() e uma chamada de rede custosa. Em grupos ativos,
 * chamar a cada mensagem gera trafego e CPU altos. Este cache guarda os
 * metadados por um TTL curto, reduzindo drasticamente as chamadas, com poda
 * automatica por limite de entradas.
 *
 * Uso:
 *   const { GroupCache } = require('sonne-core')
 *   const gc = new GroupCache({ ttl: 5 * 60 * 1000, maxEntradas: 200 })
 *   const meta = await gc.get(socket, jidGrupo)
 */
class GroupCache {
  /**
   * @param {object} [opcoes]
   * @param {number} [opcoes.ttl=300000] tempo de vida em ms
   * @param {number} [opcoes.maxEntradas=200] limite de grupos em cache
   */
  constructor(opcoes = {}) {
    this.cache = new Map()
    this.ttl = opcoes.ttl || 5 * 60 * 1000
    this.maxEntradas = opcoes.maxEntradas || 200
    this.hits = 0
    this.misses = 0
  }

  configurar({ ttl, maxEntradas } = {}) {
    if (ttl) this.ttl = ttl
    if (maxEntradas) this.maxEntradas = maxEntradas
    return this
  }

  /**
   * Metadados do grupo, usando cache quando valido.
   * @param {object} socket socket do Baileys
   * @param {string} jid id do grupo
   */
  async get(socket, jid) {
    const agora = Date.now()
    const cached = this.cache.get(jid)
    if (cached && (agora - cached.ts) < this.ttl) {
      this.hits++
      return cached.data
    }
    this.misses++
    try {
      const data = await socket.groupMetadata(jid)
      this.set(jid, data)
      return data
    } catch (err) {
      if (cached) return cached.data // fallback: cache antigo
      throw err
    }
  }

  set(jid, data) {
    if (this.cache.size >= this.maxEntradas) {
      let maisAntigo = null
      let menorTs = Infinity
      for (const [k, v] of this.cache) {
        if (v.ts < menorTs) { menorTs = v.ts; maisAntigo = k }
      }
      if (maisAntigo) this.cache.delete(maisAntigo)
    }
    this.cache.set(jid, { ts: Date.now(), data })
  }

  /** Invalida o cache de um grupo (ex: quando participantes mudam). */
  invalidar(jid) { this.cache.delete(jid) }

  /** Remove entradas expiradas. @returns {number} removidos */
  podarExpirados() {
    const agora = Date.now()
    let removidos = 0
    for (const [k, v] of this.cache) {
      if ((agora - v.ts) >= this.ttl) { this.cache.delete(k); removidos++ }
    }
    return removidos
  }

  limpar() { this.cache.clear() }

  stats() {
    const total = this.hits + this.misses
    return {
      entradas: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      taxaAcerto: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : 'N/A'
    }
  }
}

module.exports = GroupCache
